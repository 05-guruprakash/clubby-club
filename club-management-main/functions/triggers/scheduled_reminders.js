// functions/triggers/scheduled_reminders.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const eventReminders = onSchedule("every day 09:00", async () => {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);

  const snapshot = await db
    .collection("events")
    .where("event_date", ">=", now)
    .where("event_date", "<=", tomorrow)
    .get();

  if (snapshot.empty) return;

  snapshot.forEach((doc) => {
    // placeholder: enqueue notifications
    console.log(`Reminder scheduled for event ${doc.id}`);
  });
});

module.exports = {
  eventReminders,
};
