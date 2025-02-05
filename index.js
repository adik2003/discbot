require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const moment = require('moment-timezone');
const fs=require('fs')
const prisma = new PrismaClient();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Send interactive clock-in/out message



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
        `**${index + 1}.** Clocked in: <t:${Math.floor(Date.parse(entry.clockIn) / 1000)}:F> 
         ${entry.clockOut ? `Clocked out: <t:${Math.floor(Date.parse(entry.clockOut) / 1000)}:F> ` : "*Still active*"}`
    ).join("\n");

    message.reply(`🕒 **Attendance history for ${mentionedUser.username}:**\n${historyText}`);
});


client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!exportlogs')) {
        
    try {
        console.log("⏳ Exporting logs...");
        const args = message.content.split(' ');
        const timezone = args[1] || 'UTC'; // Default timezone

        // Validate timezone
        if (!moment.tz.zone(timezone)) {
            return message.reply('❌ Invalid timezone! Use a valid IANA timezone (e.g., America/New_York, Asia/Kolkata).');
        }

        const logs = await prisma.attendance.findMany();
        console.log("📝 Retrieved logs:", logs.length);

        if (logs.length === 0) {
            return message.reply('⚠️ No attendance logs found.');
        }

        let csvContent = 'ID,UserID,Username,ClockIn,ClockOut\n';
        logs.forEach(log => {
            const clockIn = log.clockIn ? moment.utc(log.clockIn).tz(timezone).format('YYYY-MM-DD HH:mm:ss') : 'N/A';
            const clockOut = log.clockOut ? moment.utc(log.clockOut).tz(timezone).format('YYYY-MM-DD HH:mm:ss') : 'N/A';
            csvContent += `${log.id},${log.userId},${log.username},${clockIn},${clockOut}\n`;
        });

        const filePath = 'attendance_logs.csv';
        fs.writeFileSync(filePath, csvContent, 'utf8');
        console.log("✅ File created:", filePath);

        await message.reply({
            content: `📂 Attendance logs for **${timezone}** exported successfully.`,
            files: [filePath]
        });

        fs.unlinkSync(filePath); // Delete after sending
        console.log("🗑 File deleted after sending.");
    } catch (error) {
        console.error('❌ Export Logs Error:', error);
        message.reply('❌ An error occurred while exporting logs.');
    }
}
});



client.on('messageCreate', async (message) => {
    if (message.content.toLowerCase() === '!clockpanel') {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("Clock-in/out")
            .setDescription(
                "Click **Clock In/Out** to clock in/out of your shift.\n\n" +
                "To check if you're currently clocked in, click ❓.\n" +
                "To see your current time, click ⏰."
            )
            .setFooter({ text: "Attendance System" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("clockinout")
                .setLabel("Click to Clock In/Out")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("checkstatus")
                .setEmoji("❓")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("currenttime")
                .setEmoji("⏰")
                .setStyle(ButtonStyle.Secondary)
        );

        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const userId = interaction.user.id;
    const nowUTC = new Date().toISOString();

    if (interaction.customId === "clockinout") {
        // Check if the user is already clocked in
        const existingEntry = await prisma.attendance.findFirst({
            where: { userId, clockOut: null }
        });

        if (existingEntry) {
            // Clock out
            await prisma.attendance.update({
                where: { id: existingEntry.id },
                data: { clockOut: nowUTC }
            });

            await interaction.reply({
                content: `⏳ **Clocked out at:** <t:${Math.floor(Date.parse(nowUTC) / 1000)}:F>`,
                ephemeral: true
            });
        } else {
            // Clock in
            await prisma.attendance.create({
                data: {
                    userId,
                    username: interaction.user.username,
                    clockIn: nowUTC
                }
            });

            await interaction.reply({
                content: `✅ **Clocked in at:** <t:${Math.floor(Date.parse(nowUTC) / 1000)}:F>`,
                ephemeral: true
            });
        }
    } else if (interaction.customId === "checkstatus") {
        // Check if user is currently clocked in
        const activeEntry = await prisma.attendance.findFirst({
            where: { userId, clockOut: null }
        });

        if (activeEntry) {
            await interaction.reply({
                content: `✅ You are currently **clocked in** since <t:${Math.floor(Date.parse(activeEntry.clockIn) / 1000)}:R>.`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: "❌ You are **not clocked in**.",
                ephemeral: true
            });
        }
    } else if (interaction.customId === "currenttime") {
        // Show current time in user's timezone
        await interaction.reply({
            content: `🕒 **Current Time:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            ephemeral: true
        });
    }
});

client.login(process.env.BOT_TOKEN);
