require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,TextChannel } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const moment = require('moment-timezone');
const fs=require('fs')
const cron = require('node-cron');
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
            csvContent += `${log.id},${log.username},${clockIn},${clockOut}\n`;
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
    const nowUTC = new Date();

    if (interaction.customId === "clockinout") {
        // Check if the user is already clocked in
        const existingEntry = await prisma.attendance.findFirst({
            where: { userId, clockOut: null }
        });

        if (existingEntry) {
            // User is clocking out
            const clockInTime = new Date(existingEntry.clockIn);
            const durationMs = nowUTC - clockInTime;
            const minutesWorked = Math.floor(durationMs / (1000 * 60));
            const hoursWorked = Math.floor(minutesWorked / 60);

            // Update attendance record
            await prisma.attendance.update({
                where: { id: existingEntry.id },
                data: { clockOut: nowUTC.toISOString() }
            });

            // Update workHours table
            let workHours = await prisma.workHours.findFirst({
                where: { userId }
            });

            if (workHours) {
                await prisma.workHours.update({
                    where: { userId },
                    data: {
                        totalHours: workHours.totalHours + hoursWorked,
                        totalMinutes: (workHours.totalMinutes + minutesWorked) % 60
                    }
                });
            } else {
                await prisma.workHours.create({
                    data: {
                        userId,
                        username: interaction.user.username,
                        totalHours: hoursWorked,
                        totalMinutes: minutesWorked % 60
                    }
                });
            }

            await interaction.reply({
                content: `⏳ **Clocked out at:** <t:${Math.floor(nowUTC / 1000)}:F>. You've worked **${hoursWorked} hours and ${minutesWorked % 60} minutes** this session.`,
                ephemeral: true
            });

        } else {
            // User is clocking in
            await prisma.attendance.create({
                data: {
                    userId,
                    username: interaction.user.username,
                    clockIn: nowUTC.toISOString()
                }
            });

            await interaction.reply({
                content: `✅ **Clocked in at:** <t:${Math.floor(nowUTC / 1000)}:F>`,
                ephemeral: true
            });
        }
    }
    else if (interaction.customId === "checkstatus") {
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

   

const CLEAR_DB_PASSWORD = process.env.CLEAR_DB_PASSWORD; // Store in .env for security

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('!clear')) return;

    const args = message.content.split(' ');
    if (args.length < 2) {
        return message.reply("⚠️ **Usage:** `!clear <password>`");
    }

    const providedPassword = args[1];

    if (providedPassword !== CLEAR_DB_PASSWORD) {
        return message.reply("❌ **Incorrect password!** Access denied.");
    }

    try {
        await prisma.attendance.deleteMany({});
        message.reply("✅ **Attendance database has been wiped!**");
        await prisma.workHours.deleteMany({});
        message.reply("✅ **Workhour database has been wiped!**");
    } catch (error) {
        console.error("Error clearing database:", error);
        message.reply("❌ **Failed to clear the database.**");
    }
});

client.on('messageCreate', async (message) => {
    if (message.content.toLowerCase() === '!myhours') {
        const workHours = await prisma.workHours.findUnique({
            where: { userId: message.author.id }
        });

        if (!workHours) {
            return message.reply("You haven't logged any hours yet.");
        }

        message.reply(`🕒 **${message.author.username}**, you have worked a total of **${workHours.totalHours} hours and ${workHours.totalMinutes} minutes**.`);
    }
});


const EXPORT_CHANNEL_ID = process.env.EXPORT_CHANNEL_ID; // Set in .env for security

// Function to export logs and send to Discord channel
async function exportAttendanceLogs() {
    try {
        const logs = await prisma.attendance.findMany();

        if (logs.length === 0) {
            console.log("No attendance logs to export.");
            return;
        }

        let csvContent = 'ID,UserID,Username,ClockIn,ClockOut\n';
        logs.forEach(log => {
            const clockIn = log.clockIn ? moment.utc(log.clockIn).format('YYYY-MM-DD HH:mm:ss') : 'N/A';
            const clockOut = log.clockOut ? moment.utc(log.clockOut).format('YYYY-MM-DD HH:mm:ss') : 'N/A';
            csvContent += `${log.id},${log.userId},${log.username},${clockIn},${clockOut}\n`;
        });

        const filePath = 'attendance_logs.csv';
        fs.writeFileSync(filePath, csvContent, 'utf8');

        const channel = await client.channels.fetch(EXPORT_CHANNEL_ID);
        if (!channel || !(channel instanceof TextChannel)) {
            console.error("Invalid export channel ID.");
            return;
        }

        await channel.send({
            content: `📅 **Weekly Attendance Logs Export**`,
            files: [filePath]
        });

        fs.unlinkSync(filePath); // Delete file after sending
        console.log("✅ Attendance logs exported successfully.");
    } catch (error) {
        console.error("❌ Error exporting logs:", error);
    }
}


cron.schedule('0 0 * * 1', async () => {
    console.log("⏳ Exporting work hours...");

    try {
        const workHoursData = await prisma.workHours.findMany();

        if (workHoursData.length === 0) {
            console.log("⚠️ No work hours data found.");
            return;
        }

        let csvContent = 'UserID,Username,TotalHours,TotalMinutes\n';
        workHoursData.forEach(record => {
            csvContent += `${record.userId},${record.username},${record.totalHours},${record.totalMinutes}\n`;
        });

        const filePath = 'work_hours.csv';
        fs.writeFileSync(filePath, csvContent, 'utf8');

        const channel = await client.channels.fetch(EXPORT_CHANNEL_ID);
        if (!channel) {
            console.error("❌ Failed to fetch the export channel.");
            return;
        }

        await channel.send({
            content: "📁 Weekly Work Hours Report:",
            files: [filePath]
        });

        fs.unlinkSync(filePath); // Delete the file after sending
        console.log("✅ Work hours exported successfully.");
    } catch (error) {
        console.error("❌ Error exporting work hours:", error);
    }
});

// Schedule the task to run every Monday at 00:00 UTC
cron.schedule('0 0 * * 1', async () => {
    console.log("⏳ Running scheduled weekly export...");
    await exportAttendanceLogs();
});


client.login(process.env.BOT_TOKEN);
