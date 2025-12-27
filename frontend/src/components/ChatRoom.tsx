import { useEffect, useState, type FC } from 'react';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, getDoc, doc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';

interface ChatRoomProps {
    communityId: string;
    type: 'club' | 'event' | 'team';
}

interface Comment {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    senderRole?: string;
    createdAt: any;
}

interface Message {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    senderRole?: string;
    createdAt: any;
    likes?: string[];
    comments?: Comment[];
}

const ChatRoom: FC<ChatRoomProps> = ({ communityId, type }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [accessDenied, setAccessDenied] = useState(false);
    const [userRoleInContext, setUserRoleInContext] = useState<string>('member');

    // New State for Collapsible Comments
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
    const [commentInputText, setCommentInputText] = useState<{ [key: string]: string }>({});

    // Toggle visibility of comments
    const toggleComments = (msgId: string) => {
        const newSet = new Set(expandedComments);
        if (newSet.has(msgId)) {
            newSet.delete(msgId);
        } else {
            newSet.add(msgId);
        }
        setExpandedComments(newSet);
    };

    // Handle text input change per message
    const handleInputChange = (msgId: string, text: string) => {
        setCommentInputText(prev => ({ ...prev, [msgId]: text }));
    };

    // Submit comment to Firestore
    const submitComment = async (msgId: string) => {
        const text = commentInputText[msgId];
        if (!user || !text || !text.trim()) return;

        const newComment: Comment = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            text: text.trim(),
            senderId: user.uid,
            senderName: user.displayName || user.email || 'Anon',
            senderRole: userRoleInContext,
            createdAt: new Date().toISOString() // Use ISO string for consistent API transit
        };

        // 🔥 CLUB CHAT BYPASS: Use Backend API
        if (type === 'club') {
            try {
                const token = await user.getIdToken();
                const response = await fetch('http://localhost:3001/clubs/chat/comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ messageId: msgId, comment: newComment })
                });
                if (response.ok) {
                    handleInputChange(msgId, '');
                    return;
                }
            } catch (e) {
                console.warn("API Comment failed, falling back to client-write", e);
            }
        }

        const ref = doc(db, 'community_messages', msgId);
        try {
            await setDoc(ref, {
                comments: arrayUnion(newComment)
            }, { merge: true });
            handleInputChange(msgId, ''); // Clear input
            // Keep expanded to show the new comment
        } catch (e) {
            console.error("Comment failed", e);
            alert("Failed to add comment.");
        }
    };

    // Helper for Local Storage (matches Clubs.tsx)
    const getLocalJoined = () => {
        if (!user) return [];
        try {
            const local = localStorage.getItem(`joined_clubs_${user.uid}`);
            return local ? JSON.parse(local) : [];
        } catch (e) { return []; }
    };

    // 1. Verify Access & Determine Role
    useEffect(() => {
        const checkAccess = async () => {
            if (!user) { setAccessDenied(true); return; }

            // AUTO-ALLOW if listed in Local Storage (matches UI state)
            const localJoined = getLocalJoined();
            if (localJoined.includes(communityId)) {
                setAccessDenied(false);
                setUserRoleInContext('member');
                try {
                    const clubMemberDoc = await getDoc(doc(db, `clubs/${communityId}/members`, user.uid));
                    if (clubMemberDoc.exists()) {
                        setUserRoleInContext(clubMemberDoc.data().role || 'member');
                    }
                } catch (e) { console.warn("Role fetch silent fail"); }
                return;
            }

            try {
                if (type === 'team') {
                    const teamDoc = await getDoc(doc(db, 'teams', communityId));
                    if (teamDoc.exists()) {
                        const data = teamDoc.data();
                        if (data.leaderId === user.uid || (data.members && data.members.includes(user.uid))) {
                            setAccessDenied(false);
                            setUserRoleInContext(data.leaderId === user.uid ? 'leader' : 'member');
                            return;
                        }
                    }
                    setAccessDenied(true);
                } else if (type === 'club') {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    const userData = userDoc.data();
                    const joined = userData?.joined_clubs || [];

                    if (joined.includes(communityId)) {
                        setAccessDenied(false);
                        try {
                            const clubMemberDoc = await getDoc(doc(db, `clubs/${communityId}/members`, user.uid));
                            if (clubMemberDoc.exists()) {
                                setUserRoleInContext(clubMemberDoc.data().role || 'member');
                            }
                        } catch (e) { }
                    } else {
                        setAccessDenied(true);
                    }
                } else if (type === 'event') {
                    setAccessDenied(false);
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    const role = userDoc.data()?.role;
                    if (role === 'chairperson' || role === 'event_head') {
                        setUserRoleInContext(role);
                    } else {
                        setUserRoleInContext('member');
                    }
                }
            } catch (e: any) {
                console.error("Access check failed", e);
                if (localJoined.includes(communityId)) {
                    setAccessDenied(false);
                } else {
                    setAccessDenied(true);
                }
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
                type: type,
                likes: [],
                comments: []
            });
            setNewMessage('');
        } catch (e) {
            console.error("Send failed", e);
            alert("Failed to send message.");
        }
    };

    const handleLike = async (msg: Message) => {
        if (!user) return;

        // 🔥 CLUB CHAT BYPASS: Use Backend API
        if (type === 'club') {
            try {
                const token = await user.getIdToken();
                const response = await fetch('http://localhost:3001/clubs/chat/like', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ messageId: msg.id })
                });
                if (response.ok) return;
            } catch (e) {
                console.warn("API Like failed, falling back to client-write", e);
            }
        }

        const isLiked = msg.likes?.includes(user.uid);
        const ref = doc(db, 'community_messages', msg.id);
        try {
            if (isLiked) {
                await setDoc(ref, { likes: arrayRemove(user.uid) }, { merge: true });
            } else {
                await setDoc(ref, { likes: arrayUnion(user.uid) }, { merge: true });
            }
        } catch (e) {
            console.error("Toggle like failed", e);
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

    const fixAndSeed = async () => {
        if (!user || type !== 'club') {
            alert("This fix is specifically for Club Chats.");
            return;
        }

        console.log("Starting Club Chat Fix...");
        let successCount = 0;

        try {
            // 1. Local Storage Fix (Always works, guaranteed UI unblock)
            try {
                const currentLocal = getLocalJoined();
                if (!currentLocal.includes(communityId)) {
                    const newIds = [...currentLocal, communityId];
                    localStorage.setItem(`joined_clubs_${user.uid}`, JSON.stringify(newIds));
                    console.log("Local Access Fixed.");
                    successCount++;
                }
            } catch (e) { console.error("Local Fix fail", e); }

            // 2. Remote User Fix (Best effort)
            try {
                await setDoc(doc(db, 'users', user.uid), {
                    joined_clubs: arrayUnion(communityId)
                }, { merge: true });
                console.log("Remote User Doc Fixed.");
                successCount++;
            } catch (e) { console.warn("Remote User Doc permission denied - skipping"); }

            // 3. Remote Membership Fix (Best effort)
            try {
                await setDoc(doc(db, `clubs/${communityId}/members`, user.uid), {
                    role: 'member',
                    uid: user.uid,
                    displayName: user.displayName || 'Member',
                    joinedAt: serverTimestamp(),
                    status: 'active'
                }, { merge: true });
                console.log("Remote Membership Fixed.");
                successCount++;
            } catch (e) { console.warn("Remote Membership permission denied - skipping"); }

            // 4. Seed Sample Messages (if none exist)
            if (messages.length === 0) {
                try {
                    const texts = ["Welcome to the Club!", "Hello from the Developer!", "Try liking this message.", "Threads are here!"];
                    for (const t of texts) {
                        await addDoc(collection(db, 'community_messages'), {
                            communityId,
                            text: t,
                            senderId: user.uid,
                            senderName: user.displayName || 'System',
                            senderRole: 'member',
                            createdAt: serverTimestamp(),
                            type: 'club',
                            likes: [],
                            comments: []
                        });
                    }
                    console.log("Sample Messages Seeded.");
                    successCount++;
                } catch (e) { console.warn("Seeding permission denied - skipping"); }
            }

            if (successCount > 0) {
                alert("Club Chat synchronized! Reloading to apply changes.");
                window.location.reload();
            } else {
                alert("Fix completed with warnings. Check console if issues persist.");
            }
        } catch (e: any) {
            console.error("Critical Fix Error", e);
            alert("Fix process encountered an error: " + e.message);
        }
    };

    if (accessDenied) {
        return (
            <div style={{ color: 'red', padding: '20px', border: '1px solid red' }}>
                Access Denied to this {type} chat. <br />
                <button onClick={fixAndSeed} style={{ marginTop: '10px' }}>DEBUG: Fix Access & Seed Data</button>
            </div>
        );
    }

    const { color: myColor, icon: myIcon } = getRoleData(userRoleInContext);
    const isMember = userRoleInContext === 'member';
    const canChatMain = type === 'team' || !isMember;

    return (
        <div style={{ border: '1px solid #999', padding: '10px', margin: '10px 0', borderRadius: '8px', background: '#222', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>{type.toUpperCase()}: {communityId}</h4>
                <div style={{ fontSize: '0.9rem' }}>
                    You are: <span style={{ color: myColor }}>{myIcon} {userRoleInContext}</span>
                </div>
            </div>

            <div style={{ height: '500px', overflowY: 'auto', background: '#333', marginBottom: '10px', padding: '10px', borderRadius: '5px' }}>
                {messages.map(msg => {
                    const { color, icon } = getRoleData(msg.senderRole);
                    const isMe = msg.senderId === user?.uid;
                    const likedByMe = msg.likes?.includes(user?.uid || '');
                    const isExpanded = expandedComments.has(msg.id);
                    const commentCount = msg.comments?.length || 0;

                    let timeStr = '';
                    if (msg.createdAt) {
                        try {
                            const date = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
                            timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } catch (e) { timeStr = ''; }
                    }

                    return (
                        <div key={msg.id} style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                            <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '2px' }}>
                                {msg.senderName} <span style={{ color: color !== 'transparent' ? color : 'inherit', fontWeight: 'bold' }}>({msg.senderRole || 'member'})</span> {icon} • {timeStr}
                            </div>
                            <div style={{
                                background: isMe ? '#4a4' : '#555',
                                padding: '8px 12px',
                                borderRadius: '15px',
                                display: 'inline-block',
                                maxWidth: '80%',
                                border: `2px solid ${color !== 'transparent' ? color : 'transparent'}`,
                                position: 'relative'
                            }}>
                                {msg.text}
                            </div>

                            {/* Interactions: Like & Toggle Comments */}
                            <div style={{ display: 'flex', gap: '15px', marginTop: '5px', fontSize: '0.8rem', color: '#ccc', marginLeft: isMe ? '0' : '10px', marginRight: isMe ? '10px' : '0' }}>
                                <span
                                    onClick={() => handleLike(msg)}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: likedByMe ? '#ff4444' : 'inherit' }}
                                    title="Like"
                                >
                                    {likedByMe ? '❤️' : '🤍'} {msg.likes?.length || 0}
                                </span>
                                <span
                                    onClick={() => toggleComments(msg.id)}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title="View/Add Comments"
                                >
                                    💬 {commentCount}
                                </span>
                            </div>

                            {/* Collapsible Comments Section */}
                            {isExpanded && (
                                <div style={{
                                    marginTop: '8px',
                                    background: '#2a2a2a',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    width: '80%',
                                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                                    borderLeft: '3px solid #666'
                                }}>
                                    {/* Existing Comments */}
                                    {msg.comments && msg.comments.length > 0 ? (
                                        <div style={{ marginBottom: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                                            {msg.comments.map((comment, idx) => (
                                                <div key={idx} style={{ marginBottom: '8px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
                                                    <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '2px' }}>
                                                        <span style={{ fontWeight: 'bold', color: '#ddd' }}>{comment.senderName}</span> • {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div style={{ fontSize: '0.9rem', color: 'white' }}>
                                                        {comment.text}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.8rem', color: '#777', marginBottom: '10px', fontStyle: 'italic' }}>
                                            No comments yet.
                                        </div>
                                    )}

                                    {/* Add Comment Input */}
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <input
                                            type="text"
                                            value={commentInputText[msg.id] || ''}
                                            onChange={e => handleInputChange(msg.id, e.target.value)}
                                            placeholder="Write a comment..."
                                            style={{
                                                flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #555',
                                                background: '#333', color: 'white', fontSize: '0.85rem'
                                            }}
                                            onKeyDown={e => e.key === 'Enter' && submitComment(msg.id)}
                                        />
                                        <button
                                            onClick={() => submitComment(msg.id)}
                                            style={{
                                                padding: '4px 10px', fontSize: '0.8rem', background: '#3b82f6',
                                                color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
                                            }}
                                        >
                                            Post
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {canChatMain ? (
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
                <div style={{ padding: '12px', background: '#333', textAlign: 'center', borderRadius: '5px', color: '#aaa', fontSize: '0.9rem' }}>
                    Read Only. You can like messages and participate in comment threads.
                </div>
            )}

            {/* Temporary Debug Button - can be removed once verified */}
            <div style={{ marginTop: '20px', borderTop: '1px dashed #666', paddingTop: '10px', textAlign: 'center' }}>
                <button
                    onClick={fixAndSeed}
                    style={{ fontSize: '0.7rem', opacity: 0.5, background: 'none', color: '#888', border: '1px solid #444', cursor: 'pointer', padding: '2px 5px' }}
                >
                    DEBUG: Click if Like/Comment fails
                </button>
            </div>
        </div>
    );
};

export default ChatRoom;
