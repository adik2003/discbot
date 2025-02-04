require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// ✅ Ensure database is connected
async function checkDatabase() {
    try {
        await prisma.$connect();
        console.log("✅ Connected to the database!");
    } catch (error) {
        console.error("❌ Database connection failed:", error);
        process.exit(1);
    }
}

// 📌 Handle bot ready event
client.once('ready', async () => {
    await checkDatabase();
    console.log(`✅ Logged in as ${client.user.tag}!`);
});

// 📌 Handle commands
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const command = message.content.toLowerCase().trim();

    // ✅ Clock In
    if (command === '!clockin') {
        try {
            const existingEntry = await prisma.attendance.findFirst({
                where: { userId: message.author.id, clockOut: null }
            });

            if (existingEntry) {
                return message.reply("⚠️ You are already clocked in! Use `!clockout` to clock out.");
            }

            const newEntry = await prisma.attendance.create({
                data: { userId: message.author.id, clockIn: new Date() }
            });

            return message.reply(`✅ You clocked in at: ${newEntry.clockIn.toLocaleString()}`);
        } catch (error) {
            console.error("Clock-in error:", error);
            return message.reply("❌ Error clocking in.");
        }
    }

    // ✅ Clock Out
    else if (command === '!clockout') {
        try {
            const lastEntry = await prisma.attendance.findFirst({
                where: { userId: message.author.id, clockOut: null },
                orderBy: { clockIn: 'desc' }
            });

            if (!lastEntry) {
                return message.reply("⚠️ No active clock-in found. Use `!clockin` first.");
            }

            const updatedEntry = await prisma.attendance.update({
                where: { id: lastEntry.id },
                data: { clockOut: new Date() }
            });

            return message.reply(`✅ You clocked out at: ${updatedEntry.clockOut.toLocaleString()}`);
        } catch (error) {
            console.error("Clock-out error:", error);
            return message.reply("❌ Error clocking out.");
        }
    }

    // ✅ History
    else if (command === '!history') {
        try {
            const records = await prisma.attendance.findMany({
                where: { userId: message.author.id },
                orderBy: { clockIn: 'desc' }
            });

            if (records.length === 0) {
                return message.reply("🔍 No records found.");
            }

            const history = records
                .map((entry, index) => {
                    const clockOut = entry.clockOut ? entry.clockOut.toLocaleString() : "Still Active";
                    return `**#${index + 1}** 🕒 Clock In: ${entry.clockIn.toLocaleString()} | 🏁 Clock Out: ${clockOut}`;
                })
                .join("\n");

            return message.reply(`📜 **Your Clock History:**\n${history}`);
        } catch (error) {
            console.error("History error:", error);
            return message.reply("❌ Error retrieving history.");
        }
    }
});

// ✅ Log in the bot
client.login(process.env.BOT_TOKEN);
