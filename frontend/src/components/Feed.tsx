import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, increment, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';
import ChatRoom from './ChatRoom';

interface Post {
    id: string;
    content: string;
    authorName: string;
    authorRole: string;
    type: 'event' | 'club';
    communityName?: string;
    timestamp?: string;
}

interface Team {
    id: string;
    name: string;
    members?: string[];
    eventId: string;
    leaderId: string;
}

interface Club {
    id: string;
    name: string;
}

interface TeamMember {
    uid: string;
    name: string;
    role?: string;
}

const Feed = () => {
    const { user } = useAuth();
    const [tab, setTab] = useState<'events' | 'team' | 'club'>('events');
    const [posts, setPosts] = useState<Post[]>([]);

    // Team States
    const [myTeams, setMyTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [teamRequests, setTeamRequests] = useState<any[]>([]);
    const [currentEventName, setCurrentEventName] = useState('');

    // Club States
    const [joinedClubs, setJoinedClubs] = useState<Club[]>([]);
    const [selectedClubId, setSelectedClubId] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const qTeams = query(collection(db, 'teams'), where('members', 'array-contains', user.uid));
        const unsubTeams = onSnapshot(qTeams, (snap) => {
            setMyTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
        });

        const unsubUser = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
            if (snap.exists()) {
                const clubIds = snap.data().joined_clubs || [];
                if (clubIds.length > 0) {
                    const clubPromises = clubIds.map((id: string) => getDoc(doc(db, 'clubs', id)));
                    const clubSnaps = await Promise.all(clubPromises);
                    setJoinedClubs(clubSnaps.filter(s => s.exists()).map(s => ({ id: s.id, name: s.data()?.name || 'Unnamed' } as Club)));
                } else {
                    setJoinedClubs([]);
                }
            }
        });

        const qPosts = query(collection(db, 'posts'));
        const unsubPosts = onSnapshot(qPosts, (snap) => {
            const realPosts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
            realPosts.sort((a, b) => {
                const getT = (val: any) => {
                    if (!val) return 0;
                    if (typeof val === 'string') return new Date(val).getTime();
                    if (val.toDate) return val.toDate().getTime();
                    if (val.seconds) return val.seconds * 1000;
                    return 0;
                };
                return getT((b as any).timestamp) - getT((a as any).timestamp);
            });
            setPosts(realPosts);
        });

        return () => {
            unsubTeams();
            unsubUser();
            unsubPosts();
        };
    }, [user]);

    useEffect(() => {
        const fetchTeamDetails = async () => {
            if (!selectedTeamId || !user) return;
            const team = myTeams.find(t => t.id === selectedTeamId);
            if (!team) return;

            if (team.members) {
                const promises = team.members.map(uid => getDoc(doc(db, 'users', uid)));
                const docs = await Promise.all(promises);
                setTeamMembers(docs.map(d => ({
                    uid: d.id,
                    name: d.data()?.username || d.data()?.email || 'Unknown',
                    role: d.id === team.leaderId ? 'Leader' : 'Member'
                })));
            }

            if (team.leaderId === user.uid) {
                const q = query(collection(db, 'team_members'), where('teamId', '==', selectedTeamId), where('status', '==', 'pending'));
                const snap = await getDocs(q);
                setTeamRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } else { setTeamRequests([]); }

            const ev = await getDoc(doc(db, 'events', team.eventId));
            setCurrentEventName(ev.data()?.title || 'Event Chat');
        };

        if (tab === 'team' && selectedTeamId) fetchTeamDetails();
    }, [selectedTeamId, myTeams, tab, user]);

    const handleAcceptTeamReq = async (req: any) => {
        try {
            await updateDoc(doc(db, 'team_members', req.id), { status: 'accepted' });
            await updateDoc(doc(db, 'teams', req.teamId), {
                members: arrayUnion(req.userId),
                current_members: increment(1)
            });
            alert("Member accepted!");
        } catch (e: any) { alert(e.message); }
    };

    const handleDeleteTeam = async () => {
        if (!confirm('Delete this team?')) return;
        try {
            if (!selectedTeamId || !user) return;
            const token = await user.getIdToken();
            const response = await fetch(`http://localhost:3001/teams/${selectedTeamId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setSelectedTeamId(null);
                alert("Team deleted.");
            } else { alert("Only the leader can delete the team."); }
        } catch (e: any) { alert(e.message); }
    };

    const tabStyle = (active: boolean) => ({
        padding: '12px 24px',
        borderRadius: '12px',
        border: 'none',
        background: active ? '#1e293b' : 'transparent',
        color: active ? 'white' : '#64748b',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontSize: '0.95rem'
    });

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: '"Inter", sans-serif' }}>
            <div style={{ padding: '0 20px' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '25px', letterSpacing: '-0.5px' }}>Community Hub</h2>

                <div style={{
                    display: 'inline-flex', background: '#f1f5f9', padding: '6px',
                    borderRadius: '16px', marginBottom: '30px'
                }}>
                    <button onClick={() => setTab('events')} style={tabStyle(tab === 'events')}>Official Feed</button>
                    <button onClick={() => setTab('club')} style={tabStyle(tab === 'club')}>Club Chat</button>
                    <button onClick={() => setTab('team')} style={tabStyle(tab === 'team')}>My Teams</button>
                </div>

                {tab === 'events' && (
                    <div style={{ display: 'grid', gap: '20px', animation: 'fadeIn 0.4s ease' }}>
                        {posts.filter(p => p.type === 'event').map(p => (
                            <div key={p.id} style={{
                                background: 'white', border: '1px solid #e2e8f0',
                                padding: '24px', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>{p.authorName[0]}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{p.communityName || 'Official'}</span> • {p.authorName}
                                    </div>
                                </div>
                                <p style={{ margin: '0 0 15px 0', fontSize: '1.1rem', lineHeight: '1.6', color: '#1a1a1a' }}>{p.content}</p>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span>🕒</span> {p.timestamp ? new Date(p.timestamp).toLocaleString() : 'Just now'}
                                </div>
                            </div>
                        ))}
                        {posts.filter(p => p.type === 'event').length === 0 && (
                            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>No official announcements yet.</div>
                        )}
                    </div>
                )}

                {tab === 'club' && (
                    <div style={{ display: 'flex', gap: '30px', height: '70vh', animation: 'fadeIn 0.4s ease' }}>
                        <div style={{ width: '280px', flexShrink: 0 }}>
                            <h3 style={{ fontSize: '1rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>Joined Clubs</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {joinedClubs.map(club => (
                                    <button
                                        key={club.id}
                                        onClick={() => setSelectedClubId(club.id)}
                                        style={{
                                            textAlign: 'left', padding: '14px 18px', borderRadius: '12px',
                                            border: 'none', background: selectedClubId === club.id ? '#3b82f6' : 'white',
                                            color: selectedClubId === club.id ? 'white' : '#1e293b',
                                            cursor: 'pointer', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                            transition: 'all 0.2s', borderLeft: selectedClubId === club.id ? 'none' : '4px solid transparent'
                                        }}
                                        onMouseOver={(e) => { if (selectedClubId !== club.id) e.currentTarget.style.background = '#f8fafc'; }}
                                        onMouseOut={(e) => { if (selectedClubId !== club.id) e.currentTarget.style.background = 'white'; }}
                                    >
                                        {club.name}
                                    </button>
                                ))}
                                {joinedClubs.length === 0 && (
                                    <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Join a club to start chatting!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ flex: 1, position: 'relative' }}>
                            {selectedClubId ? (
                                <ChatRoom communityId={selectedClubId} type="club" />
                            ) : (
                                <div style={{
                                    height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    justifyContent: 'center', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0'
                                }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>💬</div>
                                    <p style={{ color: '#64748b', fontWeight: 500 }}>Select a club to join the conversation.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'team' && (
                    <div style={{ display: 'flex', gap: '30px', height: '70vh', animation: 'fadeIn 0.4s ease' }}>
                        <div style={{ flex: 3, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
                                {myTeams.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedTeamId(t.id)}
                                        style={{
                                            padding: '10px 20px', borderRadius: '20px', border: 'none',
                                            background: selectedTeamId === t.id ? '#10b981' : '#f1f5f9',
                                            color: selectedTeamId === t.id ? 'white' : '#1e293b',
                                            cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                            {selectedTeamId ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', color: '#1e293b' }}>{currentEventName}</h3>
                                    <ChatRoom communityId={selectedTeamId} type="team" />
                                </div>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '24px' }}>
                                    <p style={{ color: '#64748b' }}>Select a team to chat with your partners.</p>
                                </div>
                            )}
                        </div>
                        <div style={{ flex: 1, minWidth: '240px' }}>
                            {selectedTeamId && (
                                <div style={{ animation: 'slideInRight 0.4s ease' }}>
                                    <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>Personnel</h4>
                                    <div style={{ display: 'grid', gap: '10px' }}>
                                        {teamMembers.map(m => (
                                            <div key={m.uid} style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.role}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {teamRequests.length > 0 && (
                                        <div style={{ marginTop: '30px' }}>
                                            <h4 style={{ fontSize: '0.9rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px' }}>Pending Requests</h4>
                                            {teamRequests.map((r: any) => (
                                                <div key={r.id} style={{ border: '1px solid #fef3c7', background: '#fffbeb', padding: '12px', borderRadius: '12px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.userName}</span>
                                                    <button onClick={() => handleAcceptTeamReq(r)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Approve</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {myTeams.find(t => t.id === selectedTeamId)?.leaderId === user?.uid && (
                                        <button onClick={handleDeleteTeam} style={{ marginTop: '40px', width: '100%', padding: '14px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>
                                            Disband Team
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
            `}</style>
        </div>
    );
};

export default Feed;
