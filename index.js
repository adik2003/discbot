require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Clock In
client.on('messageCreate', async (message) => {
    if (message.content.toLowerCase() === '!clockin') {
        const nowUTC = new Date().toISOString(); // Get UTC timestamp

        await prisma.attendance.create({
            data: {
                userId: message.author.id,
                username: message.author.username,
                clockIn: nowUTC
            }
        });

        message.reply(`✅ Clocked in at <t:${Math.floor(Date.parse(nowUTC) / 1000)}:F> (UTC)`);
        var time=Math.floor(Date.parse(nowUTC) / 1000);
        console.log(time);
    }
});

// Clock Out
client.on('messageCreate', async (message) => {
    if (message.content.toLowerCase() === '!clockout') {
        const nowUTC = new Date().toISOString(); // Get UTC timestamp

        const attendance = await prisma.attendance.findFirst({
            where: { userId: message.author.id, clockOut: null },
            orderBy: { clockIn: 'desc' }
        });

        if (!attendance) {
            return message.reply("❌ No active clock-in found. Please use `!clockin` first.");
        }

        await prisma.attendance.update({
            where: { id: attendance.id },
            data: { clockOut: nowUTC }
        });

        message.reply(`⏳ Clocked out at <t:${Math.floor(Date.parse(nowUTC) / 1000)}:F> (UTC)`);
    }
});
client.on('messageCreate', async (message) => {
    if (!message.content.startsWith("!history")) return;

    const mentionedUser = message.mentions.users.first();
    if (!mentionedUser) {
        return message.reply("Please tag a user to see their history!");
    }

    const history = await prisma.attendance.findMany({
        where: { userId: mentionedUser.id },
        orderBy: { clockIn: 'desc' },
        take: 5
    });

    if (history.length === 0) {
        return message.reply(`No history found for ${mentionedUser.username}.`);
    }

    const historyText = history.map((entry, index) => 
        `**${index + 1}.** Clocked in: <t:${Math.floor(Date.parse(entry.clockIn) / 1000)}:F> (UTC)
         ${entry.clockOut ? `Clocked out: <t:${Math.floor(Date.parse(entry.clockOut) / 1000)}:F> (UTC)` : "*Still active*"}`
    ).join("\n");

    message.reply(`🕒 **Attendance history for ${mentionedUser.username}:**\n${historyText}`);
});

client.login(process.env.BOT_TOKEN);