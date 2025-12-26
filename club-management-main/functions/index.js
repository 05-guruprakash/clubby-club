const { onMessageCreate } = require("./triggers/on_message_create");
const { eventReminders } = require("./triggers/scheduled_reminders");
const { onUserCreate } = require("./triggers/on_user_create");
const { scheduledReminders } = require("./triggers/scheduled_reminders");
const { onTeamFull } = require("./triggers/on_team_full");

exports.onMessageCreate = onMessageCreate;
exports.eventReminders = eventReminders;
exports.onUserCreate = onUserCreate;
exports.scheduledReminders = scheduledReminders;
exports.onTeamFull = onTeamFull;