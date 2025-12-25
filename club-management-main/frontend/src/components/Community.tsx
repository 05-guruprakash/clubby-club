import { useEffect, useState } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';
import { useRole } from '../hooks/useRole';

interface Message {
    id: string;
    text: string;
    userId: string;
    userName: string;
    userRole: string;
    createdAt: any;
}

const Community = () => {
    const { user } = useAuth();
    const role = useRole();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'community_messages'), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(msgs);
        });
        return unsubscribe;
    }, []);

    const handleSendMessage = async () => {
        if (!user || !newMessage.trim()) return;

        // In a real app, you'd probably fetch the user's name from their profile
        // For now, we'll just use their email or a placeholder if email is hidden
        const userName = user.displayName || user.email?.split('@')[0] || 'Anonymous';

        await addDoc(collection(db, 'community_messages'), {
            text: newMessage,
            userId: user.uid,
            userName: userName,
            userRole: role || 'member',
            createdAt: serverTimestamp()
        });
        setNewMessage('');
    };

    return (
        <div>
            <h2>Community Chat</h2>
            <div style={{ height: '300px', overflowY: 'scroll', border: '1px solid #ccc', marginBottom: '10px', padding: '10px' }}>
                {messages.map(msg => (
                    <div key={msg.id} style={{ marginBottom: '5px' }}>
                        <strong>{msg.userName} ({msg.userRole}): </strong>
                        <span>{msg.text}</span>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex' }}>
                <input
                    style={{ flex: 1 }}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                />
                <button onClick={handleSendMessage}>Send</button>
            </div>
        </div>
    );
};

export default Community;
