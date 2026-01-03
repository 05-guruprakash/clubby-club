import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
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

const Feed = ({ isDarkMode }: { isDarkMode: boolean }) => {
    const { user } = useAuth();
    const [tab, setTab] = useState<'events' | 'team' | 'club'>('events');
    const [myTeams, setMyTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    // Requests removed from here - managed in Discover.tsx only
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

            // 1. Fetch Members Optimized
            if (team && team.members && Array.isArray(team.members) && team.members.length > 0) {
                try {
                    // Sanitize IDs: Remove duplicates and ensure valid strings
                    const uniqueIds = [...new Set(team.members)].filter(id => id && typeof id === 'string');

                    if (uniqueIds.length === 0) {
                        setTeamMembers([]);
                        return;
                    }

                    // Use '__name__' instead of documentId() for better compatibility
                    // Limit to 10 for absolute safety across all SDK versions
                    const qMembers = query(collection(db, 'users'), where('__name__', 'in', uniqueIds.slice(0, 10)));
                    const docsSnap = await getDocs(qMembers);

                    const membersData = docsSnap.docs.map(d => ({
                        uid: d.id,
                        name: d.data()?.username || d.data()?.email || 'Unknown',
                        role: d.id === (team as any).leaderId ? 'Leader' : 'Member'
                    }));
                    setTeamMembers(membersData);
                } catch (e) {
                    console.error("Member fetch error:", e);
                    setTeamMembers([]);
                }
            } else {
                setTeamMembers([]);
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



    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', minHeight: '90vh' }}>
            {/* Header Section */}
            <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{
                        margin: 0,
                        fontSize: '3rem',
                        fontWeight: '900',
                        letterSpacing: '-2px',
                        lineHeight: '1',
                        color: 'inherit'
                    }}>
                        FEED<span style={{ color: '#bcec15' }}>.</span>
                    </h1>
                    <p style={{ margin: '10px 0 0 0', opacity: 0.5, fontWeight: '500', fontSize: '1.1rem' }}>
                        Stay synced with your teams and community.
                    </p>
                </div>

                {/* Minimalist Tab Switcher */}
                <div style={{
                    display: 'flex',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '6px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(10px)'
                }}>
                    {[
                        {
                            id: 'events', label: 'OFFICIAL', icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
                                </svg>
                            )
                        },
                        {
                            id: 'team', label: 'MY TEAMS', icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            )
                        },
                        {
                            id: 'club', label: 'COMMUNITY', icon: (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
                                </svg>
                            )
                        }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as any)}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '12px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '900',
                                letterSpacing: '1px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                background: tab === t.id ? '#bcec15' : 'transparent',
                                color: tab === t.id ? 'black' : 'inherit',
                                opacity: tab === t.id ? 1 : 0.5,
                                transform: tab === t.id ? 'scale(1.05)' : 'scale(1)'
                            }}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB CONTENT: MY TEAMS */}
            {tab === 'team' && (
                <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '30px', height: 'calc(100vh - 280px)', minHeight: '600px' }}>
                    {/* Left Panel: Team List & Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{
                            background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                            borderRadius: '24px',
                            padding: '24px',
                            border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                            flex: 1,
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: '800', letterSpacing: '-0.5px' }}>YOUR TEAMS</h3>
                            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {myTeams.length > 0 ? myTeams.map(team => (
                                    <button
                                        key={team.id}
                                        onClick={() => setSelectedTeamId(team.id)}
                                        style={{
                                            padding: '16px',
                                            borderRadius: '16px',
                                            border: '1px solid',
                                            borderColor: selectedTeamId === team.id ? '#bcec15' : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                                            background: selectedTeamId === team.id ? 'rgba(188, 236, 21, 0.1)' : (isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                                            color: selectedTeamId === team.id ? '#bcec15' : 'inherit',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <span style={{ fontWeight: '700' }}>{team.name}</span>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                )) : (
                                    <p style={{ opacity: 0.4, textAlign: 'center', marginTop: '40px' }}>No teams found.</p>
                                )}
                            </div>
                        </div>

                        {selectedTeamId && (
                            <div style={{
                                background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                                borderRadius: '24px',
                                padding: '24px',
                                border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)'
                            }}>
                                <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', fontWeight: '800', opacity: 0.7 }}>MEMBERS</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {teamMembers.map(m => (
                                        <div key={m.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.role === 'Leader' ? '#bcec15' : '#444' }}></div>
                                                <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{m.name}</span>
                                            </div>
                                            {(myTeams.find(t => t.id === selectedTeamId)?.leaderId || (myTeams.find(t => t.id === selectedTeamId) as any)?.leader_id) === user?.uid && m.uid !== user?.uid && (
                                                <button
                                                    onClick={() => handleRemoveMember(m.uid)}
                                                    style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                                                >
                                                    REMOVE
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {(myTeams.find(t => t.id === selectedTeamId)?.leaderId || (myTeams.find(t => t.id === selectedTeamId) as any)?.leader_id) === user?.uid && (
                                    <button
                                        onClick={handleDeleteTeam}
                                        style={{
                                            marginTop: '30px',
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '12px',
                                            background: isDarkMode ? 'rgba(255,68,68,0.1)' : 'rgba(255,68,68,0.05)',
                                            color: '#ff4444',
                                            border: isDarkMode ? '1px solid rgba(255,68,68,0.2)' : '1px solid rgba(255,68,68,0.3)',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        DISBAND TEAM
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div style={{
                        background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                        borderRadius: '32px',
                        border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        height: '100%'
                    }}>
                        {selectedTeamId ? (
                            <>
                                <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', letterSpacing: '-0.5px' }}>{myTeams.find(t => t.id === selectedTeamId)?.name}</h2>
                                        <p style={{ margin: '4px 0 0 0', opacity: 0.4, fontSize: '0.85rem', fontWeight: '600' }}>EVENT: {currentEventName.toUpperCase()}</p>
                                    </div>
                                    <div style={{ padding: '8px 16px', background: 'rgba(188, 236, 21, 0.1)', color: '#bcec15', borderRadius: '50px', fontSize: '0.75rem', fontWeight: '900' }}>
                                        ACTIVE CHAT
                                    </div>
                                </div>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <ChatRoom communityId={selectedTeamId} type="team" isDarkMode={isDarkMode} />
                                </div>
                            </>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <p style={{ marginTop: '20px', fontWeight: '700' }}>Select a team to start collaborating</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: OFFICIAL EVENTS */}
            {tab === 'events' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', height: '75vh' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '32px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        {/* Sub-Tabs for Event Feed */}
                        <div style={{
                            padding: '24px 32px',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            overflowX: 'auto',
                            gap: '20px'
                        }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => setSelectedEventTab('all')}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: '800',
                                        background: selectedEventTab === 'all' ? '#bcec15' : 'rgba(255,255,255,0.05)',
                                        color: selectedEventTab === 'all' ? 'black' : 'inherit',
                                        transition: '0.2s'
                                    }}
                                >
                                    GLOBAL ANNOUNCEMENTS
                                </button>
                                {joinedEvents.map(ev => (
                                    <button
                                        key={ev.id}
                                        onClick={() => setSelectedEventTab(ev.id)}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '12px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem',
                                            fontWeight: '800',
                                            background: selectedEventTab === ev.id ? '#bcec15' : 'rgba(255,255,255,0.05)',
                                            color: selectedEventTab === ev.id ? 'black' : 'inherit',
                                            transition: '0.2s',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {ev.title.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: '900', opacity: 0.4, letterSpacing: '1px' }}>
                                {selectedEventTab === 'all' ? 'GENERAL FEED' : 'DISCUSSION BOARD'}
                            </div>
                        </div>

                        <div style={{ flex: 1, position: 'relative' }}>
                            <ChatRoom
                                key={selectedEventTab}
                                communityId={selectedEventTab === 'all' ? 'official_event_feed' : selectedEventTab}
                                type="event"
                                isDarkMode={isDarkMode}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: COMMUNITY */}
            {tab === 'club' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', height: '75vh' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '32px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', letterSpacing: '-0.5px' }}>CLUB COMMUNITY</h2>
                                <p style={{ margin: '4px 0 0 0', opacity: 0.4, fontSize: '0.85rem', fontWeight: '600' }}>NETWORK WITH MEMBERS ACROSS ALL CLUBS</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6 }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#bcec15', boxShadow: '0 0 10px #bcec15' }}></div>
                                <span style={{ fontSize: '0.7rem', fontWeight: '900' }}>LIVE CHAT</span>
                            </div>
                        </div>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <ChatRoom communityId="global_club_community" type="club" isDarkMode={isDarkMode} />
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                ::-webkit-scrollbar {
                    width: 6px;
                }
                ::-webkit-scrollbar-track {
                    background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.2);
                }
            `}</style>
        </div>
    );
};

export default Feed;

