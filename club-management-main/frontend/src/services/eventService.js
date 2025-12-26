import {
    collection,
    onSnapshot,
    query,
    where,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    orderBy,
    getDoc,
    increment
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Real-time listener for events (discover/feed)
export const subscribeToEvents = (callback, filter = 'all') => {
    // Fetch all events without server-side ordering to ensure docs missing 'dateTime' aren't hidden
    const q = query(collection(db, 'events'));

    return onSnapshot(q, (snapshot) => {
        let events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[Firestore] Fetched ${events.length} events from database.`);

        // Filter in memory
        if (filter !== 'all') {
            const beforeCount = events.length;
            events = events.filter(event => event.status === filter);
            console.log(`[Firestore] Filtered '${filter}': ${beforeCount} -> ${events.length}`);
        }

        // Sort in memory
        events.sort((a, b) => {
            const dateA = a.dateTime ? new Date(a.dateTime) : new Date(0);
            const dateB = b.dateTime ? new Date(b.dateTime) : new Date(0);
            return dateA - dateB;
        });

        callback(events);
    }, (error) => {
        console.error("❌ Firestore Subscription Failed:", error.message);
        callback([]);
    });
};

// Real-time listener for teams in an event
export const subscribeToTeams = (eventId, callback) => {
    const q = query(collection(db, 'teams'), where('eventId', '==', eventId));
    return onSnapshot(q, (snapshot) => {
        const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(teams);
    }, (error) => {
        console.error("Teams sync error:", error);
        callback([]);
    });
};

// Create an event
export const createEvent = async (eventData) => {
    return await addDoc(collection(db, 'events'), {
        ...eventData,
        status: 'open',
        registeredCount: 0,
        createdAt: serverTimestamp(),
    });
};

// Create a team
export const createTeam = async (teamData) => {
    const docRef = await addDoc(collection(db, 'teams'), {
        ...teamData,
        members: [teamData.leaderId],
        status: teamData.isFull ? 'registered' : 'forming',
        createdAt: serverTimestamp(),
    });

    // Track registration
    await addDoc(collection(db, 'eventRegistrations'), {
        eventId: teamData.eventId,
        teamId: docRef.id,
        registeredAt: serverTimestamp(),
        teamMembers: [teamData.leaderId]
    });

    return docRef;
};

// Join a team request
export const requestToJoinTeam = async (teamId, userId, message) => {
    return await addDoc(collection(db, 'team_join_requests'), {
        teamId,
        userId,
        message,
        status: 'pending',
        timestamp: serverTimestamp(),
    });
};

// Approve team join request
export const approveJoinRequest = async (requestId, teamId, userId) => {
    const requestRef = doc(db, 'team_join_requests', requestId);
    const teamRef = doc(db, 'teams', teamId);

    try {
        const teamDoc = await getDoc(teamRef);
        const team = teamDoc.data();

        if (team.members.length >= team.maxMembers) {
            throw new Error('Team is already full');
        }

        const updatedMembers = [...team.members, userId];
        await updateDoc(teamRef, {
            members: updatedMembers,
            status: updatedMembers.length >= team.maxMembers ? 'registered' : 'forming'
        });

        await updateDoc(requestRef, { status: 'approved' });
    } catch (error) {
        console.error("Approve request error:", error);
        throw error;
    }
};
