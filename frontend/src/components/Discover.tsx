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
    profile_pic?: string; // Opt to support new and old teams
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

    // New state for toggling views in the matchmaker
    const [showAvailableTeams, setShowAvailableTeams] = useState(false);

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

    // Unified Success Modal State
    const [successModalContent, setSuccessModalContent] = useState<{ title: string, sub: string, link?: string } | null>(null);

    // ... (Keep existing helpers or other states if needed, but we are replacing the modal logic)



    // ... (rest of functions)



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

            setSuccessModalContent({
                title: "YOU'RE IN!",
                sub: "Team created successfully. Good luck!",
                link: shareLink
            });

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
            setSuccessModalContent({
                title: "REQUEST SENT!",
                sub: "Your request to join team has been sent.",
                link: undefined
            });
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
            // Refined Spacing
            padding: '20px 0',
            gap: '30px',
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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
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
                    <div key={event.id}
                        onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                            e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                        }}
                        style={{
                            height: 'calc(100% - 40px)', // Slightly smaller than full height for gap
                            width: '100%',
                            flexShrink: 0,
                            scrollSnapAlign: 'center', // Center the card
                            position: 'relative',
                            display: 'flex',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            // Soft Corners & Separation
                            borderRadius: '32px',
                            margin: '0',
                            cursor: 'default',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', // Deep shadow for lift
                            border: '1px solid rgba(255,255,255,0.1)', // Subtle border for light mode separation
                            background: '#000' // Ensure card itself is opaque dark for content readability
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
                            filter: event.posterUrl ? 'brightness(0.4)' : 'none', // Slightly darker for better contrast
                            zIndex: 1
                        }} />

                        {/* 2. Gradient Overlay + Dynamic Spotlight */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            background: `
                                radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.07), transparent 40%),
                                linear-gradient(to top, #000 0%, rgba(0,0,0,0.4) 50%, transparent 100%)
                            `,
                            zIndex: 2,
                            pointerEvents: 'none' // Let clicks pass through
                        }} />

                        {/* 3. Main Content Content */}
                        <div style={{
                            position: 'relative',
                            zIndex: 3,
                            width: '100%',
                            maxWidth: '1400px', // Wider content
                            height: '100%',
                            padding: '60px 5vw', // Responsive padding
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            boxSizing: 'border-box'
                        }}>
                            {/* Top Content: Title & Meta */}
                            <div style={{ marginBottom: 'auto', paddingTop: '60px', opacity: 0, animation: 'fadeIn 1s forwards 0.2s' }}>
                                <style>{`
                                    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                                `}</style>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 20px',
                                    background: 'rgba(188, 236, 21, 0.1)',
                                    border: '1px solid rgba(188, 236, 21, 0.3)',
                                    borderRadius: '30px',
                                    color: '#bcec15',
                                    fontWeight: 'bold',
                                    marginBottom: '30px',
                                    fontSize: '0.8rem',
                                    letterSpacing: '2px',
                                    textTransform: 'uppercase',
                                    boxShadow: '0 0 20px rgba(188, 236, 21, 0.1)'
                                }}>
                                    <span style={{ width: '8px', height: '8px', background: '#bcec15', borderRadius: '50%', display: 'inline-block' }}></span>
                                    Upcoming Event
                                </div>
                                <h1 style={{
                                    fontSize: 'clamp(4rem, 8vw, 7rem)', // Responsive font size
                                    fontWeight: '900',
                                    margin: '0 0 20px 0',
                                    lineHeight: 0.9,
                                    textShadow: '0 20px 60px rgba(0,0,0,0.5)',
                                    letterSpacing: '-0.03em',
                                    color: '#fff'
                                }}>
                                    {event.title.toUpperCase()}
                                </h1>
                                <p style={{
                                    fontSize: '1.25rem',
                                    color: 'rgba(255,255,255,0.8)',
                                    maxWidth: '650px',
                                    lineHeight: '1.6',
                                    fontWeight: '300'
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
                                gap: '40px'
                            }}>
                                {/* Left Side Details */}
                                <div style={{ display: 'flex', gap: '60px', fontSize: '1.1rem', color: 'rgba(255,255,255,0.9)' }}>
                                    {[
                                        { label: 'Date', value: formatValue(event.date), icon: <path d="M8 2v4m0 0v4m0-4h8m-8 0H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4m-4 0v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> },
                                        { label: 'Time', value: formatValue(event.time), icon: <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> },
                                        { label: 'Location', value: formatValue(event.venue), icon: <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> }
                                    ].map((item, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold' }}>{item.label}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '600', fontSize: '1.2rem' }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: '#bcec15' }}>
                                                    {item.icon}
                                                </svg>
                                                {item.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Right Side: Actions (Bottom Right Stack) */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center', // Center items horizontally relative to each other
                                    gap: '20px',
                                    marginLeft: 'auto' // Push to the right side if flex parent is row
                                }}>
                                    {/* Register Button (Prominent & Centered in this column) */}
                                    <button
                                        onClick={() => openMatchmaker(event.id)}
                                        style={{
                                            padding: '24px 60px',
                                            borderRadius: '60px',
                                            background: '#bcec15',
                                            color: '#000',
                                            border: 'none',
                                            fontSize: '1.2rem',
                                            fontWeight: '800',
                                            cursor: 'pointer',
                                            boxShadow: '0 0 60px rgba(188, 236, 21, 0.4)',
                                            transition: 'transform 0.2s, box-shadow 0.2s',
                                            textTransform: 'uppercase',
                                            letterSpacing: '1.5px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'scale(1.05)';
                                            e.currentTarget.style.boxShadow = '0 0 80px rgba(188, 236, 21, 0.6)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                            e.currentTarget.style.boxShadow = '0 0 60px rgba(188, 236, 21, 0.4)';
                                        }}
                                    >
                                        Register Event
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                    </button>

                                    {/* Expanded Action Buttons Row (Centered under Register) */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '15px',
                                        justifyContent: 'center',
                                        flexWrap: 'wrap'
                                    }}>
                                        {[
                                            { label: 'Add to Calendar', action: () => addToGoogleCalendar(event), icon: <path d="M8 2v4m0 0v4m0-4h8m-8 0H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4m-4 0v-4" /> },
                                            { label: 'Outlook .ICS', action: () => downloadICS(event), icon: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /> },
                                            { label: `${event.maxTeamMembers || 3} Max Members`, action: () => { }, icon: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm10 2v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /> }
                                        ].map((btn, idx) => (
                                            <button
                                                key={idx}
                                                onClick={btn.action}
                                                style={{
                                                    padding: '10px 20px', // Slightly smaller padding for balance
                                                    borderRadius: '40px',
                                                    background: 'rgba(255,255,255,0.05)', // Slightly more visible
                                                    backdropFilter: 'blur(20px)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                    color: '#ddd',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    letterSpacing: '0.5px'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'white';
                                                    e.currentTarget.style.color = 'black';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                    e.currentTarget.style.color = '#ddd';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    {btn.icon}
                                                </svg>
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
                        width: '95%',  // Wider
                        maxWidth: '800px', // Bigger max width
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '800', letterSpacing: '-1px' }}>
                                {showAvailableTeams ? "AVAILABLE TEAMS" : "REGISTRATION"}
                            </h2>
                            <button
                                onClick={() => {
                                    if (showAvailableTeams) setShowAvailableTeams(false);
                                    else setShowMatchmaker(false);
                                }}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    fontSize: '0.9rem',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            >
                                {showAvailableTeams ? (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M19 12H5M12 19l-7-7 7-7" />
                                        </svg>
                                        BACK
                                    </>
                                ) : (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 6L6 18M6 6l12 12" />
                                        </svg>
                                        CLOSE
                                    </>
                                )}
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>

                            {showAvailableTeams ? (
                                <div id="available-teams-list" style={{ animation: 'zoomIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                                    {teams.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '55vh', overflowY: 'auto', paddingRight: '10px' }}>
                                            {teams.map(t => (
                                                <div key={t.id} style={{
                                                    padding: '24px',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    borderRadius: '20px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                    transition: 'all 0.3s ease'
                                                }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                        e.currentTarget.style.borderColor = 'rgba(188, 236, 21, 0.3)';
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                                        <div style={{
                                                            width: '70px', height: '70px', borderRadius: '16px', background: '#222',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                            overflow: 'hidden', border: '1px solid #333'
                                                        }}>
                                                            {t.profile_pic ? (
                                                                <img src={t.profile_pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                                                <h4 style={{ margin: 0, fontSize: '1.4rem', color: 'white', fontWeight: '700' }}>{t.name}</h4>
                                                                <span style={{
                                                                    padding: '4px 10px', background: 'rgba(188, 236, 21, 0.1)', color: '#bcec15',
                                                                    fontSize: '0.7rem', borderRadius: '20px', fontWeight: '900', textTransform: 'uppercase'
                                                                }}>
                                                                    {t.current_members || 0}/3 MEMBERS
                                                                </span>
                                                            </div>
                                                            <p style={{ margin: 0, fontSize: '1rem', color: '#888', maxWidth: '400px' }}>{t.description || "No description provided."}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => openJoinForm(t)}
                                                        style={{
                                                            padding: '14px 35px',
                                                            background: '#bcec15',
                                                            color: 'black',
                                                            border: 'none',
                                                            borderRadius: '50px',
                                                            cursor: 'pointer',
                                                            fontWeight: 'bold',
                                                            fontSize: '1rem',
                                                            boxShadow: '0 10px 20px rgba(188, 236, 21, 0.2)',
                                                            transition: 'transform 0.2s'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                    >
                                                        JOIN TEAM
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '80px 40px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px dashed #333' }}>
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '20px' }}>
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                            <p style={{ color: '#666', margin: 0, fontSize: '1.2rem', fontWeight: '500' }}>No other teams found for this event yet.</p>
                                            <p style={{ color: '#444', marginTop: '10px' }}>Be the first to create one!</p>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '15px', marginTop: '30px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '30px' }}>
                                        <input
                                            className="modern-input"
                                            placeholder="Enter Team ID manually"
                                            value={joinTeamId}
                                            onChange={e => setJoinTeamId(e.target.value)}
                                            style={{
                                                flex: 1, padding: '20px', background: '#1a1a1a', border: '1px solid #333',
                                                borderRadius: '16px', color: 'white', fontSize: '1.1rem', outline: 'none', transition: '0.3s'
                                            }}
                                        />
                                        <button
                                            onClick={() => handleJoinTeam(joinTeamId)}
                                            style={{
                                                padding: '15px 40px', background: 'rgba(255,255,255,0.05)', color: 'white',
                                                border: '1px solid #444', borderRadius: '16px', cursor: 'pointer', fontWeight: 'bold'
                                            }}
                                        >
                                            SEARCH
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* VIEW: CREATE TEAM / MY TEAM DASHBOARD */
                                <div style={{ animation: 'zoomIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                                    <style>{`
                                        @keyframes zoomIn { 
                                            from { opacity: 0; transform: scale(0.95) translateY(20px); } 
                                            to { opacity: 1; transform: scale(1) translateY(0); } 
                                        }
                                        .modern-input:focus {
                                            border-color: #bcec15 !important;
                                            box-shadow: 0 0 15px rgba(188, 236, 21, 0.3);
                                            background: #111 !important;
                                        }
                                    `}</style>

                                    {myTeam ? (
                                        <div style={{ border: '1px solid #333', background: '#1a1a1a', padding: '30px', borderRadius: '24px' }}>
                                            <h3 style={{ color: '#bcec15', margin: '0 0 10px 0', fontSize: '1.8rem' }}>{myTeam.name}</h3>
                                            <p style={{ color: '#888', margin: 0, fontSize: '1.1rem' }}>Members: {myTeam.current_members} / 3</p>

                                            <h4 style={{ marginTop: '30px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>Pending Requests</h4>
                                            {requests.length === 0 ? <p style={{ color: '#666', fontStyle: 'italic', marginTop: '15px' }}>No pending requests.</p> : (
                                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                                    {requests.map(req => (
                                                        <li key={req.id} style={{ display: 'flex', flexDirection: 'column', marginTop: '15px', background: '#222', padding: '20px', borderRadius: '16px' }}>
                                                            {/* ... request item content ... */}
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                                <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{req.userName || req.userId}</span>
                                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                                    <button onClick={() => handleAcceptRequest(req)} style={{ color: 'black', background: '#bcec15', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Accept</button>
                                                                    <button onClick={() => handleRejectRequest(req.id)} style={{ color: 'white', background: '#333', border: '1px solid #444', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>Reject</button>
                                                                </div>
                                                            </div>
                                                            {req.reason && (
                                                                <div style={{ fontSize: '0.95rem', color: '#aaa', marginTop: '10px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                                                                    <div style={{ marginBottom: '6px' }}><strong style={{ color: '#666' }}>Role:</strong> {req.bio}</div>
                                                                    <div style={{ marginBottom: '6px' }}><strong style={{ color: '#666' }}>Skills:</strong> {req.skills}</div>
                                                                    <div><strong style={{ color: '#666' }}>Why:</strong> {req.reason}</div>
                                                                </div>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    ) : (
                                        /* Create Team View */
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                                            <div style={{
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                padding: '40px',
                                                borderRadius: '30px',
                                                position: 'relative',
                                                background: 'linear-gradient(145deg, #0a0a0a, #111)',
                                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                                            }}>
                                                <h3 style={{ marginTop: 0, fontSize: '1.8rem', marginBottom: '30px', fontWeight: '800', letterSpacing: '-1px' }}>Create a Team</h3>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                    <input
                                                        className="modern-input"
                                                        placeholder="Team Name"
                                                        value={teamName}
                                                        onChange={e => setTeamName(e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '18px 20px',
                                                            background: '#222',
                                                            border: '1px solid #333',
                                                            borderRadius: '16px',
                                                            color: 'white',
                                                            fontSize: '1rem',
                                                            outline: 'none',
                                                            transition: '0.3s',
                                                            boxSizing: 'border-box' // Fixes alignment issues
                                                        }}
                                                    />
                                                    <textarea
                                                        className="modern-input"
                                                        placeholder="Team Description"
                                                        value={teamDesc}
                                                        onChange={e => setTeamDesc(e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '18px 20px',
                                                            minHeight: '120px',
                                                            background: '#222',
                                                            border: '1px solid #333',
                                                            borderRadius: '16px',
                                                            color: 'white',
                                                            fontSize: '1rem',
                                                            outline: 'none',
                                                            fontFamily: 'inherit',
                                                            transition: '0.3s',
                                                            boxSizing: 'border-box', // Fixes alignment issues
                                                            resize: 'vertical'
                                                        }}
                                                    />
                                                </div>

                                                {/* Image Upload Input */}
                                                <div style={{ marginTop: '20px', marginBottom: '30px' }}>
                                                    <label style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '20px',
                                                        cursor: 'pointer',
                                                        padding: '20px',
                                                        background: 'rgba(255,255,255,0.03)',
                                                        border: '1px dashed #444',
                                                        borderRadius: '16px',
                                                        transition: '0.2s'
                                                    }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.borderColor = '#bcec15';
                                                            e.currentTarget.style.background = 'rgba(188, 236, 21, 0.05)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.borderColor = '#444';
                                                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '60px', height: '60px', background: '#333', borderRadius: '12px',
                                                            backgroundImage: teamPic ? `url(${teamPic})` : 'none',
                                                            backgroundSize: 'cover', backgroundPosition: 'center',
                                                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            {!teamPic && <span style={{ fontSize: '2rem', color: '#666' }}>+</span>}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{teamPic ? 'Change Team Photo' : 'Upload Team Photo'}</span>
                                                            <span style={{ fontSize: '0.9rem', color: '#666' }}>Max 10MB, JPG/PNG only.</span>
                                                        </div>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            style={{ display: 'none' }}
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    // 10MB Limit Check
                                                                    if (file.size > 10 * 1024 * 1024) {
                                                                        alert("Image too large. Please choose an image under 10MB.");
                                                                        return;
                                                                    }
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => {
                                                                        setTeamPic(reader.result as string);
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                </div>

                                                <button
                                                    onClick={handleCreateTeamWrapped}
                                                    style={{
                                                        width: '100%',
                                                        padding: '20px',
                                                        background: '#bcec15',
                                                        color: 'black',
                                                        border: 'none',
                                                        borderRadius: '16px',
                                                        cursor: 'pointer',
                                                        fontWeight: '900',
                                                        fontSize: '1.1rem',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '1px',
                                                        transition: 'transform 0.1s'
                                                    }}
                                                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                                                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                                >
                                                    Create Team
                                                </button>
                                            </div>

                                            {/* Looking for Teams Button (Toggles View) */}
                                            <button
                                                onClick={() => setShowAvailableTeams(true)}
                                                style={{
                                                    width: '100%',
                                                    padding: '25px',
                                                    background: 'transparent',
                                                    color: '#fff',
                                                    border: '1px solid #333',
                                                    borderRadius: '30px',
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold',
                                                    fontSize: '1.1rem',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    transition: 'all 0.3s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = '#bcec15';
                                                    e.currentTarget.style.background = 'rgba(188, 236, 21, 0.05)';
                                                    e.currentTarget.style.boxShadow = '0 0 20px rgba(188, 236, 21, 0.1)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = '#333';
                                                    e.currentTarget.style.background = 'transparent';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                            >
                                                <span>LOOKING FOR A TEAM?</span>
                                                <span style={{ color: '#bcec15', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    VIEW AVAILABLE TEAMS ({teams.length})
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                                    </svg>
                                                </span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* KEEPING SUCCESS MODAL & JOIN FORM MODAL WITH UPDATED STYLING BELOW */}
            {/* SUCCESS / CALENDAR PROMPT MODAL */}
            {successModalContent && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.9)', color: 'white',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000,
                    backdropFilter: 'blur(10px)',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <div style={{
                        background: '#111', padding: '50px', borderRadius: '30px', textAlign: 'center',
                        maxWidth: '500px', width: '90%', border: '1px solid #333',
                        boxShadow: '0 0 60px rgba(188, 236, 21, 0.15)',
                        animation: 'zoomIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px', animation: 'bounce 1s infinite' }}>
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#bcec15" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h2 style={{ color: 'white', marginTop: 0, fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-1px' }}>
                            {successModalContent.title}
                        </h2>
                        <p style={{ color: '#888', fontSize: '1.1rem', marginTop: '10px' }}>{successModalContent.sub}</p>

                        {successModalContent.link && (
                            <>
                                <div style={{ background: '#222', padding: '20px', borderRadius: '15px', margin: '30px 0', wordBreak: 'break-all', fontFamily: 'monospace', color: '#bcec15', border: '1px dashed #444' }}>
                                    {successModalContent.link}
                                </div>
                                <p style={{ fontSize: '0.9rem', color: '#666' }}>Share this link with your teammates.</p>
                            </>
                        )}

                        <button
                            onClick={() => setSuccessModalContent(null)}
                            style={{
                                marginTop: '40px', background: '#bcec15', color: 'black', border: 'none',
                                cursor: 'pointer', padding: '15px 40px', borderRadius: '50px', fontWeight: 'bold', fontSize: '1rem',
                                boxShadow: '0 10px 30px rgba(188, 236, 21, 0.3)', transition: 'transform 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            CONTINUE
                        </button>
                    </div>
                    <style>{`
                        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                    `}</style>
                </div>
            )}

            {/* JOIN TEAM FORM MODAL */}
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
                            style={{
                                width: '100%',
                                padding: '15px',
                                marginBottom: '20px',
                                background: '#222',
                                border: '1px solid #333',
                                borderRadius: '12px',
                                color: 'white',
                                outline: 'none',
                                boxSizing: 'border-box' // Fix alignment
                            }}
                        />

                        <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 'bold', color: '#888' }}>TOP SKILLS</label>
                        <input
                            value={joinTeamFormData.skills}
                            onChange={e => setJoinTeamFormData({ ...joinTeamFormData, skills: e.target.value })}
                            placeholder="React, Python, Design..."
                            style={{
                                width: '100%',
                                padding: '15px',
                                marginBottom: '20px',
                                background: '#222',
                                border: '1px solid #333',
                                borderRadius: '12px',
                                color: 'white',
                                outline: 'none',
                                boxSizing: 'border-box' // Fix alignment
                            }}
                        />

                        <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 'bold', color: '#888' }}>REASON</label>
                        <textarea
                            value={joinTeamFormData.reason}
                            onChange={e => setJoinTeamFormData({ ...joinTeamFormData, reason: e.target.value })}
                            placeholder="Why do you want to join?"
                            style={{
                                width: '100%',
                                padding: '15px',
                                marginBottom: '30px',
                                minHeight: '100px',
                                background: '#222',
                                border: '1px solid #333',
                                borderRadius: '12px',
                                color: 'white',
                                outline: 'none',
                                fontFamily: 'inherit',
                                boxSizing: 'border-box', // Fix alignment
                                resize: 'vertical'
                            }}
                        />

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setShowTeamJoinForm(false)} style={{ flex: 1, padding: '15px', background: 'transparent', color: '#aaa', border: '1px solid #333', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>CANCEL</button>
                            <button onClick={submitTeamJoinForm} style={{ flex: 1, padding: '15px', background: '#bcec15', color: 'black', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '900' }}>SUBMIT REQUEST</button>
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
        </div >
    );
};

export default Discover;

