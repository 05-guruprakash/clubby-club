import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, increment, onSnapshot } from 'firebase/firestore';
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

        // 1. Teams Listener
        const qTeams = query(collection(db, 'teams'), where('members', 'array-contains', user.uid));
        const unsubTeams = onSnapshot(qTeams, async (snap) => {
            const teamsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
            setMyTeams(teamsData);
        });

        // 2. Clubs Listener (via User Doc)
        const unsubUser = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
            if (snap.exists()) {
                const clubIds = snap.data().joined_clubs || [];
                if (clubIds.length > 0) {
                    const clubPromises = clubIds.map((id: string) => getDoc(doc(db, 'clubs', id)));
                    const clubSnaps = await Promise.all(clubPromises);
                    const clubList = clubSnaps.filter(s => s.exists()).map(s => ({ id: s.id, name: s.data()?.name || 'Unnamed' } as Club));
                    setJoinedClubs(clubList);
                } else {
                    setJoinedClubs([]);
                }
            }
        });

        // 3. Posts Listener
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

    // Fetch Details when team selected
    useEffect(() => {
        const fetchTeamDetails = async () => {
            if (!selectedTeamId || !user) return;
            const team = myTeams.find(t => t.id === selectedTeamId);
            if (!team) return;

            // Members
            if (team.members) {
                const promises = team.members.map(uid => getDoc(doc(db, 'users', uid)));
                const docs = await Promise.all(promises);
                setTeamMembers(docs.map(d => ({
                    uid: d.id,
                    name: d.data()?.username || d.data()?.email || 'Unknown',
                    role: d.id === team.leaderId ? 'Leader' : 'Member'
                })));
            }

            // Requests
            if (team.leaderId === user.uid) {
                const q = query(collection(db, 'team_members'), where('teamId', '==', selectedTeamId), where('status', '==', 'pending'));
                const snap = await getDocs(q);
                setTeamRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } else {
                setTeamRequests([]);
            }

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
            const response = await fetch(`http://localhost:3000/teams/${selectedTeamId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setSelectedTeamId(null);
                alert("Team deleted.");
            } else {
                alert("Only the leader can delete the team.");
            }
        } catch (e: any) { alert(e.message); }
    };

    return (
        <div style={{ padding: '0 20px' }}>
            <h2>Community Hub</h2>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
                <button onClick={() => setTab('events')} style={{ fontWeight: tab === 'events' ? 'bold' : 'normal', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>Official Feed</button>
                <button onClick={() => setTab('club')} style={{ fontWeight: tab === 'club' ? 'bold' : 'normal', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>Club Chat</button>
                <button onClick={() => setTab('team')} style={{ fontWeight: tab === 'team' ? 'bold' : 'normal', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>My Teams</button>
            </div>

            {tab === 'events' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {posts.filter(p => p.type === 'event').map(p => (
                        <div key={p.id} style={{ border: '1px solid #eee', padding: '15px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>{p.communityName || 'Official'} • {p.authorName}</div>
                            <p style={{ margin: '10px 0', fontSize: '1.1rem' }}>{p.content}</p>
                            <div style={{ fontSize: '0.75rem', color: '#999' }}>{p.timestamp ? new Date(p.timestamp).toLocaleString() : ''}</div>
                        </div>
                    ))}
                    {posts.length === 0 && <p>Connecting to feed...</p>}
                </div>
            )}

            {tab === 'club' && (
                <div style={{ display: 'flex', height: '70vh' }}>
                    <div style={{ width: '250px', borderRight: '1px solid #eee', paddingRight: '20px' }}>
                        <h3>Joined Clubs</h3>
                        {joinedClubs.map(club => (
                            <button key={club.id} onClick={() => setSelectedClubId(club.id)}
                                style={{
                                    width: '100%', textAlign: 'left', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: 'none',
                                    background: selectedClubId === club.id ? '#007bff' : '#f0f0f0', color: selectedClubId === club.id ? 'white' : 'black', cursor: 'pointer'
                                }}>
                                {club.name}
                            </button>
                        ))}
                        {joinedClubs.length === 0 && <p style={{ fontSize: '0.9rem', color: '#666' }}>Join a club to start chatting!</p>}
                    </div>
                    <div style={{ flex: 1, paddingLeft: '20px' }}>
                        {selectedClubId ? (
                            <ChatRoom communityId={selectedClubId} type="club" />
                        ) : <p style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>Select a club to join the conversation.</p>}
                    </div>
                </div>
            )}

            {tab === 'team' && (
                <div style={{ display: 'flex', height: '70vh' }}>
                    <div style={{ flex: 3, paddingRight: '20px', borderRight: '1px solid #eee' }}>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto' }}>
                            {myTeams.map(t => (
                                <button key={t.id} onClick={() => setSelectedTeamId(t.id)}
                                    style={{ padding: '10px 15px', borderRadius: '20px', border: 'none', background: selectedTeamId === t.id ? '#28a745' : '#eee', color: selectedTeamId === t.id ? 'white' : 'black', cursor: 'pointer' }}>
                                    {t.name}
                                </button>
                            ))}
                            {myTeams.length === 0 && <p>No active teams.</p>}
                        </div>
                        {selectedTeamId ? (
                            <>
                                <h3 style={{ margin: '0 0 10px 0', color: '#555' }}>{currentEventName}</h3>
                                <ChatRoom communityId={selectedTeamId} type="team" />
                            </>
                        ) : <p>Select a team to chat with your partners.</p>}
                    </div>
                    <div style={{ flex: 1, paddingLeft: '20px' }}>
                        {selectedTeamId && (
                            <>
                                <h4>Personnel</h4>
                                <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
                                    {teamMembers.map(m => (
                                        <div key={m.uid} style={{ marginBottom: '5px', fontSize: '0.9rem' }}>
                                            {m.name} <span style={{ color: '#888' }}>({m.role})</span>
                                        </div>
                                    ))}
                                </div>
                                {teamRequests.length > 0 && (
                                    <div style={{ marginTop: '20px' }}>
                                        <h4 style={{ color: 'orange' }}>Requests</h4>
                                        {teamRequests.map((r: any) => (
                                            <div key={r.id} style={{ border: '1px solid #eee', padding: '5px', borderRadius: '5px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{r.userName}</span>
                                                <button onClick={() => handleAcceptTeamReq(r)} style={{ color: 'green', border: 'none', background: 'none', cursor: 'pointer' }}>✓</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {myTeams.find(t => t.id === selectedTeamId)?.leaderId === user?.uid && (
                                    <button onClick={handleDeleteTeam} style={{ marginTop: '30px', width: '100%', padding: '10px', background: 'darkred', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                                        Disband Team
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Feed;
