require('dotenv').config();
const { Message,Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,TextChannel } = require('discord.js');
const { PrismaClient } = require('@prisma/client');
/**
 * Clears the attendance and work hours database.
 * @param {Message} message - The Discord message object.
 *  
 */
const moment = require('moment-timezone');
const fs=require('fs')
const cron = require('node-cron');
const date = new Date();
const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
const formattedDate = date.toLocaleDateString('en-US', options);



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
        
   
        const res=await exportAttendanceLogs(message);
        
   }});



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
           // Update workHours table
let workHours = await prisma.workHours.findFirst({
    where: { userId }
});

if (workHours) {
    let newTotalMinutes = workHours.totalMinutes + minutesWorked;

    // Correct minute to hour conversion
    let extraHours = Math.floor(newTotalMinutes / 60);
    newTotalMinutes = newTotalMinutes % 60;

    // ✅ Fix: Remove double counting of hoursWorked
    let newTotalHours = workHours.totalHours + extraHours; 

    await prisma.workHours.update({
        where: { userId },
        data: {
            totalHours: newTotalHours,
            totalMinutes: newTotalMinutes
        }
    });
}




 else {
    await prisma.workHours.create({
        data: {
            userId,
            username: interaction.user.username,
            totalHours: hoursWorked + Math.floor(minutesWorked / 60),
            totalMinutes: minutesWorked % 60
        }
    });
}


            await interaction.reply({
                content: `⏳ **Clocked out at:** <t:${Math.floor(nowUTC / 1000)}:F>. You've worked **${hoursWorked} hours and ${minutesWorked % 60} minutes** this session.`,
                flags: 64
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
                flags: 64
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
                flags: 64
            });
        } else {
            await interaction.reply({
                content: "❌ You are **not clocked in**.",
                flags: 64
            });
        }
    } else if (interaction.customId === "currenttime") {
        // Show current time in user's timezone
        await interaction.reply({
            content: ` **Current Time:** <t:${Math.floor(nowUTC / 1000)}:F>`,
            flags: 64 // Ephemeral messages should now use this flag
        });
        

    }
});
/**
 * Clears the attendance and work hours database.
 * @param {Message} message - The Discord message object.
 * - The password entered by the user.
 */
   

const CLEAR_DB_PASSWORD = process.env.CLEAR_DB_PASSWORD|""; // Store in .env for security
const clearDatabase = async (message) => {
    

    try {
        await prisma.attendance.deleteMany({});
        await prisma.workHours.deleteMany({});

        if (message) {
            message.reply("✅ **Attendance and Workhour database have been wiped!**");
        } else {
            console.log("✅ Database wiped successfully.");
        }
    } catch (error) {
        console.error("❌ Error clearing database:", error);
        if (message) message.reply("❌ **Failed to clear the database.**");
    }
};


client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('!secretwipe')) return;

 

    await clearDatabase( message);
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

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('!forceclockout')) return;

    try {
        console.log("⏳ Force clocking out all users...");
        const clockedInUsers = await prisma.attendance.findMany({
            where: { clockOut: null }
        });

        if (clockedInUsers.length === 0) {
            return message.reply("✅ No users are currently clocked in.");
        }

        const nowUTC = new Date();
        for (const user of clockedInUsers) {
            const clockInTime = new Date(user.clockIn);
            const durationMs = nowUTC - clockInTime;
            const minutesWorked = Math.floor(durationMs / (1000 * 60));
            const hoursWorked = Math.floor(minutesWorked / 60);

            // Update attendance record
            await prisma.attendance.update({
                where: { id: user.id },
                data: { clockOut: nowUTC.toISOString() }
            });

            // Update work hours
            let workHours = await prisma.workHours.findFirst({
                where: { userId: user.userId }
            });

            if (workHours) {
                let newTotalMinutes = workHours.totalMinutes + minutesWorked;
            
                // Correct minute to hour conversion
                let extraHours = Math.floor(newTotalMinutes / 60);
                newTotalMinutes = newTotalMinutes % 60;
            
                // ✅ Fix: Remove double counting of hoursWorked
                let newTotalHours = workHours.totalHours + extraHours; 
            
                await prisma.workHours.update({
                    where: { userId :user.userId},
                    data: {
                        totalHours: newTotalHours,
                        totalMinutes: newTotalMinutes
                    }
                });
            }else {
                await prisma.workHours.create({
                    data: {
                        userId: user.userId,
                        username: user.username,
                        totalHours: hoursWorked,
                        totalMinutes: minutesWorked % 60
                    }
                });
            }
        }

        message.reply(`✅ Force clocked out **${clockedInUsers.length} users** successfully.`);
        console.log(`✅ Force clocked out ${clockedInUsers.length} users.`);
    } catch (error) {
        console.error("❌ Error force clocking out users:", error);
        message.reply("❌ An error occurred while force clocking out users.");
    }
});


const EXPORT_CHANNEL_ID = process.env.EXPORT_CHANNEL_ID; // Set in .env for security

// Function to export logs and send to Discord channel
/**
 * Clears the attendance and work hours database.
 * @param {Message} message - The Discord message object.
 * - The password entered by the user.
 */
const exportAttendanceLogs=async function (message) {
    try {
        const logs = await prisma.attendance.findMany();

        if (logs.length === 0) {
           message.reply("No attendance logs to export.");
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
            content: `📅 Weekly Attendance Logs Export- **${formattedDate}**`,
            files: [filePath]
        });

        fs.unlinkSync(filePath); // Delete file after sending
        console.log("✅ Attendance logs exported successfully.");
    } catch (error) {
        console.error("❌ Error exporting logs:", error);
    }
}

//0 22 * * 0'
/**
 * Clears the attendance and work hours database.
 * @param {Message} message - The Discord message object.
 * - The password entered by the user.
 */
cron.schedule('0 22 * * 0', async () => {
    console.log("⏳ Exporting work hours...");

    try {
        const workHoursData = await prisma.workHours.findMany();

        if (workHoursData.length === 0) {
            console.log("⚠️ No work hours data found.");
            return;
        }

        let csvContent = 'UserID,Username,TotalHours,TotalMinutes\n';
        workHoursData.forEach(record => {
            csvContent += `${record.userId},${record.username},${record.totalHours} Hours,${record.totalMinutes} Minutes\n`;
        });

        const filePath = 'work_hours.csv';
        fs.writeFileSync(filePath, csvContent, 'utf8');

        const channel = await client.channels.fetch(EXPORT_CHANNEL_ID);
        if (!channel) {
            console.error("❌ Failed to fetch the export channel.");
            return;
        }
        
        await channel.send({
            content: `📁 Weekly Work Hours Report - **${formattedDate}**`,
            files: [filePath]
        });

        fs.unlinkSync(filePath); // Delete the file after sending
        console.log("✅ Work hours exported successfully.");
        
        await clearDatabase();
        console.log("✅ Database Wiped.");
    } catch (error) {
        console.error("❌ Error exporting work hours:", error);
    }
});

// Schedule the task to run every Sunday at 22:00 UTC
/**
 * Clears the attendance and work hours database.
 * @arg {Message} message - The Discord message object.
 */
cron.schedule('0 22 * * 0)', async () => {
    console.log("⏳ Running scheduled weekly export...");
    await exportAttendanceLogs();
    await clearDatabase();
});


const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID; // Set this in your .env file

cron.schedule('*/60 * * * *', async () => {  // Runs every 5 minutes
    console.log("⏳ Checking for users clocked in for 8 hours...");

    try {
        const nowUTC = new Date();
        const eightHoursMs = 8 * 60 * 60 * 1000;

        // Find all users who have clocked in and not clocked out
        const activeClockIns = await prisma.attendance.findMany({
            where: { clockOut: null }
        });

        const notificationChannel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID);
        if (!notificationChannel) {
            console.error("❌ Notification channel not found!");
            return;
        }

        for (const user of activeClockIns) {
            const clockInTime = new Date(user.clockIn);
            const durationMs = nowUTC - clockInTime;

            if (durationMs >= eightHoursMs) {
                const userId = user.userId;

                const message = `🚨 <@${userId}>, you have been clocked in for **8 hours**! Please head to <#1326054828853690368>  if you wish to clock out.`;

                // Send the notification to the designated channel
                await notificationChannel.send(message);
                console.log(`✅ Sent 8-hour notification for ${user.username}`);
            }
        }
    } catch (error) {
        console.error("❌ Error checking 8-hour clock-ins:", error);
    }
});


client.login(process.env.BOT_TOKEN);
