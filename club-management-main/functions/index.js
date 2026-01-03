const { onMessageCreate } = require("./triggers/on_message_create");
const { eventReminders } = require("./triggers/scheduled_reminders");
<<<<<<< HEAD
const { onUserCreate } = require("./triggers/on_user_create");
const { scheduledReminders } = require("./triggers/scheduled_reminders");
const { onTeamFull } = require("./triggers/on_team_full");

exports.onMessageCreate = onMessageCreate;
exports.eventReminders = eventReminders;
exports.onUserCreate = onUserCreate;
exports.scheduledReminders = scheduledReminders;
exports.onTeamFull = onTeamFull;
=======

exports.onMessageCreate = onMessageCreate;
exports.eventReminders = eventReminders;
>>>>>>> 1b01de9af77f472fa0faf6670c6b250ee70ee80e
