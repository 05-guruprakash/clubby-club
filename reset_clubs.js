const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function resetClubs() {
    const coll = db.collection('clubs');
    const snapshot = await coll.get();

    const batch = db.batch();
    snapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("Wiped existing clubs.");

    const clubs = [
        {
            name: 'Coding Club',
            description: 'The ultimate space for developers to build, learn and compete. Join us to master DSA, Web Dev and more.',
            bio: 'Founded by a group of passionate developers, the Coding Club has grown into the most active technical community on campus. We focus on hands-on learning and real-world projects.',
            moto: 'Code Your Way Up',
            since: '2020',
            eventsConducted: 45,
            member_count: 0,
            requiresApproval: true,
            achievements: [
                'Winner of Inter-College Hackathon 2023',
                'Successfully developed the University Admission Portal',
                'Organized the largest technical symposium with 1000+ participants'
            ],
            gallery: [
                'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=400',
                'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=400',
                'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=400'
            ]
        },
        {
            name: 'Robotics Society',
            description: 'Designing and building the future, one robot at a time.',
            bio: 'From micro-bots to industrial-scale automation, we explore the world of mechanics, electronics, and AI. Our lab is equipped with the latest 3D printers and development boards.',
            moto: 'Innovate, Automate, Elevate',
            since: '2019',
            eventsConducted: 32,
            member_count: 0,
            requiresApproval: true,
            achievements: [
                'Top 5 in National Robocon 2024',
                'Designed an autonomous delivery drone for campus',
                'Best Innovation Award at State Tech Expo'
            ],
            gallery: [
                'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=400',
                'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=400',
                'https://images.unsplash.com/photo-1555255707-c07966088b7b?auto=format&fit=crop&w=400'
            ]
        },
        {
            name: 'Music & Arts Club',
            description: 'Expressing creativity through rhythms, melodies, and colors.',
            bio: 'The Music & Arts Club is a vibrant home for musicians, painters, and performers. We host regular jam sessions, art galleries, and cultural fests.',
            moto: 'Where Rhythms Meet Colors',
            since: '2017',
            eventsConducted: 85,
            member_count: 0,
            requiresApproval: false,
            achievements: [
                'Winners of the Regional Battle of Bands 2022',
                'Published "Canvas", an annual campus art magazine',
                'Host of the monthly "Open Mic Under the Stars"'
            ],
            gallery: [
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400',
                'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=400',
                'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400'
            ]
        }
    ];

    for (const club of clubs) {
        await coll.add(club);
        console.log(`Club ${club.name} added!`);
    }
}

resetClubs().then(() => {
    console.log('Reset complete.');
    process.exit();
}).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
