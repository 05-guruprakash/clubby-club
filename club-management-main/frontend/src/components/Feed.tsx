import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
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
}

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
    const [posts, setPosts] = useState<Post[]>([]);
    const [myTeams, setMyTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [requests, setRequests] = useState<any[]>([]);

    // Mock Posts for now (In real app, fetch from 'posts' collection)
    const mockPosts: Post[] = [
        { id: '1', content: 'Hackathon Registration closes tomorrow!', authorName: 'Dr. Smith', authorRole: 'chairperson', type: 'event', communityName: 'Official Announcements' },
        { id: '2', content: 'Robotics Club meetup at 5PM.', authorName: 'Jane Doe', authorRole: 'secretary', type: 'club', communityName: 'Robotics Club' }
    ];

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

                const allTeams = Array.from(allTeamsMap.values()) as (Team & { eventId: string })[];
                setMyTeams(allTeams.filter(t => activeEventIds.has(t.eventId)));
            } catch (e) { console.error(e); }

            // ... mock posts logic ...
            if (tab === 'events') setPosts(mockPosts.filter(p => p.type === 'event'));
            else if (tab === 'club') setPosts(mockPosts.filter(p => p.type === 'club'));
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
                        name: d.data()?.name || d.data()?.email || 'Unknown',
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
        <div>
            <h2>Feed</h2>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
                <button onClick={() => setTab('events')} style={{ fontWeight: tab === 'events' ? 'bold' : 'normal' }}>Events (Official)</button>
                <button onClick={() => setTab('team')} style={{ fontWeight: tab === 'team' ? 'bold' : 'normal' }}>My Teams</button>
                <button onClick={() => setTab('club')} style={{ fontWeight: tab === 'club' ? 'bold' : 'normal' }}>Club Community</button>
            </div>

            {tab === 'team' ? (
                <div style={{ display: 'flex', height: '80vh' }}>
                    {/* Left: Chat */}
                    <div style={{ flex: 3, borderRight: '1px solid #444', paddingRight: '20px' }}>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto' }}>
                            {myTeams.map(team => (
                                <button key={team.id} onClick={() => setSelectedTeamId(team.id)}
                                    style={{ background: selectedTeamId === team.id ? '#007bff' : '#333', color: 'white', padding: '10px', borderRadius: '5px', border: 'none' }}>
                                    {team.name}
                                </button>
                            ))}
                        </div>
                        {selectedTeamId ? <ChatRoom communityId={selectedTeamId} type="team" /> : <p>Select a team.</p>}
                    </div>

                    {/* Right: Sidebar */}
                    <div style={{ flex: 1, paddingLeft: '20px', overflowY: 'auto' }}>
                        {/* Requests Section */}
                        {requests.length > 0 && (
                            <div style={{ marginBottom: '20px', borderBottom: '1px solid #555', paddingBottom: '10px' }}>
                                <h3 style={{ color: 'orange' }}>Join Requests</h3>
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {requests.map(req => (
                                        <li key={req.id} style={{ marginBottom: '10px', background: '#f0f0f0', padding: '5px', borderRadius: '5px' }}>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{req.userName || req.userId}</div>
                                            <div style={{ marginTop: '5px', display: 'flex', gap: '5px' }}>
                                                <button onClick={() => handleAccept(req)} style={{ background: 'green', color: 'white', border: 'none', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer' }}>✓</button>
                                                <button onClick={() => handleReject(req.id)} style={{ background: 'red', color: 'white', border: 'none', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer' }}>✗</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <h3>Team Members</h3>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {teamMembers.map(m => (
                                <li key={m.uid} style={{ padding: '5px', borderBottom: '1px solid #eee' }}>{m.name} <span style={{ fontSize: '0.8rem', color: '#777' }}>({m.role})</span></li>
                            ))}
                        </ul>
                    </div>
                </div>
            ) : (
                /* Other Tabs */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {posts.map(p => (
                        <div key={p.id} style={{ border: '1px solid #eee', padding: '15px' }}>
                            <div>{p.communityName} • {p.authorName} ({p.authorRole})</div>
                            <p>{p.content}</p>
                        </div>
                    ))}
                    {posts.length === 0 && <p>No updates.</p>}
                </div>
            )}
        </div>
    );
};

export default Feed;
