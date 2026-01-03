import { useEffect, useState } from 'react';
import { collection, query, updateDoc, doc, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface Notification {
    id: string;
    message: string;
    read: boolean;
}

const Notifications = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
            setNotifications(data);
        });
        return () => unsubscribe();
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await updateDoc(doc(db, 'notifications', id), { read: true });
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (e) {
            console.error("Error marking as read: ", e);
        }
    };

    return (
        <div style={{ border: '1px solid orange', padding: '10px', marginTop: '10px' }}>
            <h3>Notifications</h3>
            {notifications.length === 0 && <p>No notifications</p>}
            <ul>
                {notifications.map(n => (
                    <li key={n.id} style={{ textDecoration: n.read ? 'line-through' : 'none' }}>
                        {n.message}
                        {!n.read && <button onClick={() => markAsRead(n.id)} style={{ marginLeft: '10px' }}>Mark as Read</button>}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Notifications;
