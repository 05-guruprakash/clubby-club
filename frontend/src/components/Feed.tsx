import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';
import ChatRoom from './ChatRoom';

interface Team {
    id: string;
    name: string;
    members?: string[]; // Array of UIDs
    eventId: string;
    leaderId: string;
}

interface TeamMember {
    uid: string;
    name: string;
    role?: string;
}

const Feed = () => {
    const { user } = useAuth();
    const [tab, setTab] = useState<'events' | 'team' | 'club'>('events');
    const [myTeams, setMyTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [currentEventName, setCurrentEventName] = useState('');
    const [selectedEventTab, setSelectedEventTab] = useState<'all' | string>('all');
    const [joinedEvents, setJoinedEvents] = useState<{ id: string, title: string }[]>([]);

    useEffect(() => {
        if (!user) return;

        const loadFeed = async () => {
            try {
                // Fetch Events
                const eventsSnap = await getDocs(collection(db, 'events'));
                const activeEventIds = new Set(eventsSnap.docs.filter(d => d.data().status !== 'completed').map(d => d.id));

                // Fetch Teams
                const qLeader = query(collection(db, 'teams'), where('leaderId', '==', user.uid));
                const snapLeader = await getDocs(qLeader);
                const qMember = query(collection(db, 'teams'), where('members', 'array-contains', user.uid));
                const snapMember = await getDocs(qMember);

                const allTeamsMap = new Map();
                snapLeader.docs.forEach(d => allTeamsMap.set(d.id, { id: d.id, ...d.data() }));
                snapMember.docs.forEach(d => allTeamsMap.set(d.id, { id: d.id, ...d.data() }));

                const allTeams = Array.from(allTeamsMap.values()).map(t => ({
                    ...t,
                    leaderId: t.leaderId || t.leader_id
                })) as (Team & { eventId: string })[];
                setMyTeams(allTeams.filter(t => activeEventIds.has(t.eventId)));

                // Populate Joined Events for specific tabs
                const joinedEvs: { id: string, title: string }[] = [];
                for (const team of allTeams) {
                    if (activeEventIds.has(team.eventId)) {
                        const evSnap = await getDoc(doc(db, 'events', team.eventId));
                        if (evSnap.exists() && !joinedEvs.find(e => e.id === team.eventId)) {
                            joinedEvs.push({ id: team.eventId, title: evSnap.data().title });
                        }
                    }
                }
                setJoinedEvents(joinedEvs);
            } catch (e) { console.error(e); }
        };
        loadFeed();
    }, [user, tab]);

    // Fetch Members & Requests
    useEffect(() => {
        const fetchDetails = async () => {
            if (!selectedTeamId || !user) return;
            const team = myTeams.find(t => t.id === selectedTeamId);

            // 1. Fetch Members
            if (team && team.members && team.members.length > 0) {
                try {
                    const promises = team.members.map(uid => getDoc(doc(db, 'users', uid)));
                    const docs = await Promise.all(promises);
                    const membersData = docs.map(d => ({
                        uid: d.id,
                        name: d.data()?.username || d.data()?.email || 'Unknown',
                        role: d.id === (team as any).leaderId ? 'Leader' : 'Member'
                    }));
                    setTeamMembers(membersData);
                } catch (e) { console.error(e); }
            } else {
                setTeamMembers([]);
            }

            // 2. Fetch Requests (If Leader)
            if (team && team.leaderId === user.uid) {
                try {
                    const q = query(collection(db, 'team_members'), where('teamId', '==', selectedTeamId), where('status', '==', 'pending'));
                    const snap = await getDocs(q);
                    const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setRequests(reqs);
                } catch (e) { console.error(e); }
            } else {
                setRequests([]);
            }
        };

        if (tab === 'team' && selectedTeamId) {
            fetchDetails();
        }
    }, [selectedTeamId, myTeams, tab, user]);

    useEffect(() => {
        const loadEventName = async () => {
            if (!selectedTeamId) return;
            const team = myTeams.find(t => t.id === selectedTeamId);
            if (team) {
                const ev = await getDoc(doc(db, 'events', team.eventId));
                setCurrentEventName(ev.data()?.title || '');
            }
        };
        loadEventName();
    }, [selectedTeamId, myTeams]);

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm('Remove this member?')) return;
        try {
            const team = myTeams.find(t => t.id === selectedTeamId);
            if (!team) return;

            await updateDoc(doc(db, 'teams', team.id), {
                members: team.members?.filter(m => m !== memberId),
                current_members: increment(-1)
            });

            setTeamMembers(prev => prev.filter(m => m.uid !== memberId));
        } catch (e) { console.error(e); }
    };

    const handleDeleteTeam = async () => {
        if (!confirm('🛑 WARNING: This will permanently delete the team, all members, and all chat history. Continue?')) return;

        try {
            if (!selectedTeamId || !user) {
                alert("Session error: Missing team or user identity.");
                return;
            }

            // Client-side safety: Only leader can initiate
            const team = myTeams.find(t => t.id === selectedTeamId);
            const teamLeaderId = team?.leaderId || (team as any)?.leader_id;

            if (teamLeaderId !== user.uid) {
                alert("Only the team leader can disband the team.");
                return;
            }

            console.log("Stage 1: Attempting backend disband...");
            const token = await user.getIdToken();
            const response = await fetch(`http://localhost:3001/teams/${selectedTeamId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                alert("✅ Team disbanded successfully via server.");
                setSelectedTeamId(null);
                setMyTeams(prev => prev.filter(t => t.id !== selectedTeamId));
                return;
            }

            // Stage 2: Fallback to Direct Firestore if backend fails
            const errorData = await response.json().catch(() => ({}));
            console.warn("Backend disband failed, attempting direct Firestore fallback...", errorData.error);

            await deleteDoc(doc(db, 'teams', selectedTeamId));

            alert("✅ Team disbanded (Direct Mode). Cloud records updated successfully.");
            setSelectedTeamId(null);
            setMyTeams(prev => prev.filter(t => t.id !== selectedTeamId));

        } catch (e: any) {
            console.error("Critical Disband Failure:", e);
            alert(`Could not disband team: ${e.message || 'Unknown error'}`);
        }
    };

    const handleAccept = async (req: any) => {
        try {
            await updateDoc(doc(db, 'team_members', req.id), { status: 'accepted' });
            await updateDoc(doc(db, 'teams', req.teamId), {
                members: arrayUnion(req.userId),
                current_members: increment(1)
            });
            alert("Accepted!");
            setRequests(prev => prev.filter(r => r.id !== req.id));
        } catch (e) { console.error(e); }
    };

    const handleReject = async (reqId: string) => {
        try {
            await updateDoc(doc(db, 'team_members', reqId), { status: 'rejected' });
            alert("Rejected.");
            setRequests(prev => prev.filter(r => r.id !== reqId));
        } catch (e) { console.error(e); }
    };

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', color: 'white' }}>
            {/* Main Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 style={{
                    margin: 0,
                    fontSize: '2.5rem',
                    fontWeight: 900,
                    background: 'linear-gradient(135deg, #fff 0%, #aaa 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    Community Feed
                </h1>
            </div>

            {/* Main Navigation Tabs */}
            <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '30px',
                padding: '10px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.05)',
                backdropFilter: 'blur(10px)',
                width: 'fit-content'
            }}>
                {[
                    { id: 'events', label: 'Events (Official)', icon: '🎪' },
                    { id: 'team', label: 'My Teams', icon: '👥' },
                    { id: 'club', label: 'Club Community', icon: '🏢' }
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id as any)}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '14px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            background: tab === t.id ? 'linear-gradient(135deg, #646cff 0%, #4a51e6 100%)' : 'transparent',
                            color: tab === t.id ? 'white' : '#888',
                            boxShadow: tab === t.id ? '0 10px 20px rgba(100, 108, 255, 0.4)' : 'none',
                            transform: tab === t.id ? 'translateY(-2px)' : 'none'
                        }}
                    >
                        <span>{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'team' ? (
                <div style={{
                    display: 'flex',
                    height: '82vh',
                    background: '#121212',
                    borderRadius: '24px',
                    padding: '25px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    overflow: 'hidden'
                }}>
                    {/* Left: Chat */}
                    <div style={{ flex: 3, borderRight: '1px solid #444', paddingRight: '20px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
                            {myTeams.map(team => (
                                <button key={team.id} onClick={() => setSelectedTeamId(team.id)}
                                    style={{ background: selectedTeamId === team.id ? '#007bff' : '#333', color: 'white', padding: '10px', borderRadius: '5px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    {team.name}
                                </button>
                            ))}
                        </div>
                        {selectedTeamId ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <h3 style={{ marginTop: 0, color: '#aaa' }}>{currentEventName}</h3>
                                <ChatRoom communityId={selectedTeamId} type="team" />
                            </div>
                        ) : <p style={{ color: '#888' }}>Select a team to start chatting.</p>}
                    </div>

                    {/* Right: Sidebar */}
                    <div style={{ flex: 1, paddingLeft: '20px', overflowY: 'auto' }}>
                        {/* Requests Section */}
                        {requests.length > 0 && (
                            <div style={{ marginBottom: '20px', borderBottom: '1px solid #555', paddingBottom: '10px' }}>
                                <h3 style={{ color: 'orange' }}>Join Requests</h3>
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {requests.map(req => (
                                        <li key={req.id} style={{ marginBottom: '10px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'white' }}>{req.userName || req.userId}</div>
                                            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                                <button onClick={() => handleAccept(req)} style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Accept</button>
                                                <button onClick={() => handleReject(req.id)} style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Reject</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <h3 style={{ color: 'white' }}>Team Members</h3>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {teamMembers.map(m => (
                                <li key={m.uid} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#ccc' }}>
                                    <span>{m.name} <span style={{ fontSize: '0.75rem', color: '#666' }}>({m.role})</span></span>
                                    {(myTeams.find(t => t.id === selectedTeamId)?.leaderId || (myTeams.find(t => t.id === selectedTeamId) as any)?.leader_id) === user?.uid && m.uid !== user?.uid && (
                                        <button onClick={() => handleRemoveMember(m.uid)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>Remove</button>
                                    )}
                                </li>
                            ))}
                        </ul>
                        {(myTeams.find(t => t.id === selectedTeamId)?.leaderId || (myTeams.find(t => t.id === selectedTeamId) as any)?.leader_id) === user?.uid && (
                            <button onClick={handleDeleteTeam} style={{ marginTop: '20px', background: '#450a0a', color: '#f87171', border: '1px solid #7f1d1d', padding: '10px', width: '100%', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                Delete Team
                            </button>
                        )}
                    </div>
                </div>
            ) : tab === 'events' ? (
                <div style={{
                    height: '82vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#121212',
                    borderRadius: '24px',
                    padding: '25px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    {/* Premium Header with Glassmorphism Navigation */}
                    <div style={{
                        marginBottom: '25px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: '2rem',
                                fontWeight: 800,
                                background: 'linear-gradient(to right, #646cff, #9f7aea)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}>
                                Event Hub
                            </h2>
                            {selectedEventTab === 'all' && (
                                <button
                                    onClick={() => alert("To seed messages, click the 'DEBUG: Fix & Seed' button at the bottom of the chat room if it appears empty!")}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: '#aaa',
                                        padding: '5px 12px',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    💡 Need Test Data?
                                </button>
                            )}
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            overflowX: 'auto',
                            padding: '8px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '16px',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <button
                                onClick={() => setSelectedEventTab('all')}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: selectedEventTab === 'all' ? 'linear-gradient(135deg, #646cff 0%, #4a51e6 100%)' : 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    boxShadow: selectedEventTab === 'all' ? '0 8px 15px rgba(100, 108, 255, 0.3)' : 'none',
                                    transform: selectedEventTab === 'all' ? 'translateY(-2px)' : 'none',
                                    minWidth: '120px'
                                }}
                            >
                                🌎 Global Feed
                            </button>
                            {joinedEvents.map(ev => (
                                <button
                                    key={ev.id}
                                    onClick={() => setSelectedEventTab(ev.id)}
                                    style={{
                                        padding: '10px 22px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        transition: 'all 0.3s ease',
                                        background: selectedEventTab === ev.id ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.05)',
                                        color: 'white',
                                        boxShadow: selectedEventTab === ev.id ? '0 8px 15px rgba(16, 185, 129, 0.2)' : 'none',
                                        transform: selectedEventTab === ev.id ? 'translateY(-2px)' : 'none',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    🎯 {ev.title}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        borderRadius: '20px',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.03)'
                    }}>
                        <div style={{
                            padding: '12px 20px',
                            background: 'rgba(255,255,255,0.02)',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <div style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: selectedEventTab === 'all' ? '#646cff' : '#10b981',
                                boxShadow: `0 0 10px ${selectedEventTab === 'all' ? '#646cff' : '#10b981'}`
                            }}></div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#eee' }}>
                                {selectedEventTab === 'all' ? 'Official Announcements' : `Discussion: ${joinedEvents.find(e => e.id === selectedEventTab)?.title}`}
                            </span>
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <ChatRoom
                                key={selectedEventTab}
                                communityId={selectedEventTab === 'all' ? 'official_event_feed' : selectedEventTab}
                                type="event"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{
                    height: '82vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#121212',
                    borderRadius: '24px',
                    padding: '25px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    overflow: 'hidden'
                }}>
                    <h3 style={{
                        borderLeft: '4px solid #10b981',
                        paddingLeft: '15px',
                        color: '#10b981',
                        marginTop: 0,
                        marginBottom: '20px',
                        fontSize: '1.5rem'
                    }}>
                        Club Community Chat
                    </h3>
                    <div style={{ flex: 1, overflow: 'hidden', borderRadius: '20px', background: 'rgba(0,0,0,0.2)' }}>
                        <ChatRoom communityId="global_club_community" type="club" />
                    </div>
                </div>
            )}
        </div>
    );
};


export default Feed;
