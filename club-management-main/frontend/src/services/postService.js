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
    limit,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Real-time listener for posts (Feed)
export const subscribeToPosts = (clubIds, callback) => {
    if (!clubIds || clubIds.length === 0) {
        // If no clubs followed, maybe show public posts or return empty
        const q = query(
            collection(db, 'posts'),
            where('type', '!=', 'private'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
        return onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(posts);
        });
    }

    const q = query(
        collection(db, 'posts'),
        where('clubId', 'in', clubIds),
        orderBy('timestamp', 'desc'),
        limit(50)
    );

    return onSnapshot(q, (snapshot) => {
        const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(posts);
    });
};

// Create a post
export const createPost = async (postData) => {
    return await addDoc(collection(db, 'posts'), {
        ...postData,
        timestamp: serverTimestamp(),
        likes: [],
        comments: [],
    });
};

// Like/Unlike a post
export const toggleLike = async (postId, userId, isLiked) => {
    const postRef = doc(db, 'posts', postId);
    return await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(userId) : arrayUnion(userId)
    });
};

// Add comment
export const addComment = async (postId, comment) => {
    const postRef = doc(db, 'posts', postId);
    return await updateDoc(postRef, {
        comments: arrayUnion({
            ...comment,
            timestamp: Date.now(), // Firestore doesn't support serverTimestamp inside arrays well
        })
    });
};

// Real-time notifications listener
export const subscribeToNotifications = (userId, callback) => {
    const q = query(
        collection(db, `notifications/${userId}/userNotifications`),
        orderBy('timestamp', 'desc'),
        limit(20)
    );

    return onSnapshot(q, (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(notifications);
    });
};

// Mark notification as read
export const markNotificationRead = async (userId, notificationId) => {
    const notifRef = doc(db, `notifications/${userId}/userNotifications`, notificationId);
    return await updateDoc(notifRef, { read: true });
};
