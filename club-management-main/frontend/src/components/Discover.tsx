import { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';

interface Event {
    id: string;
    title: string;
    description: string;
    posterUrl?: string; // Optional poster
}

interface Team {
    id: string;
    name: string;
    description: string;
    leaderId: string;
    isFull?: boolean;
    current_members?: number;
    eventId?: string;
}

interface TeamRequest {
    id: string; // doc id
    userId: string;
    userName?: string; // Opt
    status: 'pending' | 'accepted' | 'rejected';
}

const Discover = () => {
    const { user } = useAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [showMatchmaker, setShowMatchmaker] = useState(false);

    // My Team & Requests
    const [myTeam, setMyTeam] = useState<Team | null>(null);
    const [requests, setRequests] = useState<TeamRequest[]>([]);

    // Create Team State
    const [teamName, setTeamName] = useState('');
    const [teamDesc, setTeamDesc] = useState(''); // New
    const [teamPic, setTeamPic] = useState('');   // New

    // Join Team State
    const [joinTeamId, setJoinTeamId] = useState('');

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const q = query(collection(db, 'events'));
                const snapshot = await getDocs(q);
                const eventList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
                setEvents(eventList);
            } catch (err) {
                console.error("Error fetching events:", err);
            }
        };
        fetchEvents();
    }, []);

    const fetchTeams = async (eventId: string) => {
        try {
            const q = query(collection(db, 'teams'), where('eventId', '==', eventId));
            const querySnapshot = await getDocs(q);
            const teamsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));

            // Separate my team from others
            const myOwnedTeam = teamsData.find(t => t.leaderId === user?.uid);
            setMyTeam(myOwnedTeam || null);

            // Filter for public list (not full, and not my own team ideally)
            setTeams(teamsData.filter(t => !t.isFull && t.id !== myOwnedTeam?.id));

            if (myOwnedTeam) {
                fetchRequests(myOwnedTeam.id);
            }
        } catch (err) {
            console.error("Error fetching teams:", err);
        }
    };

    const fetchRequests = async (teamId: string) => {
        try {
            const q = query(collection(db, 'team_members'), where('teamId', '==', teamId), where('status', '==', 'pending'));
            const snap = await getDocs(q);
            const reqs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamRequest));
            setRequests(reqs);
        } catch (e) {
            console.error("Error fetching requests:", e);
        }
    };

    const handleAcceptRequest = async (req: TeamRequest) => {
        if (!myTeam) return;
        try {
            // 1. Update Request Status
            await updateDoc(doc(db, 'team_members', req.id), { status: 'accepted' });
            // 2. Add user to Team members array and increment count
            await updateDoc(doc(db, 'teams', myTeam.id), {
                members: arrayUnion(req.userId),
                current_members: increment(1)
            });
            alert("Member accepted!");
            fetchRequests(myTeam.id);
        } catch (e) {
            console.error("Error accepting:", e);
            alert("Failed to accept.");
        }
    };

    const handleRejectRequest = async (reqId: string) => {
        try {
            await updateDoc(doc(db, 'team_members', reqId), { status: 'rejected' });
            alert("Member rejected.");
            if (myTeam) fetchRequests(myTeam.id);
        } catch (e) {
            console.error("Error rejecting:", e);
        }
    };

    const openMatchmaker = (eventId: string) => {
        setSelectedEventId(eventId);
        setShowMatchmaker(true);
        fetchTeams(eventId);
    };

    const handleCreateTeam = async () => {
        if (!user || !selectedEventId || !teamName.trim()) return;
        try {
            const newTeam = {
                name: teamName,
                description: teamDesc,
                profile_pic: teamPic,
                leaderId: user.uid,
                eventId: selectedEventId,
                current_members: 1,
                members: [user.uid], // Keeping redundant array for easy querying if needed
                shareableLink: '', // Will update after ID creation
                isFull: false
            };

            const docRef = await addDoc(collection(db, 'teams'), newTeam);

            // Generate Link
            const shareLink = `${window.location.origin}/join/${docRef.id}`;
            // Ideally update the doc with the link, but for now just showing it.

            alert(`Team Created! Share this link: ${shareLink}`);

            setTeamName('');
            setTeamDesc('');
            setTeamPic('');
            fetchTeams(selectedEventId);
        } catch (e) {
            console.error("Error creating team:", e);
            alert("Failed to create team.");
        }
    };

    const handleJoinTeam = async (teamIdFromInput: string) => {
        let targetId = teamIdFromInput || joinTeamId;
        if (!user || !targetId) return;

        // Sanitize: If user pasted a URL, extract the last part
        targetId = targetId.trim();
        if (targetId.includes('/join/')) {
            targetId = targetId.split('/join/')[1];
        } else if (targetId.includes('/')) {
            const parts = targetId.split('/');
            targetId = parts[parts.length - 1];
        }

        try {
            await addDoc(collection(db, 'team_members'), {
                teamId: targetId,
                userId: user.uid,
                userName: user.displayName || user.email || 'Anonymous',
                status: 'pending',
                timestamp: new Date().toISOString()
            });
            alert(`Request sent to join team ${targetId}`);
            setJoinTeamId('');
        } catch (e) {
            console.error("Error joining team:", e);
            alert("Failed to send join request.");
        }
    };

    return (
        <div style={{
            height: '100vh',
            overflowY: 'scroll',
            scrollSnapType: 'y mandatory',
            scrollBehavior: 'smooth',
            position: 'relative'
        }}>
            {/* Top Right Request Notification */}
            {myTeam && requests.length > 0 && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    zIndex: 2000,
                    backgroundColor: '#ff4444',
                    color: 'white',
                    padding: '10px 15px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                    fontWeight: 'bold'
                }} onClick={() => myTeam.eventId && openMatchmaker(myTeam.eventId)}>
                    🔔 {requests.length} Request{requests.length > 1 ? 's' : ''}
                </div>
            )}

            {events.length === 0 ? (
                <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <p>No events found. (Or loading...)</p>
                </div>
            ) : (
                events.map(event => (
                    <div key={event.id} style={{
                        height: '100vh',
                        width: '100%',
                        scrollSnapAlign: 'start',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderBottom: '1px solid #444',
                        background: '#1a1a1a', // Dark theme placeholder
                        color: 'white',
                        position: 'relative'
                    }}>
                        <h1>{event.title}</h1>
                        <p style={{ maxWidth: '600px', textAlign: 'center' }}>{event.description}</p>
                        <button
                            onClick={() => openMatchmaker(event.id)}
                            style={{
                                marginTop: '20px',
                                padding: '15px 30px',
                                fontSize: '1.2rem',
                                cursor: 'pointer',
                                background: '#646cff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px'
                            }}
                        >
                            Register
                        </button>
                    </div>
                ))
            )}

            {/* Matchmaker Modal */}
            {showMatchmaker && selectedEventId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.9)', color: 'white',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: '#333',
                        padding: '30px',
                        borderRadius: '15px',
                        width: '90%',
                        maxWidth: '600px',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>Registration</h2>
                            <button onClick={() => setShowMatchmaker(false)} style={{ background: 'transparent', border: '1px solid #777', color: 'white', cursor: 'pointer' }}>Close</button>
                        </div>

                        <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>

                            {/* My Team Section */}
                            {myTeam ? (
                                <div style={{ border: '1px solid gold', padding: '20px', borderRadius: '10px' }}>
                                    <h3>Manage My Team: {myTeam.name}</h3>
                                    <p>Members: {myTeam.current_members}</p>
                                    <h4>Pending Requests</h4>
                                    {requests.length === 0 ? <p>No pending requests.</p> : (
                                        <ul>
                                            {requests.map(req => (
                                                <li key={req.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                    <span>{req.userName || req.userId}</span>
                                                    <div>
                                                        <button onClick={() => handleAcceptRequest(req)} style={{ color: 'green', marginRight: '5px' }}>Accept</button>
                                                        <button onClick={() => handleRejectRequest(req.id)} style={{ color: 'red' }}>Reject</button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ) : (
                                /* Create Team Section */
                                <div style={{ border: '1px solid #555', padding: '20px', borderRadius: '10px' }}>
                                    <h3>Create a Team</h3>
                                    <input
                                        placeholder="Team Name"
                                        value={teamName}
                                        onChange={e => setTeamName(e.target.value)}
                                        style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
                                    />
                                    <textarea
                                        placeholder="Team Description"
                                        value={teamDesc}
                                        onChange={e => setTeamDesc(e.target.value)}
                                        style={{ width: '100%', padding: '10px', marginBottom: '10px', minHeight: '60px' }}
                                    />
                                    <input
                                        placeholder="Profile Pic URL (Optional)"
                                        value={teamPic}
                                        onChange={e => setTeamPic(e.target.value)}
                                        style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
                                    />
                                    <button onClick={handleCreateTeam} style={{ width: '100%', padding: '10px', background: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}>
                                        Create Team
                                    </button>
                                </div>
                            )}

                            {/* Join Team Section - Only show if not in a team (simplified) */}
                            {!myTeam && (
                                <div style={{ border: '1px solid #555', padding: '20px', borderRadius: '10px' }}>
                                    <h3>Join a Team</h3>
                                    {teams.length > 0 ? (
                                        <ul style={{ listStyle: 'none', padding: 0, maxHeight: '150px', overflowY: 'auto', marginBottom: '10px' }}>
                                            {teams.map(t => (
                                                <li key={t.id} style={{ padding: '10px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <strong>{t.name}</strong>
                                                        <div style={{ fontSize: '0.8rem', color: '#ccc' }}>{t.description}</div>
                                                    </div>
                                                    <button onClick={() => handleJoinTeam(t.id)} style={{ padding: '5px 10px', fontSize: '0.8rem' }}>
                                                        Req. Join
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p style={{ fontStyle: 'italic', color: '#888' }}>No teams available to join.</p>
                                    )}

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            placeholder="Or enter Team ID manually"
                                            value={joinTeamId}
                                            onChange={e => setJoinTeamId(e.target.value)}
                                            style={{ flex: 1, padding: '10px' }}
                                        />
                                        <button onClick={() => handleJoinTeam(joinTeamId)} style={{ padding: '10px' }}>Send Request</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={() => setShowMatchmaker(false)} style={{ marginTop: '20px', background: 'red', color: 'white', border: 'none', padding: '10px', cursor: 'pointer', width: '100%' }}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Discover;
