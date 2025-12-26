import { collection, addDoc, serverTimestamp, getDocs, query, limit, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const SAMPLE_EVENTS = [
    {
        title: "Eco-Adventure Hike",
        clubName: "Outdoor Adventurers",
        category: "Sports",
        description: "Join us for an exhilarating hiking, kayaking, and rock climbing trip across the beautiful scenic trails of the local mountains. This event is perfect for nature lovers and thrill-seekers alike.",
        venue: "Main Quad / Mountain Base",
        dateTime: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
        date: "MAR 30",
        time: "06:00 AM",
        minTeamSize: 1,
        maxTeamSize: 4,
        maxCapacity: 100,
        registeredCount: 0,
        banner: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070",
        status: "open"
    },
    {
        title: "Nexus Tech Hackathon",
        clubName: "Computer Society",
        category: "Technical",
        description: "A 24-hour coding marathon to build innovative solutions for campus problems. Great prizes, networking with industry leaders, and non-stop coding!",
        venue: "MIT Computer Center",
        dateTime: new Date(Date.now() + 86400000 * 10).toISOString(), // 10 days from now
        date: "APR 05",
        time: "09:00 AM",
        minTeamSize: 2,
        maxTeamSize: 4,
        maxCapacity: 200,
        registeredCount: 45,
        banner: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=2070",
        status: "open"
    },
    {
        title: "Cultural Night 2024",
        clubName: "Arts & Culture Club",
        category: "Cultural",
        description: "An evening filled with music, dance, and drama performances from the various departments of MIT. Don't miss the grand finale performance!",
        venue: "Main Auditorium",
        dateTime: new Date(Date.now() + 86400000 * 15).toISOString(), // 15 days from now
        date: "APR 15",
        time: "05:00 PM",
        minTeamSize: 1,
        maxTeamSize: 10,
        maxCapacity: 500,
        registeredCount: 120,
        banner: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2070",
        status: "open"
    },
    {
        title: "Photography Workshop",
        clubName: "Media Club",
        category: "Workshop",
        description: "Learn the basics of DSLR photography, lighting techniques, and post-processing from professional photographers.",
        venue: "Seminar Hall II",
        dateTime: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days from now
        date: "MAR 28",
        time: "10:00 AM",
        minTeamSize: 1,
        maxTeamSize: 1,
        maxCapacity: 50,
        registeredCount: 38,
        banner: "https://images.unsplash.com/photo-1452780212940-6f5c0d14d84a?q=80&w=2070",
        status: "open"
    }
];

const deleteCollection = async (collectionPath) => {
    const snapshot = await getDocs(collection(db, collectionPath));
    const deletePromises = snapshot.docs.map(async (d) => {
        try {
            await deleteDoc(doc(db, collectionPath, d.id));
        } catch (e) {
            console.warn(`[Seeder] Skip delete ${d.id}: Permissions restricted.`);
        }
    });
    await Promise.all(deletePromises);
};

export const seedEvents = async (force = false) => {
    try {
        const eventsRef = collection(db, 'events');

        if (force) {
            console.log("Force seeding: Clearing existing events...");
            await deleteCollection('events');
        } else {
            const snapshot = await getDocs(eventsRef);
            if (!snapshot.empty) {
                console.log(`Events already exist (${snapshot.size} docs). Skipping seed.`);
                return { success: true, message: `Found ${snapshot.size} existing events. Use Force Seed if you don't see them.` };
            }
        }

        console.log("Seeding events...");
        for (const event of SAMPLE_EVENTS) {
            await addDoc(eventsRef, {
                ...event,
                createdAt: serverTimestamp(),
            });
        }
        console.log("Seeding complete!");
        return { success: true, message: "Fresh events seeded successfully!" };
    } catch (error) {
        console.error("Error seeding events:", error);
        return { success: false, message: error.message };
    }
};
