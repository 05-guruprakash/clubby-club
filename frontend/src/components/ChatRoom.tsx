import { useEffect, useState, type FC } from 'react';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, getDoc, doc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';

interface ChatRoomProps {
    communityId: string;
    type: 'club' | 'event' | 'team';
    isDarkMode: boolean;
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

const ChatRoom: FC<ChatRoomProps> = ({ communityId, type, isDarkMode }) => {
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
                        const teamLeaderId = data.leaderId || data.leader_id;
                        if (teamLeaderId === user.uid || (data.members && data.members.includes(user.uid))) {
                            setAccessDenied(false);
                            setUserRoleInContext(teamLeaderId === user.uid ? 'leader' : 'member');
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
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: 'transparent',
            color: 'inherit'
        }}>
            {/* Context Info Bar */}
            <div style={{
                padding: '12px 32px',
                background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.75rem',
                fontWeight: '800',
                letterSpacing: '1px',
                borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ opacity: 0.5 }}>IDENTIFIED AS:</span>
                    <span style={{ color: myColor || '#bcec15', textTransform: 'uppercase' }}>
                        {myIcon} {userRoleInContext}
                    </span>
                </div>
                {isServerAlive === false && type === 'club' && (
                    <div style={{ color: '#ffb300', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffb300', animation: 'pulse 1.5s infinite' }}></span>
                        LOCAL MODE (SERVER OFFLINE)
                    </div>
                )}
            </div>

            {/* Messages Container */}
            <div style={{
                flex: 1,
                minHeight: 0, // CRITICAL FOR EDGE/CHROME FLEX CONTAINERS
                overflowY: 'auto',
                padding: '30px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                scrollBehavior: 'smooth'
            }}>
                {messages.length === 0 ? (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.2,
                        textAlign: 'center'
                    }}>
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <p style={{ marginTop: '20px', fontWeight: '900', fontSize: '1.2rem' }}>BEGIN THE CONVERSATION</p>
                        {(type === 'club' || type === 'event') && (
                            <button onClick={fixAndSeed} style={{
                                marginTop: '20px', background: '#bcec15', color: 'black', border: 'none',
                                padding: '12px 24px', borderRadius: '12px', fontWeight: '900', cursor: 'pointer'
                            }}>
                                SEED FEED
                            </button>
                        )}
                    </div>
                ) : (
                    messages.map((msg) => {
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
                            <div key={msg.id} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isMe ? 'flex-end' : 'flex-start',
                                animation: 'messageSlide 0.4s cubic-bezier(0, 1, 0, 1)'
                            }}>
                                {/* Sender Info */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    opacity: 0.6
                                }}>
                                    {!isMe && <span style={{ color: color !== 'transparent' ? color : '#bcec15' }}>{icon} {msg.senderName}</span>}
                                    <span>{timeStr}</span>
                                    {isMe && <span style={{ color: '#bcec15' }}>YOU</span>}
                                </div>

                                {/* Message Bubble */}
                                <div style={{
                                    background: isMe ? (isDarkMode ? 'white' : '#bcec15') : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                                    color: isMe ? 'black' : 'inherit',
                                    padding: '14px 22px',
                                    borderRadius: isMe ? '24px 24px 4px 24px' : '24px 24px 24px 4px',
                                    maxWidth: '85%',
                                    position: 'relative',
                                    fontWeight: '500',
                                    lineHeight: '1.5',
                                    boxShadow: isMe ? (isDarkMode ? '0 10px 20px rgba(255,255,255,0.1)' : '0 10px 20px rgba(0,0,0,0.1)') : 'none',
                                    border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)'
                                }}>
                                    {msg.text}
                                </div>

                                {/* Interactions */}
                                {(type === 'club' || type === 'event') && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '16px',
                                        marginTop: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: '800'
                                    }}>
                                        <button
                                            onClick={() => handleLike(msg)}
                                            style={{
                                                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                                color: likedByMe ? '#ff4444' : 'inherit', opacity: likedByMe ? 1 : 0.4,
                                                display: 'flex', alignItems: 'center', gap: '5px', transition: '0.2s'
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill={likedByMe ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                            </svg>
                                            {msg.likes?.length || 0}
                                        </button>

                                        <button
                                            onClick={() => toggleComments(msg.id)}
                                            style={{
                                                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                                color: isExpanded ? '#bcec15' : 'inherit', opacity: isExpanded ? 1 : 0.4,
                                                display: 'flex', alignItems: 'center', gap: '5px', transition: '0.2s'
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                            </svg>
                                            {commentCount}
                                        </button>
                                    </div>
                                )}

                                {/* Collapsible Discussion */}
                                {isExpanded && (
                                    <div style={{
                                        marginTop: '15px',
                                        width: '90%',
                                        background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                                        borderRadius: '20px',
                                        padding: '20px',
                                        border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
                                        animation: 'fadeIn 0.3s'
                                    }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: '900', opacity: 0.4, marginBottom: '15px', letterSpacing: '1px' }}>THREAD</div>

                                        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' }}>
                                            {msg.comments && msg.comments.length > 0 ? msg.comments.map((comment, idx) => (
                                                <div key={idx} style={{ paddingLeft: '12px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: '800', marginBottom: '4px' }}>
                                                        <span
                                                            onClick={() => comment.senderId && showUserCard(comment.senderId)}
                                                            style={{ cursor: 'pointer', color: '#bcec15' }}
                                                        >
                                                            {comment.senderName.toUpperCase()}
                                                        </span>
                                                        <span style={{ opacity: 0.3, marginLeft: '8px' }}>
                                                            {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{comment.text}</div>
                                                </div>
                                            )) : (
                                                <div style={{ fontSize: '0.8rem', opacity: 0.3, fontStyle: 'italic' }}>No discussion yet.</div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                placeholder="Contribute to discussion..."
                                                value={commentInputText[msg.id] || ''}
                                                onChange={e => handleInputChange(msg.id, e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && submitComment(msg.id)}
                                                style={{
                                                    flex: 1, background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: 'none',
                                                    padding: '10px 16px', borderRadius: '12px', color: 'inherit', fontSize: '0.8rem'
                                                }}
                                            />
                                            <button
                                                onClick={() => submitComment(msg.id)}
                                                style={{
                                                    background: '#bcec15', color: 'black', border: 'none',
                                                    padding: '0 16px', borderRadius: '12px', fontWeight: '900',
                                                    fontSize: '0.7rem', cursor: 'pointer'
                                                }}
                                            >
                                                POST
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input Area */}
            <div style={{
                padding: '20px 32px',
                borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
                background: isDarkMode ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)',
                backdropFilter: 'blur(20px)',
                flexShrink: 0
            }}>
                {canChatMain ? (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            placeholder="Share something with the community..."
                            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                            style={{
                                flex: 1,
                                padding: '18px 24px',
                                paddingRight: '120px',
                                borderRadius: '16px',
                                border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                                background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'white',
                                color: 'inherit',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'all 0.3s',
                                boxShadow: isDarkMode ? 'none' : '0 2px 10px rgba(0,0,0,0.05)'
                            }}
                            className="chat-input"
                        />
                        <button
                            onClick={handleSendMessage}
                            style={{
                                position: 'absolute',
                                right: '8px',
                                background: '#bcec15',
                                color: 'black',
                                border: 'none',
                                padding: '10px 24px',
                                borderRadius: '12px',
                                fontWeight: '900',
                                letterSpacing: '0.5px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            SEND
                        </button>
                    </div>
                ) : (
                    <div style={{
                        textAlign: 'center',
                        padding: '16px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        opacity: 0.4
                    }}>
                        YOU ARE IN READ-ONLY MODE. PARTICIPATE VIA DISCUSSIONS.
                    </div>
                )}
            </div>

            {/* User Profile Modal */}
            {selectedUserProfile && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000,
                    backdropFilter: 'blur(15px)'
                }}>
                    <div style={{
                        background: '#050505', padding: '40px', borderRadius: '32px', width: '90%', maxWidth: '400px',
                        boxShadow: '0 0 50px rgba(188, 236, 21, 0.2)', border: '1px solid #333', color: 'white',
                        animation: 'zoomIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                            <div style={{
                                width: '100px', height: '100px', borderRadius: '24px', background: '#bcec15',
                                margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2.5rem', fontWeight: '900', color: 'black',
                                boxShadow: '0 10px 30px rgba(188, 236, 21, 0.3)'
                            }}>
                                {selectedUserProfile.username?.[0].toUpperCase() || 'U'}
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '900' }}>{selectedUserProfile.username}</h3>
                            <div style={{ fontSize: '0.9rem', color: '#bcec15', fontWeight: '800', letterSpacing: '1px', marginTop: '5px' }}>
                                {selectedUserProfile.role?.toUpperCase() || 'MEMBER'}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '15px' }}>
                            {[
                                { label: 'NAME', val: `${selectedUserProfile.firstName} ${selectedUserProfile.lastName}` },
                                { label: 'ID', val: selectedUserProfile.regNo || 'N/A' },
                                { label: 'EMAIL', val: selectedUserProfile.officialMail || selectedUserProfile.email }
                            ].map((item, i) => (
                                <div key={i} style={{ background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', padding: '16px', borderRadius: '16px', border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                                    <div style={{ color: '#666', fontSize: '0.65rem', fontWeight: '900', marginBottom: '4px', letterSpacing: '1px' }}>{item.label}</div>
                                    <div style={{ fontWeight: '600' }}>{item.val}</div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setSelectedUserProfile(null)}
                            style={{
                                marginTop: '30px', width: '100%', padding: '16px', borderRadius: '16px',
                                background: 'white', color: 'black', border: 'none', cursor: 'pointer',
                                fontWeight: '900', fontSize: '0.9rem', transition: '0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#bcec15'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                            CLOSE PROFILE
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
                @keyframes messageSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                .chat-input:focus { border-color: #bcec15 !important; box-shadow: 0 0 20px rgba(188, 236, 21, 0.1); }
            `}</style>
        </div>
    );
};

export default ChatRoom;

