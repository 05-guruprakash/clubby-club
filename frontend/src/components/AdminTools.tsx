import { useState, useEffect } from 'react';
import { collection, updateDoc, doc, getDocs, query, where, addDoc, onSnapshot, arrayUnion, deleteDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

const AdminTools = () => {
    // Event Creation State
    const [eventName, setEventName] = useState('');
    const [eventDesc, setEventDesc] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventVenue, setEventVenue] = useState('');
    const [maxTeamSize, setMaxTeamSize] = useState('3');
    const [isLoading, setIsLoading] = useState(false);

    // User/Team Mgmt State
    const [targetUserId, setTargetUserId] = useState('');
    const [targetTeamId, setTargetTeamId] = useState('');

    // Club Requests State
    const [clubRequests, setClubRequests] = useState<any[]>([]);

    useEffect(() => {
        const q = query(collection(db, 'club_requests'), where('status', '==', 'pending'));
        const unsub = onSnapshot(q,
            (snap) => {
                setClubRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            },
            (err) => {
                console.warn("Requests listener blocked by permissions:", err.message);
            }
        );
        return () => unsub();
    }, []);

    const handleCreateEvent = async () => {
        if (!eventName || !eventDesc || !eventDate || !eventTime || !eventVenue) {
            alert("Please fill all event details.");
            return;
        }

        setIsLoading(true);
        try {
            console.log("Step 1: Getting auth token...");
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Authentication failed. Please log in again.");

            console.log("Step 2: Sending request to backend center...");
            const response = await fetch('http://localhost:3000/events/official', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: eventName,
                    description: eventDesc,
                    date: eventDate,
                    time: eventTime,
                    venue: eventVenue,
                    maxTeamMembers: parseInt(maxTeamSize) || 3
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to create event");
            }

            alert('🌟 Success! Event created and announced via secure backend pipeline.');
            setEventName('');
            setEventDesc('');
            setEventDate('');
            setEventTime('');
            setEventVenue('');
            setMaxTeamSize('3');
        } catch (e: any) {
            console.error("DEBUG - Creation Error:", e);
            if (e.message === 'Failed to fetch') {
                alert("❌ SERVER NOT RUNNING: It looks like the backend server is not active. To fix this and bypass permission issues, you MUST run 'npm run dev' from the ROOT folder (club-management-main), not just the frontend folder.");
            } else {
                alert(`Creation failed: ${e.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleApproveClubRequest = async (req: any) => {
        try {
            await setDoc(doc(db, `clubs/${req.clubId}/members`, req.userId), {
                userId: req.userId,
                status: 'active',
                role: 'member',
                joinedAt: new Date().toISOString()
            });
            await updateDoc(doc(db, 'users', req.userId), {
                joined_clubs: arrayUnion(req.clubId)
            });
            await deleteDoc(doc(db, 'club_requests', req.id));
            alert(`User ${req.userName} has been added to ${req.clubName}`);
        } catch (e: any) {
            console.error(e);
            alert("Approval failed: " + e.message);
        }
    };

    const handleRejectClubRequest = async (reqId: string) => {
        try {
            await deleteDoc(doc(db, 'club_requests', reqId));
            alert("Request rejected.");
        } catch (e) { console.error(e); }
    };

    const handleApproveMember = async () => {
        if (!targetTeamId || !targetUserId) return;
        try {
            const q = query(
                collection(db, `teams/${targetTeamId}/members`),
                where('userId', '==', targetUserId),
                where('status', '==', 'pending')
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                alert('No pending request found.');
                return;
            }
            snapshot.forEach(async (d) => {
                await updateDoc(doc(db, `teams/${targetTeamId}/members`, d.id), { status: 'approved' });
            });
            alert('Member approved!');
        } catch (e) { console.error(e); }
    };

    const handlePromoteMember = async () => {
        if (!targetUserId) return;
        try {
            await updateDoc(doc(db, 'users', targetUserId), { role: 'event_head' });
            alert('Member promoted to event_head!');
        } catch (e) { console.error(e); }
    };

    const glassStyle: any = {
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        padding: '25px',
        marginBottom: '30px'
    };

    const inputStyle: any = {
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #ddd',
        fontSize: '1rem',
        outline: 'none',
        transition: 'border-color 0.2s',
        width: '100%',
        boxSizing: 'border-box'
    };

    const buttonStyle: any = {
        padding: '12px 24px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: '600',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', color: '#333', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px' }}>
                <div style={{ width: '12px', height: '40px', background: 'linear-gradient(to bottom, #FF4B2B, #FF416C)', borderRadius: '4px' }}></div>
                <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '800', background: 'linear-gradient(to right, #FF4B2B, #FF416C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Control Center
                </h1>
                <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#888', textAlign: 'right' }}>
                    <div>UID: {auth.currentUser?.uid}</div>
                    <div>Email: {auth.currentUser?.email}</div>
                </div>
            </div>

            <div style={glassStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }}>
                    <span style={{ fontSize: '1.5rem' }}>🗓️</span>
                    <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700' }}>Schedule New Event</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#666' }}>Event Title</label>
                        <input placeholder="e.g. Nexus Tech Fest 2025" style={inputStyle} value={eventName} onChange={e => setEventName(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#666' }}>Description</label>
                        <textarea placeholder="Tell the community what to expect..." style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={eventDesc} onChange={e => setEventDesc(e.target.value)} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#666' }}>Date</label>
                        <input type="date" style={inputStyle} value={eventDate} onChange={e => setEventDate(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#666' }}>Time</label>
                        <input type="time" style={inputStyle} value={eventTime} onChange={e => setEventTime(e.target.value)} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginTop: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#666' }}>Location / Venue</label>
                        <input placeholder="Main Hall or Online" style={inputStyle} value={eventVenue} onChange={e => setEventVenue(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '600', color: '#666' }}>Max Team Size</label>
                        <input type="number" style={inputStyle} value={maxTeamSize} onChange={e => setMaxTeamSize(e.target.value)} />
                    </div>
                </div>

                <button onClick={handleCreateEvent} disabled={isLoading} style={{ ...buttonStyle, marginTop: '30px', width: '100%', background: 'linear-gradient(45deg, #2193b0, #6dd5ed)', color: 'white', opacity: isLoading ? 0.7 : 1, fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(33, 147, 176, 0.3)' }}>
                    {isLoading ? 'Publishing...' : '🚀 Launch Official Event'}
                </button>
            </div>

            <div style={glassStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }}>
                    <span style={{ fontSize: '1.5rem' }}>🤝</span>
                    <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700' }}>Membership Approvals</h3>
                </div>
                {clubRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#888', background: '#f8f9fa', borderRadius: '12px' }}>No pending requests.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {clubRequests.map(req => (
                            <div key={req.id} style={{ border: '1px solid #f0f0f0', padding: '20px', borderRadius: '12px', background: '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontWeight: '700' }}>{req.clubName}</span>
                                    <span style={{ fontSize: '0.8rem', color: '#a0a0a0' }}>{new Date(req.timestamp).toLocaleDateString()}</span>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#636e72', marginBottom: '15px' }}>
                                    {req.userName} ({req.regNo}) • {req.department}
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => handleApproveClubRequest(req)} style={{ ...buttonStyle, background: '#00b894', color: 'white', padding: '8px 15px' }}>Approve</button>
                                    <button onClick={() => handleRejectClubRequest(req.id)} style={{ ...buttonStyle, background: '#ff7675', color: 'white', padding: '8px 15px' }}>Reject</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                <div style={glassStyle}>
                    <h4 style={{ margin: '0 0 20px 0' }}>Team Management</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input placeholder="Team ID" value={targetTeamId} onChange={e => setTargetTeamId(e.target.value)} style={inputStyle} />
                        <input placeholder="User ID" value={targetUserId} onChange={e => setTargetUserId(e.target.value)} style={inputStyle} />
                        <button onClick={handleApproveMember} style={{ ...buttonStyle, background: '#6c5ce7', color: 'white', width: '100%' }}>Verify & Join</button>
                    </div>
                </div>
                <div style={glassStyle}>
                    <h4 style={{ margin: '0 0 20px 0' }}>Role Elevation</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input placeholder="Enter User ID" value={targetUserId} onChange={e => setTargetUserId(e.target.value)} style={inputStyle} />
                        <button onClick={handlePromoteMember} style={{ ...buttonStyle, background: '#fdb827', color: 'white', width: '100%' }}>Promote Head</button>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default AdminTools;
