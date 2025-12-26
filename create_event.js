const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function createEvent() {
    try {
        const eventName = "Winter Hackathon 2025";
        const eventDesc = "A 24-hour coding challenge to build innovative solutions.";
        const eventDate = "2025-12-30";
        const eventTime = "10:00 AM";
        const eventVenue = "Main Auditorium";
        const maxTeamSize = 4;

        const eventData = {
            title: eventName,
            description: eventDesc,
            date: eventDate,
            time: eventTime,
            venue: eventVenue,
            maxTeamMembers: maxTeamSize,
            status: 'upcoming',
            timestamp: new Date().toISOString()
        };

        console.log("Creating event document...");
        const eventRef = await db.collection('events').add(eventData);
        console.log("Event created with ID:", eventRef.id);

        // Add notification to Feed
        console.log("Adding feed announcement...");
        await db.collection('posts').add({
            content: `New Event: ${eventName} has been scheduled for ${eventDate} at ${eventTime}. Venue: ${eventVenue}. Check the Discover tab to register!`,
            authorName: 'Official',
            authorRole: 'admin',
            type: 'event',
            communityName: 'Official Announcements',
            timestamp: new Date().toISOString()
        });

        // Also add to global notifications collection
        console.log("Adding notification entry...");
        await db.collection('notifications').add({
            message: `📢 Official: New Event "${eventName}" is now open for registration! Check Discover tab for details.`,
            read: false,
            timestamp: new Date().toISOString()
        });

        console.log("Success! Event created and feed updated.");
        process.exit(0);
    } catch (e) {
        console.error("Error: ", e);
        process.exit(1);
    }
}

createEvent();
