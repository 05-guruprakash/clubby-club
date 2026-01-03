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
            if (isNaN(d.getTime())) return new Date(); // Invalid date check
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
        if (isNaN(startDate.getTime())) {
            alert('Invalid event date');
            return;
        }
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
        if (isNaN(startDate.getTime())) {
            alert('Invalid event date');
            return;
        }
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

    // --- RENDER HELPERS ---

    // Generate a consistent gradient based on event ID to make it look distinct but thematic
    const getGradient = (id: string) => {
        const colors = [
            'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', // Deep Purple
            'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #434343 100%)', // Charcoal
            'linear-gradient(135deg, #16222a 0%, #3a6073 100%)', // Cool Blue
            'linear-gradient(135deg, #1f4037 0%, #99f2c8 100%)', // Volt-ish Green darker
        ];
        const index = id.charCodeAt(0) % colors.length;
        return colors[index];
    };

    return (
        <div style={{
            height: '100%', // Take full available height from parent
            overflowY: 'scroll',
            scrollSnapType: 'y mandatory', // strict snapping
            scrollBehavior: 'smooth',
            background: 'transparent',
            color: 'inherit',
            scrollbarWidth: 'none',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            // Removed padding and gap for true full screen
            padding: 0,
            gap: 0,
        }}>
            {/* Top Right Request Notification - Floating nicely */}
            {myTeam && requests.length > 0 && (
                <div
                    onClick={() => myTeam.eventId && openMatchmaker(myTeam.eventId)}
                    style={{
                        position: 'fixed',
                        top: '80px',
                        right: '30px',
                        zIndex: 2000,
                        background: 'rgba(239, 68, 68, 0.9)',
                        backdropFilter: 'blur(10px)',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '30px',
                        cursor: 'pointer',
                        boxShadow: '0 10px 30px rgba(239, 68, 68, 0.4)',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        animation: 'pulse 2s infinite'
                    }}
                >
                    <span style={{ fontSize: '1.2rem' }}>🔔</span>
                    <span>{requests.length} Request{requests.length > 1 ? 's' : ''} Pending</span>
                </div>
            )}

            {events.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #bcec15', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: '#666' }}>Finding events...</p>
                </div>
            ) : (
                events.map(event => (
                    <div key={event.id} style={{
                        height: '100%', // Strict full height
                        width: '100%',
                        flexShrink: 0,
                        scrollSnapAlign: 'start', // Align to start of viewport
                        position: 'relative',
                        display: 'flex',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        margin: 0 // No margins
                    }}>
                        {/* 1. Background Layer with Parallax using fixed attachment */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            background: event.posterUrl ? `url(${event.posterUrl}) center/cover no-repeat fixed` : getGradient(event.id), // 'fixed' creates the parallax
                            backgroundAttachment: 'fixed', // Explicitly set for parallax
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: event.posterUrl ? 'brightness(0.5)' : 'none',
                            zIndex: 1
                        }} />

                        {/* 2. Gradient Overlay */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(to top, #000 0%, transparent 100%)',
                            zIndex: 2
                        }} />

                        {/* 3. Main Content Content */}
                        <div style={{
                            position: 'relative',
                            zIndex: 3,
                            width: '100%',
                            maxWidth: '1200px',
                            height: '100%',
                            padding: '60px 40px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            boxSizing: 'border-box'
                        }}>
                            {/* Top Content: Title & Meta */}
                            <div style={{ marginBottom: 'auto', paddingTop: '40px' }}>
                                <div style={{
                                    display: 'inline-block',
                                    padding: '8px 20px',
                                    background: 'rgba(188, 236, 21, 0.15)',
                                    border: '1px solid #bcec15',
                                    borderRadius: '30px',
                                    color: '#bcec15',
                                    fontWeight: 'bold',
                                    marginBottom: '20px',
                                    fontSize: '0.9rem',
                                    letterSpacing: '2px',
                                    textTransform: 'uppercase'
                                }}>
                                    Upcoming Event
                                </div>
                                <h1 style={{
                                    fontSize: '6rem', // Even bigger
                                    fontWeight: '900',
                                    margin: '0 0 10px 0',
                                    lineHeight: 0.9,
                                    textShadow: '0 10px 40px rgba(0,0,0,0.8)',
                                    letterSpacing: '-3px'
                                }}>
                                    {event.title.toUpperCase()}
                                </h1>
                                <p style={{
                                    fontSize: '1.3rem',
                                    color: 'rgba(255,255,255,0.85)',
                                    maxWidth: '700px',
                                    marginBottom: '40px',
                                    lineHeight: '1.5'
                                }}>
                                    {event.description}
                                </p>
                            </div>


                            {/* Bottom Content: Layout Row */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'space-between',
                                paddingBottom: '40px', // More padding from bottom
                                flexWrap: 'wrap',
                                gap: '30px'
                            }}>
                                {/* Left Side Details */}
                                <div style={{ display: 'flex', gap: '50px', fontSize: '1.2rem', color: 'rgba(255,255,255,0.9)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Date</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
                                            <span style={{ color: '#bcec15' }}>📅</span> {formatValue(event.date)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Time</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
                                            <span style={{ color: '#bcec15' }}>⏰</span> {formatValue(event.time)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Location</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
                                            <span style={{ color: '#bcec15' }}>📍</span> {formatValue(event.venue)}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Actions (Bottom Horizontal) */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '20px' }}>
                                    {/* Register Button (Prominent) */}
                                    <button
                                        onClick={() => openMatchmaker(event.id)}
                                        style={{
                                            padding: '20px 50px',
                                            borderRadius: '50px',
                                            background: '#bcec15',
                                            color: 'black',
                                            border: 'none',
                                            fontSize: '1.2rem',
                                            fontWeight: '900',
                                            cursor: 'pointer',
                                            boxShadow: '0 0 50px rgba(188, 236, 21, 0.5)',
                                            transition: 'transform 0.2s',
                                            textTransform: 'uppercase',
                                            letterSpacing: '1px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        Register Event ➔
                                    </button>

                                    {/* Expanded Action Buttons Row */}
                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        {[
                                            { label: 'Add to Calendar', action: () => addToGoogleCalendar(event) },
                                            { label: 'Add to Outlook', action: () => downloadICS(event) },
                                            { label: `Max Members: ${event.maxTeamMembers || 3}`, action: () => { } }
                                        ].map((btn, idx) => (
                                            <button
                                                key={idx}
                                                onClick={btn.action}
                                                style={{
                                                    padding: '12px 20px',
                                                    borderRadius: '30px', // Pill shape
                                                    background: 'rgba(255,255,255,0.1)',
                                                    backdropFilter: 'blur(10px)',
                                                    border: '1px solid rgba(255,255,255,0.2)',
                                                    color: 'white',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px'
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = 'black'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                                            >
                                                {btn.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))
            )}

            {/* Matchmaker Modal - Styled Dark/Volt */}
            {showMatchmaker && selectedEventId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    backdropFilter: 'blur(20px)',
                    color: 'white',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 3000
                }}>
                    <div style={{
                        background: '#111',
                        border: '1px solid #333',
                        padding: '40px',
                        borderRadius: '24px',
                        width: '90%',
                        maxWidth: '600px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '800' }}>REGISTRATION</h2>
                            <button onClick={() => setShowMatchmaker(false)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.5rem' }}>✕</button>
                        </div>

                        {/* ... Existing logic for Teams kept, just container styled above ... */}
                        {/* Wrapper for the complex logical content below to keep it neat but styled */}
                        <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>

                            {/* My Team Section */}
                            {myTeam ? (
                                <div style={{ border: '1px solid #333', background: '#1a1a1a', padding: '25px', borderRadius: '16px' }}>
                                    <h3 style={{ color: '#bcec15', margin: '0 0 10px 0' }}>{myTeam.name}</h3>
                                    <p style={{ color: '#888', margin: 0 }}>Members: {myTeam.current_members} / 3</p>

                                    <h4 style={{ marginTop: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Pending Requests</h4>
                                    {requests.length === 0 ? <p style={{ color: '#666', fontStyle: 'italic' }}>No pending requests.</p> : (
                                        <ul style={{ listStyle: 'none', padding: 0 }}>
                                            {requests.map(req => (
                                                <li key={req.id} style={{ display: 'flex', flexDirection: 'column', marginTop: '10px', background: '#222', padding: '15px', borderRadius: '12px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{req.userName || req.userId}</span>
                                                        <div style={{ display: 'flex', gap: '10px' }}>
                                                            <button onClick={() => handleAcceptRequest(req)} style={{ color: 'black', background: '#bcec15', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Accept</button>
                                                            <button onClick={() => handleRejectRequest(req.id)} style={{ color: 'white', background: '#333', border: '1px solid #444', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Reject</button>
                                                        </div>
                                                    </div>
                                                    {req.reason && (
                                                        <div style={{ fontSize: '0.9rem', color: '#aaa', marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                                            <div style={{ marginBottom: '4px' }}><strong style={{ color: '#666' }}>Role:</strong> {req.bio}</div>
                                                            <div style={{ marginBottom: '4px' }}><strong style={{ color: '#666' }}>Skills:</strong> {req.skills}</div>
                                                            <div><strong style={{ color: '#666' }}>Why:</strong> {req.reason}</div>
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ) : (
                                /* Create Team Section */
                                <div style={{ border: '1px dashed #444', padding: '25px', borderRadius: '16px' }}>
                                    <h3 style={{ marginTop: 0 }}>Create a Team</h3>
                                    <input
                                        placeholder="Team Name"
                                        value={teamName}
                                        onChange={e => setTeamName(e.target.value)}
                                        style={{ width: '100%', padding: '15px', marginBottom: '15px', background: '#222', border: '1px solid #333', borderRadius: '12px', color: 'white', outline: 'none' }}
                                    />
                                    <textarea
                                        placeholder="Team Description"
                                        value={teamDesc}
                                        onChange={e => setTeamDesc(e.target.value)}
                                        style={{ width: '100%', padding: '15px', marginBottom: '15px', minHeight: '80px', background: '#222', border: '1px solid #333', borderRadius: '12px', color: 'white', outline: 'none', fontFamily: 'inherit' }}
                                    />
                                    <input
                                        placeholder="Profile Pic URL (Optional)"
                                        value={teamPic}
                                        onChange={e => setTeamPic(e.target.value)}
                                        style={{ width: '100%', padding: '15px', marginBottom: '20px', background: '#222', border: '1px solid #333', borderRadius: '12px', color: 'white', outline: 'none' }}
                                    />
                                    <button onClick={handleCreateTeamWrapped} style={{ width: '100%', padding: '15px', background: 'white', color: 'black', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '900', fontSize: '1rem', textTransform: 'uppercase' }}>
                                        Create Team
                                    </button>
                                </div>
                            )}

                            {/* Join Team Section */}
                            {!myTeam && (
                                <div style={{ borderTop: '1px solid #333', paddingTop: '20px' }}>
                                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', color: '#888' }}>or Join Existing Team</h3>
                                    {teams.length > 0 ? (
                                        <ul style={{ listStyle: 'none', padding: 0, maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                                            {teams.map(t => (
                                                <li key={t.id} style={{ padding: '15px', background: '#1a1a1a', marginBottom: '10px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <strong style={{ display: 'block', fontSize: '1.1rem' }}>{t.name}</strong>
                                                        <span style={{ fontSize: '0.9rem', color: '#666' }}>{t.description}</span>
                                                    </div>
                                                    <button onClick={() => openJoinForm(t)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                                        Join
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p style={{ fontStyle: 'italic', color: '#444', textAlign: 'center', margin: '20px 0' }}>No open teams found.</p>
                                    )}

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            placeholder="Enter Team ID manually"
                                            value={joinTeamId}
                                            onChange={e => setJoinTeamId(e.target.value)}
                                            style={{ flex: 1, padding: '12px', background: '#222', border: '1px solid #333', borderRadius: '10px', color: 'white' }}
                                        />
                                        <button onClick={() => handleJoinTeam(joinTeamId)} style={{ padding: '12px 20px', background: '#333', color: 'white', border: '1px solid #444', borderRadius: '10px', cursor: 'pointer' }}>Search</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* KEEPING SUCCESS MODAL & JOIN FORM MODAL WITH UPDATED STYLING BELOW */}
            {/* SUCCESS / CALENDAR PROMPT MODAL */}
            {showSuccessModal && selectedEventId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.9)', color: 'white',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
                }}>
                    <div style={{
                        background: '#111', padding: '50px', borderRadius: '30px', textAlign: 'center',
                        maxWidth: '500px', border: '1px solid #333', boxShadow: '0 0 50px rgba(188, 236, 21, 0.2)'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px', color: '#bcec15' }}>✅</div>
                        <h2 style={{ color: 'white', marginTop: 0, fontSize: '2rem' }}>YOU'RE IN!</h2>
                        <p style={{ color: '#888' }}>Team created successfully. Good luck!</p>

                        <div style={{ background: '#222', padding: '20px', borderRadius: '15px', margin: '30px 0', wordBreak: 'break-all', fontFamily: 'monospace', color: '#bcec15', border: '1px dashed #444' }}>
                            {createdTeamLink}
                        </div>
                        <p style={{ fontSize: '0.9rem', color: '#666' }}>Share this link with your teammates.</p>

                        <button
                            onClick={() => setShowSuccessModal(false)}
                            style={{
                                marginTop: '40px', background: 'white', color: 'black', border: 'none',
                                cursor: 'pointer', padding: '15px 40px', borderRadius: '50px', fontWeight: 'bold'
                            }}
                        >
                            CONTINUE
                        </button>
                    </div>
                </div>
            )}

            {/* JOIN TEAM FORM MODAL */}
            {showTeamJoinForm && joiningTeamTarget && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.95)', color: 'white',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
                }}>
                    <div style={{
                        background: '#111', padding: '40px', borderRadius: '24px',
                        width: '90%', maxWidth: '500px', border: '1px solid #333'
                    }}>
                        <h3 style={{ marginTop: 0, fontSize: '1.8rem' }}>Join <span style={{ color: '#bcec15' }}>{joiningTeamTarget.name}</span></h3>
                        <p style={{ fontSize: '1rem', color: '#666', marginBottom: '30px' }}>Tell them why you're a good fit.</p>

                        <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 'bold', color: '#888' }}>SHORT BIO</label>
                        <input
                            value={joinTeamFormData.bio}
                            onChange={e => setJoinTeamFormData({ ...joinTeamFormData, bio: e.target.value })}
                            placeholder="I am a frontend dev..."
                            style={{ width: '100%', padding: '15px', marginBottom: '20px', background: '#222', border: '1px solid #333', borderRadius: '12px', color: 'white', outline: 'none' }}
                        />

                        <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 'bold', color: '#888' }}>TOP SKILLS</label>
                        <input
                            value={joinTeamFormData.skills}
                            onChange={e => setJoinTeamFormData({ ...joinTeamFormData, skills: e.target.value })}
                            placeholder="React, Python, Design..."
                            style={{ width: '100%', padding: '15px', marginBottom: '20px', background: '#222', border: '1px solid #333', borderRadius: '12px', color: 'white', outline: 'none' }}
                        />

                        <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 'bold', color: '#888' }}>REASON FOR JOINING</label>
                        <textarea
                            value={joinTeamFormData.reason}
                            onChange={e => setJoinTeamFormData({ ...joinTeamFormData, reason: e.target.value })}
                            placeholder="I want to win because..."
                            style={{ width: '100%', padding: '15px', marginBottom: '30px', minHeight: '100px', background: '#222', border: '1px solid #333', borderRadius: '12px', color: 'white', outline: 'none', fontFamily: 'inherit' }}
                        />

                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowTeamJoinForm(false)}
                                style={{ background: 'transparent', color: '#888', border: 'none', cursor: 'pointer', padding: '10px 20px' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitTeamJoinForm}
                                style={{ background: '#bcec15', color: 'black', padding: '15px 30px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Send Request
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Styles for Animations */}
            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default Discover;

