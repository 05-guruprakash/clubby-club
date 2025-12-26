const { onMessageCreate } = require("./triggers/on_message_create");
const { eventReminders } = require("./triggers/scheduled_reminders");

exports.onMessageCreate = onMessageCreate;
exports.eventReminders = eventReminders;
