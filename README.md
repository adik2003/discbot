Bot Commands & Usage
1. Clock In/Out (Button-Based)
Command: Press the button in the bot's message
Description:
Users can clock in and out using an interactive button.
If a user is not clocked in, the button will show "Clock In".
If a user is already clocked in, the button will change to "Clock Out".
Example Usage:
User clicks the "Clock In" button → Bot records clock-in time. User clicks the "Clock Out" button → Bot records clock-out time.
Bot Response:
✅ Clocked in at <timestamp> ⏳ Clocked out at <timestamp>

2. View Attendance History
Command: !history @user
Description:
Allows users to view the last 5 clock-in and clock-out logs for a tagged user.
If no history is found, the bot informs the user.
Example Usage:
!history @username
Bot Response:
🕒 Attendance history for @username:
Clocked in: <timestamp>
Clocked out: <timestamp>
Clocked in: <timestamp>
Clocked out: <timestamp>


3. Export Attendance Logs
Command: !exportlogs [timezone]
Description:
Exports all attendance logs as a CSV file.
The optional timezone argument converts timestamps accordingly.
Example Usage:
!exportlogs America/New_York
Bot Response:
📁 Here are the attendance logs converted to timezone: America/New_York (CSV file attached)

4. Clear Attendance Data (Admin Only)
Command: !clear password
Description:
Wipes all attendance data only if the correct password is provided.
Use this with caution.
Example Usage:
!clear mySecurePassword
Bot Response:
⚠️ Attendance data has been cleared.

Automated Features
1. Auto Export Logs Weekly
The bot will automatically export attendance logs every week.
The logs will be sent to the configured log channel.


