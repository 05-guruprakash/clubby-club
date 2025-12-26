import { useEffect, useState, type FC } from 'react';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';

interface ChatRoomProps {
    communityId: string;
    type: 'club' | 'event' | 'team';
}

interface Message {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    senderRole?: string;
    createdAt: any;
}

const ChatRoom: FC<ChatRoomProps> = ({ communityId, type }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [accessDenied, setAccessDenied] = useState(false);
    const [userRoleInContext, setUserRoleInContext] = useState<string>('member');

    // 1. Verify Access & Determine Role
    useEffect(() => {
        const checkAccess = async () => {
            if (!user) { setAccessDenied(true); return; }

            try {
                if (type === 'team') {
                    // Check team doc directly for leader or member array
                    const teamDoc = await getDoc(doc(db, 'teams', communityId));
                    if (teamDoc.exists()) {
                        const data = teamDoc.data();
                        if (data.leaderId === user.uid) {
                            setAccessDenied(false);
                            setUserRoleInContext('leader');
                            return;
                        } else if (data.members && data.members.includes(user.uid)) {
                            setAccessDenied(false);
                            setUserRoleInContext('member');
                            return;
                        }
                    }
                    setAccessDenied(true);
                } else if (type === 'club') {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    const joined = userDoc.data()?.joined_clubs || [];
                    if (!joined.includes(communityId)) {
                        setAccessDenied(true);
                    } else {
                        setAccessDenied(false);
                        const clubMemberDoc = await getDoc(doc(db, `clubs/${communityId}/members`, user.uid));
                        if (clubMemberDoc.exists()) {
                            setUserRoleInContext(clubMemberDoc.data().role || 'member');
                        }
                    }
                } else if (type === 'event') {
                    // Event Chat: viewable by all? Or registered?
                    // Prompt says: "If a user is a regular member, hide the message input and show a "View Only" badge for Event Communities."
                    // Implies read access is open or check registration.
                    // For now, assume open read, restricted write.
                    setAccessDenied(false);
                    // Check if user has specific role in event?
                    // Maybe check if they are 'event_head' generally?
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    const role = userDoc.data()?.role;
                    if (role === 'chairperson' || role === 'event_head') {
                        setUserRoleInContext(role);
                    } else {
                        setUserRoleInContext('member');
                    }
                }
            } catch (e) {
                console.error("Access check failed", e);
                setAccessDenied(true);
            }
        };

        checkAccess();
    }, [communityId, type, user]);


    // 2. Real-time Listener
    useEffect(() => {
        if (accessDenied) return;

        const q = query(
            collection(db, 'community_messages'),
            where('communityId', '==', communityId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            // Client-side sort to avoid index requirements
            msgs.sort((a, b) => {
                const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
                const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
                return tA - tB;
            });
            setMessages(msgs);
        });

        return unsubscribe;
    }, [communityId, accessDenied]);

    const handleSendMessage = async () => {
        if (!user || !newMessage.trim() || accessDenied) return;

        try {
            await addDoc(collection(db, 'community_messages'), {
                communityId: communityId,
                text: newMessage.trim(),
                senderId: user.uid,
                senderName: user.displayName || user.email || 'Anon',
                senderRole: userRoleInContext,
                createdAt: serverTimestamp(),
                type: type
            });
            setNewMessage('');
        } catch (e) {
            console.error("Send failed", e);
            alert("Failed to send message.");
        }
    };

    const getRoleData = (role?: string) => {
        switch (role) {
            case 'chairperson':
            case 'chairman': return { color: 'gold', icon: '👑' };
            case 'vice_chairman': return { color: 'silver', icon: '🛡️' };
            case 'secretary': return { color: 'silver', icon: '📝' };
            case 'event_head': return { color: 'lightblue', icon: '⚡' };
            case 'leader': return { color: 'orange', icon: '🚩' };
            default: return { color: 'transparent', icon: '' };
        }
    };

    if (accessDenied) {
        return <div style={{ color: 'red' }}>Access Denied to this {type} chat.</div>;
    }

    const { color: myColor, icon: myIcon } = getRoleData(userRoleInContext);
    const canChat = type !== 'event' || (type === 'event' && userRoleInContext !== 'member');

    return (
        <div style={{ border: '1px solid #999', padding: '10px', margin: '10px 0', borderRadius: '8px', background: '#222', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>{type.toUpperCase()}: {communityId}</h4>
                <div style={{ fontSize: '0.9rem' }}>
                    You are: <span style={{ color: myColor }}>{myIcon} {userRoleInContext}</span>
                </div>
            </div>

            <div style={{ height: '300px', overflowY: 'auto', background: '#333', marginBottom: '10px', padding: '10px', borderRadius: '5px' }}>
                {messages.map(msg => {
                    const { color, icon } = getRoleData(msg.senderRole);
                    const isMe = msg.senderId === user?.uid;

                    // Format Time
                    let timeStr = '';
                    if (msg.createdAt) {
                        try {
                            const date = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
                            timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } catch (e) { timeStr = ''; }
                    }

                    return (
                        <div key={msg.id} style={{ marginBottom: '8px', textAlign: isMe ? 'right' : 'left' }}>
                            <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '2px' }}>
                                {msg.senderName} <span style={{ color: color !== 'transparent' ? color : 'inherit', fontWeight: 'bold' }}>({msg.senderRole || 'member'})</span> {icon} • {timeStr}
                            </div>
                            <div style={{
                                background: isMe ? '#4a4' : '#555',
                                padding: '8px 12px',
                                borderRadius: '15px',
                                display: 'inline-block',
                                maxWidth: '80%',
                                border: `2px solid ${color !== 'transparent' ? color : 'transparent'}`
                            }}>
                                {msg.text}
                            </div>
                        </div>
                    );
                })}
            </div>

            {canChat ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        style={{ flex: 1, padding: '10px', borderRadius: '5px', border: 'none' }}
                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button onClick={handleSendMessage} style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                        Send
                    </button>
                </div>
            ) : (
                <div style={{ padding: '10px', background: '#444', textAlign: 'center', borderRadius: '5px', fontStyle: 'italic' }}>
                    View Only (Event Community)
                </div>
            )}
        </div>
    );
};

export default ChatRoom;
