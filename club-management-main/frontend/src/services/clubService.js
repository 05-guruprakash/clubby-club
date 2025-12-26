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
    getDocs
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Real-time listener for clubs
export const subscribeToClubs = (callback) => {
    const q = query(collection(db, 'clubs'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
        const clubs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(clubs);
    });
};

// Real-time listener for a specific club
export const subscribeToClub = (clubId, callback) => {
    return onSnapshot(doc(db, 'clubs', clubId), (doc) => {
        if (doc.exists()) {
            callback({ id: doc.id, ...doc.data() });
        } else {
            callback(null);
        }
    });
};

// Join a club application
export const applyToJoinClub = async (clubId, userId, applicationData) => {
    const application = {
        clubId,
        userId,
        ...applicationData,
        status: 'pending',
        appliedAt: serverTimestamp(),
    };
    return await addDoc(collection(db, 'club_applications'), application);
};

// Add to club gallery
export const addToGallery = async (clubId, imageUrl) => {
    const clubRef = doc(db, 'clubs', clubId);
    const clubDoc = await getDoc(clubRef);
    const currentGallery = clubDoc.data().gallery || [];
    return await updateDoc(clubRef, {
        gallery: [...currentGallery, imageUrl]
    });
};

// Update club details
export const updateClubDetails = async (clubId, details) => {
    const clubRef = doc(db, 'clubs', clubId);
    return await updateDoc(clubRef, {
        ...details,
        updatedAt: serverTimestamp()
    });
};

// Manage members (Promote/Demote)
export const updateMemberRole = async (clubId, userId, newRole) => {
    const clubRef = doc(db, 'clubs', clubId);
    const clubDoc = await getDoc(clubRef);
    const admins = clubDoc.data().admins || {};

    if (newRole === 'member') {
        delete admins[userId];
    } else {
        admins[userId] = newRole;
    }

    return await updateDoc(clubRef, { admins });
};
