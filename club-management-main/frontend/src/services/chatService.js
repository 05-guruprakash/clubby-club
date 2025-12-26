import {
    collection,
    onSnapshot,
    query,
    where,
    doc,
    addDoc,
    serverTimestamp,
    orderBy,
    limit
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Real-time listener for community messages
export const subscribeToMessages = (communityId, callback) => {
    const q = query(
        collection(db, `communities/${communityId}/messages`),
        orderBy('timestamp', 'asc'),
        limit(100)
    );

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    });
};

// Send a message
export const sendMessage = async (communityId, messageData) => {
    return await addDoc(collection(db, `communities/${communityId}/messages`), {
        ...messageData,
        timestamp: serverTimestamp(),
    });
};

// Create a new community
export const createCommunity = async (communityData) => {
    // communityData: { type: 'club'|'event'|'team', referenceId: string, members: string[] }
    return await addDoc(collection(db, 'communities'), {
        ...communityData,
        createdAt: serverTimestamp(),
    });
};
