import { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, getDoc, query, where, updateDoc, doc, arrayUnion, increment, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';

interface Event {
    id: string;
    title: string;
    description: string;
    date?: string;
    time?: string;
    venue?: string;
    maxTeamMembers?: number;
    posterUrl?: string;
}

interface Team {
    id: string;
    name: string;
    description: string;
    leaderId: string;
    isFull?: boolean;
    current_members?: number;
    eventId?: string;
    members?: string[];
}

interface TeamRequest {
    id: string; // doc id
    userId: string;
    userName?: string; // Opt
    status: 'pending' | 'accepted' | 'rejected';
    // New fields for join form
    reason?: string;
    skills?: string;
    bio?: string;
}

const Discover = () => {
    const { user } = useAuth();

    // Helper to handle both strings and Firebase Timestamps safely
    const formatValue = (val: any) => {
        if (!val) return 'TBD';
        if (typeof val === 'string') return val;
        if (val.toDate) return val.toDate().toLocaleDateString();
        if (val.seconds) return new Date(val.seconds * 1000).toLocaleDateString();
        return String(val);
    };

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

    // Join Team Request Form State
    const [showTeamJoinForm, setShowTeamJoinForm] = useState(false);
    const [joiningTeamTarget, setJoiningTeamTarget] = useState<Team | null>(null);
    const [joinTeamFormData, setJoinTeamFormData] = useState({ reason: '', skills: '', bio: '' });

    // Calendar Integration Logic
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdTeamLink, setCreatedTeamLink] = useState('');

    const parseEventDate = (dateStr?: string, timeStr?: string) => {
        if (!dateStr) return new Date(); // Fallback to now
        try {
            const d = new Date(dateStr);
            if (timeStr) {
                const [hours, minutes] = timeStr.split(':').map(Number);
                if (!isNaN(hours) && !isNaN(minutes)) {
                    d.setHours(hours, minutes);
                }
            }
            return d;
        } catch (e) { return new Date(); }
    };

    const downloadICS = (event: Event) => {
        const startDate = parseEventDate(event.date as string, event.time as string);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Assume 1 hour duration

        const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, "");

        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Clubby//Clubby Events//EN
BEGIN:VEVENT
UID:${event.id}@clubby.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.title}
DESCRIPTION:${event.description}
LOCATION:${event.venue || 'TBD'}
BEGIN:VALARM
TRIGGER:-P2D
ACTION:DISPLAY
DESCRIPTION:Reminder: ${event.title} in 2 days
END:VALARM
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Reminder: ${event.title} tomorrow
END:VALARM
BEGIN:VALARM
TRIGGER:-PT5H
ACTION:DISPLAY
DESCRIPTION:Reminder: ${event.title} in 5 hours
END:VALARM
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Reminder: ${event.title} in 1 hour
END:VALARM
END:VEVENT
END:VCALENDAR`;

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const addToGoogleCalendar = (event: Event) => {
        const startDate = parseEventDate(event.date as string, event.time as string);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

        const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, "");

        const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.venue || '')}&sf=true&output=xml`;
        window.open(url, '_blank');
    };

    useEffect(() => {
        const q = query(collection(db, 'events'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
            setEvents(eventList);
        });
        return () => unsubscribe();
    }, []);

    const fetchTeams = async (eventId: string) => {
        try {
            const q = query(collection(db, 'teams'), where('eventId', '==', eventId));
            const querySnapshot = await getDocs(q);
            const teamsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));

            // Separate my team from others (Handling both leaderId and leader_id for compatibility)
            const myOwnedTeam = teamsData.find(t => (t.leaderId || (t as any).leader_id) === user?.uid);
            setMyTeam(myOwnedTeam || null);

            // Fetch Event to get Max Members
            const eventDoc = await getDoc(doc(db, 'events', eventId));
            const maxMembers = eventDoc.data()?.maxTeamMembers || 3;

            // Filter for public list (not full, and not my own team ideally)
            setTeams(teamsData.filter(t => {
                const memberCount = t.current_members || t.members?.length || 0;
                // STRICT CHECK: Hide if full
                if (memberCount >= maxMembers) return false;

                return t.id !== myOwnedTeam?.id;
            }));

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
            // 0. Fetch LATEST Team Data (Concurrency Safety)
            const teamRef = doc(db, 'teams', myTeam.id);
            const teamSnap = await getDoc(teamRef);
            if (!teamSnap.exists()) return;
            const teamData = teamSnap.data();
            const currentMembers = teamData.members || [];

            // 1. Check Redundancy
            if (currentMembers.includes(req.userId)) {
                alert("User is already in the team.");
                // Just mark request as accepted to clear it
                await updateDoc(doc(db, 'team_members', req.id), { status: 'accepted' });
                fetchRequests(myTeam.id);
                return;
            }

            // 2. Get Event Data to check limits
            const eventSnap = await getDoc(doc(db, 'events', myTeam.eventId!));
            const maxMembers = eventSnap.data()?.maxTeamMembers || 3;

            if (currentMembers.length >= maxMembers) {
                alert(`Team is full! Maximum ${maxMembers} members allowed.`);
                return;
            }

            // 3. Update Request Status
            await updateDoc(doc(db, 'team_members', req.id), { status: 'accepted' });

            // 4. Add user to Team members array and increment count
            await updateDoc(teamRef, {
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
                leader_id: user.uid, // Dual support for legacy backend checks
                eventId: selectedEventId,
                current_members: 1,
                members: [user.uid], // Keeping redundant array for easy querying if needed
                shareableLink: '', // Will update after ID creation
                isFull: false
            };

            console.log("Attempting to create team doc in Firestore...");
            const docRef = await addDoc(collection(db, 'teams'), newTeam);

            // Generate Link
            const shareLink = `${window.location.origin}/join/${docRef.id}`;
            // Ideally update the doc with the link, but for now just showing it.

            setCreatedTeamLink(shareLink);
            setShowSuccessModal(true); // Show success modal with Calendar options

            setTeamName('');
            setTeamDesc('');
            setTeamPic('');
            fetchTeams(selectedEventId);
        } catch (e: any) {
            console.error("Error creating team:", e);
            alert(`Failed to create team: ${e.message.includes('permission') ? 'Database permissions denied' : e.message}`);
        }
    };

    const checkAlreadyInTeam = async (eventId: string) => {
        if (!user) return false;
        // Check if I am leader or member of any team for this event
        const q = query(collection(db, 'teams'), where('eventId', '==', eventId), where('members', 'array-contains', user.uid));
        const snap = await getDocs(q);
        return !snap.empty;
    };

    const handleCreateTeamWrapped = async () => {
        if (!selectedEventId) return;
        const already = await checkAlreadyInTeam(selectedEventId);
        if (already) {
            alert("You are already in a team for this event!");
            return;
        }
        handleCreateTeam();
    };

    const openJoinForm = (team: Team) => {
        setJoiningTeamTarget(team);
        setShowTeamJoinForm(true);
    };

    const submitTeamJoinForm = async () => {
        if (!joiningTeamTarget) return;
        if (!joinTeamFormData.reason || !joinTeamFormData.skills || !joinTeamFormData.bio) {
            alert("Please fill in all fields to send a request.");
            return;
        }

        // Call handleJoinTeam with explicit form data
        await handleJoinTeam(joiningTeamTarget.id, joinTeamFormData);

        // Reset and close
        setShowTeamJoinForm(false);
        setJoiningTeamTarget(null);
        setJoinTeamFormData({ reason: '', skills: '', bio: '' });
    };

    const handleJoinTeam = async (teamIdFromInput: string, formData?: { reason: string, skills: string, bio: string }) => {
        let targetId = teamIdFromInput || joinTeamId;
        if (!user || !targetId) return;

        // Sanitize
        targetId = targetId.trim();
        if (targetId.includes('/join/')) {
            targetId = targetId.split('/join/')[1];
        } else if (targetId.includes('/')) {
            const parts = targetId.split('/');
            targetId = parts[parts.length - 1];
        }

        try {
            // Check if already in a team for this event
            // Need team data to know eventId
            const teamDoc = await getDoc(doc(db, 'teams', targetId));
            if (!teamDoc.exists()) { alert("Team not found"); return; }

            const eventId = teamDoc.data().eventId;
            if (eventId) {
                const already = await checkAlreadyInTeam(eventId);
                if (already) {
                    alert("You are already in a team for this event!");
                    return;
                }
            }

            const requestData = {
                teamId: targetId,
                userId: user.uid,
                userName: user.displayName || user.email || 'Anonymous',
                status: 'pending',
                timestamp: new Date().toISOString(),
                // Include form data if available (Manual entry sends without these)
                ...(formData || {})
            };

            await addDoc(collection(db, 'team_members'), requestData);
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
                        <div style={{ display: 'flex', gap: '20px', marginBottom: '15px', color: '#ccc', fontSize: '0.9rem' }}>
                            <span>📅 {formatValue(event.date)}</span>
                            <span>⏰ {formatValue(event.time)}</span>
                            <span>📍 {formatValue(event.venue)}</span>
                        </div>
                        <p style={{ maxWidth: '600px', textAlign: 'center' }}>{event.description}</p>
                        <div style={{ marginTop: '10px', color: 'gold', fontSize: '0.85rem' }}>
                            Limit: {event.maxTeamMembers || 3} members per team
                        </div>
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
                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => addToGoogleCalendar(event)}
                                style={{ background: 'transparent', border: '1px solid #777', color: '#ccc', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                                + Google Calendar
                            </button>
                            <button
                                onClick={() => downloadICS(event)}
                                style={{ background: 'transparent', border: '1px solid #777', color: '#ccc', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                                + Download Reminder (.ics)
                            </button>
                        </div>
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
                                                <li key={req.id} style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                        <span style={{ fontWeight: 'bold' }}>{req.userName || req.userId}</span>
                                                        <div>
                                                            <button onClick={() => handleAcceptRequest(req)} style={{ color: '#4ade80', marginRight: '10px', background: 'transparent', border: '1px solid #4ade80', borderRadius: '4px', cursor: 'pointer' }}>Accept</button>
                                                            <button onClick={() => handleRejectRequest(req.id)} style={{ color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer' }}>Reject</button>
                                                        </div>
                                                    </div>
                                                    {/* Show Application Details if available */}
                                                    {req.reason && (
                                                        <div style={{ fontSize: '0.85rem', color: '#ccc', marginTop: '5px', paddingLeft: '10px', borderLeft: '2px solid #555' }}>
                                                            <div><strong>Bio:</strong> {req.bio}</div>
                                                            <div><strong>Skills:</strong> {req.skills}</div>
                                                            <div><strong>Why:</strong> {req.reason}</div>
                                                        </div>
                                                    )}
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
                                    <button onClick={handleCreateTeamWrapped} style={{ width: '100%', padding: '10px', background: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}>
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
                                                    <button onClick={() => openJoinForm(t)} style={{ padding: '5px 10px', fontSize: '0.8rem' }}>
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
            {/* SUCCESS / CALENDAR PROMPT MODAL */}
            {showSuccessModal && selectedEventId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.9)', color: 'white',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
                }}>
                    <div style={{
                        background: '#222', padding: '40px', borderRadius: '20px', textAlign: 'center',
                        maxWidth: '500px', border: '1px solid #444', boxShadow: '0 0 30px rgba(0,255,100,0.2)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '20px' }}>✅</div>
                        <h2 style={{ color: '#4ade80', marginTop: 0 }}>You're In!</h2>
                        <p>Team created successfully. Good luck!</p>

                        <div style={{ background: '#333', padding: '15px', borderRadius: '10px', margin: '20px 0', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                            {createdTeamLink}
                        </div>
                        <p style={{ fontSize: '0.9rem', color: '#aaa' }}>Share this link with your teammates.</p>

                        <div style={{ marginTop: '30px', borderTop: '1px solid #444', paddingTop: '20px' }}>
                            <h3 style={{ fontSize: '1.2rem', margin: '0 0 15px 0' }}>🗓️ Set Your Reminders</h3>
                            <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '20px' }}>
                                Add this event to your calendar to get notified 2 days, 24h, 5h, and 1h before the event.
                            </p>
                            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                                {events.find(e => e.id === selectedEventId) && (
                                    <>
                                        <button
                                            onClick={() => addToGoogleCalendar(events.find(e => e.id === selectedEventId)!)}
                                            style={{
                                                padding: '12px 20px', background: '#3b82f6', color: 'white', border: 'none',
                                                borderRadius: '8px', cursor: 'pointer', fontWeight: 600
                                            }}
                                        >
                                            Google Calendar
                                        </button>
                                        <button
                                            onClick={() => downloadICS(events.find(e => e.id === selectedEventId)!)}
                                            style={{
                                                padding: '12px 20px', background: '#22c55e', color: 'white', border: 'none',
                                                borderRadius: '8px', cursor: 'pointer', fontWeight: 600
                                            }}
                                        >
                                            Download .ICS
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => setShowSuccessModal(false)}
                            style={{
                                marginTop: '30px', background: 'transparent', color: '#888', border: 'none',
                                cursor: 'pointer', textDecoration: 'underline'
                            }}
                        >
                            Close & Continue
                        </button>
                    </div>
                </div>
            )}
            {/* JOIN TEAM FORM MODAL */}
            {showTeamJoinForm && joiningTeamTarget && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.9)', color: 'white',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
                }}>
                    <div style={{
                        background: '#222', padding: '30px', borderRadius: '15px',
                        width: '90%', maxWidth: '500px', border: '1px solid #444'
                    }}>
                        <h3 style={{ marginTop: 0 }}>Join Request: {joiningTeamTarget.name}</h3>
                        <p style={{ fontSize: '0.9rem', color: '#ccc' }}>Please tell the team leader why you'd be a good fit.</p>

                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Short Bio</label>
                        <input
                            value={joinTeamFormData.bio}
                            onChange={e => setJoinTeamFormData({ ...joinTeamFormData, bio: e.target.value })}
                            placeholder="I am a frontend dev..."
                            style={{ width: '100%', padding: '8px', marginBottom: '15px', background: '#333', border: '1px solid #555', color: 'white' }}
                        />

                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Top Skills</label>
                        <input
                            value={joinTeamFormData.skills}
                            onChange={e => setJoinTeamFormData({ ...joinTeamFormData, skills: e.target.value })}
                            placeholder="React, Python, Design..."
                            style={{ width: '100%', padding: '8px', marginBottom: '15px', background: '#333', border: '1px solid #555', color: 'white' }}
                        />

                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Reason for joining</label>
                        <textarea
                            value={joinTeamFormData.reason}
                            onChange={e => setJoinTeamFormData({ ...joinTeamFormData, reason: e.target.value })}
                            placeholder="I want to win because..."
                            style={{ width: '100%', padding: '8px', marginBottom: '20px', minHeight: '80px', background: '#333', border: '1px solid #555', color: 'white' }}
                        />

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowTeamJoinForm(false)}
                                style={{ background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitTeamJoinForm}
                                style={{ background: '#3b82f6', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Send Request
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default Discover;
