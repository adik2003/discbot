require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const moment = require('moment-timezone');

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
    if (message.author.bot) return;
    if (message.content.toLowerCase() === '!clockin') {

        try {
            const existingEntry = await prisma.attendance.findFirst({
                where: { userId: message.author.id, clockOut: null }
            });
            if (existingEntry) {
                return message.reply("⚠️ You are already clocked in! Use `!clockout` to clock out.");
            }
           
        }
        catch (error) {
            console.error("Clock-in error:", error);
            return message.reply("❌ Error clocking in.");
        }
            

            
           
        
        const nowUTC = new Date().toISOString(); // Get UTC timestamp

        await prisma.attendance.create({
            data: {
                userId: message.author.id,
                username: message.author.username,
                clockIn: nowUTC
            }
        });

        message.reply(`✅ Clocked in at <t:${Math.floor(Date.parse(nowUTC) / 1000)}:F> `);
        var time=Math.floor(Date.parse(nowUTC) / 1000);
        console.log(time);
    }
});

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!exportlogs')) {
        try {
            const args = message.content.split(' ');
            const timezone = args[1] || 'UTC'; // Default to UTC if no timezone is provided
            
            if (!moment.tz.zone(timezone)) {
                return message.reply('Invalid timezone. Please provide a valid IANA timezone (e.g., America/New_York, Asia/Kolkata).');
            }
            
            const logs = await prisma.attendance.findMany();
            if (logs.length === 0) {
                return message.reply('No attendance logs found.');
            }
            
            let csvContent = 'ID,UserID,Username,ClockIn,ClockOut\n';
            logs.forEach(log => {
                const clockIn = log.clockIn ? moment.utc(log.clockIn).tz(timezone).format('YYYY-MM-DD HH:mm:ss') : 'N/A';
                const clockOut = log.clockOut ? moment.utc(log.clockOut).tz(timezone).format('YYYY-MM-DD HH:mm:ss') : 'N/A';
               
                csvContent += `${log.id},${log.userId},${log.username},${clockIn},${clockOut}\n`;
            });
            
            const filePath = 'attendance_logs.csv';
            fs.writeFileSync(filePath, csvContent, 'utf8');
            
            await message.reply({
                content: `Here are the attendance logs converted to timezone: ${timezone}`,
                files: [filePath]
            });
            
            fs.unlinkSync(filePath); // Delete the file after sending
        } catch (error) {
            console.error('Error exporting logs:', error);
            message.reply('An error occurred while exporting logs.');
        }
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

        message.reply(`⏳ Clocked out at <t:${Math.floor(Date.parse(nowUTC) / 1000)}:F> `);
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
        `**${index + 1}.** Clocked in: <t:${Math.floor(Date.parse(entry.clockIn) / 1000)}:F> 
         ${entry.clockOut ? `Clocked out: <t:${Math.floor(Date.parse(entry.clockOut) / 1000)}:F> ` : "*Still active*"}`
    ).join("\n");

    message.reply(`🕒 **Attendance history for ${mentionedUser.username}:**\n${historyText}`);
});

client.login(process.env.BOT_TOKEN);