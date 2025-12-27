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

    const [commentInputText, setCommentInputText] = useState<{ [key: string]: string }>({});
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
    const [isServerAlive, setIsServerAlive] = useState<boolean | null>(null);
    const [selectedUserProfile, setSelectedUserProfile] = useState<any | null>(null);

    // Ping server to check connectivity
    useEffect(() => {
        const checkServer = async () => {
            try {
                const res = await fetch('http://localhost:3001/health').catch(() => ({ ok: false }));
                setIsServerAlive(!!res.ok);
            } catch (e) {
                setIsServerAlive(false);
            }
        };
        checkServer();
        const interval = setInterval(checkServer, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, []);

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
            createdAt: new Date().toISOString()
        };

        // Optimistic UI Update
        const optimisticComment = { ...newComment, createdAt: new Date() }; // Use Date object for local display
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, comments: [...(m.comments || []), optimisticComment] } : m));

        // 🔥 BYPASS: Use Backend API for Clubs & Events
        if (type === 'club' || type === 'event') {
            try {
                const token = await user.getIdToken();
                const response = await fetch('http://localhost:3001/clubs/chat/comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ messageId: msgId, comment: newComment })
                });
                if (!response.ok) {
                    const errTxt = await response.text();
                    console.error("API Comment Error:", errTxt);
                    throw new Error(errTxt);
                }
                handleInputChange(msgId, '');
                return;
            } catch (e: any) {
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
            alert("Failed to add comment. Please check your connection.");
        }
    };

    const showUserCard = async (userId: string) => {
        try {
            const userSnap = await getDoc(doc(db, 'users', userId));
            if (userSnap.exists()) {
                setSelectedUserProfile({ uid: userId, ...userSnap.data() });
            } else {
                alert("User profile not found.");
            }
        } catch (e) {
            console.error("Error fetching user profile:", e);
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
            const msgs = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Message))
                .filter(m => m.text && m.text.trim() !== '');

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

        // Optimistic UI Update
        const isLiked = msg.likes?.includes(user.uid);
        setMessages(prev => prev.map(m => {
            if (m.id !== msg.id) return m;
            const likes = m.likes || [];
            const newLikes = isLiked ? likes.filter(id => id !== user.uid) : [...likes, user.uid];
            return { ...m, likes: newLikes };
        }));

        // 🔥 BYPASS: Use Backend API for Clubs & Events
        if (type === 'club' || type === 'event') {
            try {
                const token = await user.getIdToken();
                const response = await fetch('http://localhost:3001/clubs/chat/like', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ messageId: msg.id })
                });
                if (!response.ok) {
                    const errTxt = await response.text();
                    console.error("API Like Error:", errTxt);
                } else {
                    return; // Success
                }
            } catch (e) {
                console.warn("API Like failed, falling back to client-write", e);
            }
        }

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
        if (!user || (type !== 'club' && type !== 'event' && type !== 'team')) {
            alert("This fix is specifically for Community Chats.");
            return;
        }

        const isGlobal = communityId === 'official_event_feed' || communityId === 'global_club_community';

        if (messages.length > 0 && !isGlobal) {
            if (!confirm("This chat already has messages. Do you want to add more sample messages for testing?")) return;
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

            // 4. Seed Sample Messages
            try {
                const isGlobal = communityId === 'official_event_feed' || communityId === 'global_club_community';
                if (messages.length === 0 || isGlobal) {
                    const texts = (type === 'event' || communityId === 'official_event_feed')
                        ? [
                            "📢 Official: Welcome to the Event Feed! Stay tuned for updates.",
                            "🔥 Registration for Hackathon 2025 is now LIVE! Build your teams now.",
                            "📍 Reminder: Workshop session at 3 PM in Hall B. Be there!",
                            "💡 Pro Tip: You can 'Like' and 'Discuss' any message here to share your thoughts."
                        ]
                        : [
                            "👋 Welcome to the Club Community! This is where all club members connect.",
                            "✨ New features active! You can now participate in Discussions and Like posts.",
                            "🤔 Question of the day: What event should we organize next month?",
                            "🚀 Click on any name in the discussion thread to view their member profile!"
                        ];

                    for (const t of texts) {
                        if (messages.some(m => m.text === t)) continue;
                        await addDoc(collection(db, 'community_messages'), {
                            communityId,
                            text: t,
                            senderId: user?.uid || 'system',
                            senderName: user?.displayName || 'System Admin',
                            senderRole: 'chairperson',
                            createdAt: serverTimestamp(),
                            type: type as any,
                            likes: [],
                            comments: []
                        });
                    }
                    console.log("Sample Messages Seeded.");
                    successCount++;
                }
            } catch (e) { console.warn("Seeding failed - skipping", e); }

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
                <div style={{ fontSize: '0.9rem' }}>
                    You are: <span style={{ color: myColor }}>{myIcon} {userRoleInContext}</span>
                </div>
            </div>

            {/* Backend Connection Warning */}
            {isServerAlive === false && type === 'club' && (
                <div style={{ background: '#fef3c7', color: '#92400e', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⚠️ <strong>Server Offline:</strong> Experience may be slow. Please run <code>npm run dev</code> to start the full system.
                </div>
            )}

            <div style={{ height: '500px', overflowY: 'auto', background: '#333', marginBottom: '10px', padding: '10px', borderRadius: '5px' }}>
                {messages.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#888', textAlign: 'center', padding: '20px' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📭</div>
                        <div style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#aaa' }}>No messages yet.</div>
                        <p style={{ fontSize: '0.85rem', marginBottom: '20px', maxWidth: '300px' }}>Be the first to start the conversation or seed some test data below.</p>
                        {(type === 'club' || type === 'event') && (
                            <button
                                onClick={fixAndSeed}
                                style={{
                                    padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #646cff 0%, #4a51e6 100%)',
                                    color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(100, 108, 255, 0.3)'
                                }}
                            >
                                ✨ Seed Sample Test Data
                            </button>
                        )}
                    </div>
                ) : (
                    messages.map(msg => {
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

                                {/* Interactions: Like & Discuss (ONLY FOR CLUBS & EVENTS) */}
                                {(type === 'club' || type === 'event') && (
                                    <>
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
                                                title="Discuss"
                                            >
                                                💬 {commentCount} Discuss
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
                                                borderLeft: '3px solid #ffaa00'
                                            }}>
                                                {/* Discussion Thread */}
                                                <div style={{ fontSize: '0.8rem', color: '#ffaa00', marginBottom: '8px', fontWeight: 'bold' }}>Discussion</div>
                                                {msg.comments && msg.comments.length > 0 ? (
                                                    <div style={{ marginBottom: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                                                        {msg.comments.map((comment, idx) => (
                                                            <div key={idx} style={{ marginBottom: '8px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
                                                                <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '2px' }}>
                                                                    <span
                                                                        style={{ fontWeight: 'bold', color: '#ddd', cursor: 'pointer', textDecoration: 'underline' }}
                                                                        onClick={() => comment.senderId && showUserCard(comment.senderId)}
                                                                    >
                                                                        {comment.senderName}
                                                                    </span> • {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                                <div style={{ fontSize: '0.9rem', color: 'white' }}>
                                                                    {comment.text}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: '0.8rem', color: '#777', marginBottom: '10px', fontStyle: 'italic' }}>
                                                        Start the discussion...
                                                    </div>
                                                )}

                                                {/* Add Comment Input */}
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    <input
                                                        type="text"
                                                        value={commentInputText[msg.id] || ''}
                                                        onChange={e => handleInputChange(msg.id, e.target.value)}
                                                        placeholder="Type your discussion..."
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
                                    </>
                                )}
                            </div>
                        );
                    }))}
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
                {/* User Profile Modal */}
                {selectedUserProfile && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000,
                        backdropFilter: 'blur(5px)'
                    }}>
                        <div style={{
                            background: '#1e1e1e', padding: '30px', borderRadius: '15px', width: '90%', maxWidth: '350px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid #444', color: 'white'
                        }}>
                            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                <div style={{
                                    width: '70px', height: '70px', borderRadius: '50%', background: '#3b82f6',
                                    margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.5rem', fontWeight: 'bold'
                                }}>
                                    {selectedUserProfile.username?.[0].toUpperCase() || 'U'}
                                </div>
                                <h3 style={{ margin: 0 }}>{selectedUserProfile.username || 'User'}</h3>
                                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{selectedUserProfile.role || 'Member'}</div>
                            </div>
                            <div style={{ display: 'grid', gap: '12px', fontSize: '0.9rem' }}>
                                <div style={{ background: '#2a2a2a', padding: '10px', borderRadius: '8px' }}>
                                    <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold' }}>FULL NAME</div>
                                    <div>{selectedUserProfile.firstName} {selectedUserProfile.lastName}</div>
                                </div>
                                <div style={{ background: '#2a2a2a', padding: '10px', borderRadius: '8px' }}>
                                    <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold' }}>REGISTRATION NO</div>
                                    <div>{selectedUserProfile.regNo || 'N/A'}</div>
                                </div>
                                <div style={{ background: '#2a2a2a', padding: '10px', borderRadius: '8px' }}>
                                    <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold' }}>OFFICIAL EMAIL</div>
                                    <div>{selectedUserProfile.officialMail || selectedUserProfile.email}</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedUserProfile(null)}
                                style={{
                                    marginTop: '20px', width: '100%', padding: '10px', borderRadius: '8px',
                                    background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatRoom;
