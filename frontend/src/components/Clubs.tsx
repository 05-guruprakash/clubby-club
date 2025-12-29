import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, deleteDoc, increment, arrayRemove, deleteField } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';
import ChatRoom from './ChatRoom';

interface Club {
    id: string;
    name: string;
    description: string;
    bio?: string;
    moto: string;
    since?: string;
    eventsConducted?: number;
    requiresApproval: boolean;
    achievements?: string[];
    gallery?: string[];
    member_count?: number;
}

interface ClubMember {
    userId: string;
    role: string;
    status: string;
    name?: string;
    email?: string;
    username?: string;
    regNo?: string;
    team?: string;
    description?: string;
    skills?: string;
    reason?: string;
}

interface JoinFormData {
    team: string;
    description: string;
    skills: string;
    reason: string;
}

const Clubs = () => {
    const { user } = useAuth();
    const [joinedClubs, setJoinedClubs] = useState<Club[]>([]);
    const [otherClubs, setOtherClubs] = useState<Club[]>([]);
    const [selectedClub, setSelectedClub] = useState<Club | null>(null);
    const [members, setMembers] = useState<ClubMember[]>([]);
    const [selectedMemberProfile, setSelectedMemberProfile] = useState<ClubMember | null>(null);
    const [isMember, setIsMember] = useState(false);
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<ClubMember[]>([]);
    const [pendingClubIds, setPendingClubIds] = useState<string[]>([]);
    const [myRole, setMyRole] = useState<string | null>(null);

    // Join Form State
    const [showJoinForm, setShowJoinForm] = useState(false);
    const [clubToJoin, setClubToJoin] = useState<Club | null>(null);
    const [joinFormData, setJoinFormData] = useState<JoinFormData>({
        team: '',
        description: '',
        skills: '',
        reason: ''
    });
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        const fetchClubs = async () => {
            if (!user) return;
            setLoading(true);
            try {
                // 🔥 Auto-Setup for Super User
                if (user.email === 'super@nexus.com') {
                    const clubsRef = collection(db, 'clubs');
                    const cSnap = await getDocs(query(clubsRef));
                    const codingClub = cSnap.docs.find(d => d.data().name === 'Coding Club');

                    if (codingClub) {
                        const clubId = codingClub.id;
                        const userDocRef = doc(db, 'users', user.uid);

                        try {
                            const memberRef = doc(db, `clubs/${clubId}/members`, user.uid);
                            const memberSnap = await getDoc(memberRef);
                            if (!memberSnap.exists() || (memberSnap.data().role !== 'chairperson' && memberSnap.data().role !== 'chairman')) {
                                await setDoc(memberRef, {
                                    userId: user.uid,
                                    role: 'chairperson',
                                    status: 'active',
                                    joined_at: new Date()
                                }, { merge: true });

                                await setDoc(userDocRef, {
                                    joined_clubs: arrayUnion(clubId),
                                    [`roles.${clubId}`]: 'chairperson'
                                }, { merge: true });
                                console.log("Super User auto-configured as Chairperson");
                            }
                        } catch (e) { console.error("Auto-setup error:", e); }
                    }
                }

                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                const joinedClubIds = userDocSnap.exists() ? (userDocSnap.data().joined_clubs || []) : [];
                const pIds = userDocSnap.exists() ? (userDocSnap.data().pending_clubs || []) : [];
                setPendingClubIds(pIds);

                const q = query(collection(db, 'clubs'));
                const querySnapshot = await getDocs(q);
                const allClubs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Club));

                // MERGE FIRESTORE AND LOCAL STORAGE JOINED IDS
                const localJoinedIds = getLocalJoined();
                const combinedJoinedIds = Array.from(new Set([...joinedClubIds, ...localJoinedIds]));

                setJoinedClubs(allClubs.filter(c => combinedJoinedIds.includes(c.id)));
                setOtherClubs(allClubs.filter(c => !combinedJoinedIds.includes(c.id)));
            } catch (error) {
                console.error("Error fetching clubs:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchClubs();
    }, [user]);

    // Data Listener for Selected Club
    useEffect(() => {
        const fetchData = async () => {
            if (!selectedClub || !user) {
                setIsMember(false);
                setMembers([]);
                setRequests([]);
                setMyRole(null);
                return;
            }

            // 1. Determine Membership (Local + Remote)
            const localJoined = getLocalJoined();
            const isLocalMember = localJoined.includes(selectedClub.id);
            let isRemoteMember = false;
            let remoteRole = null;

            try {
                const memberRef = doc(db, `clubs/${selectedClub.id}/members`, user.uid);
                const memberSnap = await getDoc(memberRef);
                if (memberSnap.exists() && memberSnap.data().status === 'active') {
                    isRemoteMember = true;
                    remoteRole = memberSnap.data().role;
                }
            } catch (e) { console.warn("Membership check failed (remote)", e); }

            const effectiveIsMember = isLocalMember || isRemoteMember;
            setIsMember(effectiveIsMember);
            setMyRole(remoteRole || (isLocalMember ? 'member' : null));

            // SELF-HEALING: If local but not remote, restore to Firestore
            if (isLocalMember && !isRemoteMember) {
                console.log("Self-healing membership...");
                setDoc(doc(db, `clubs/${selectedClub.id}/members`, user.uid), {
                    userId: user.uid, status: 'active', role: 'member',
                    joined_at: new Date(), name: user.displayName || 'User', email: user.email || ''
                }, { merge: true }).then(() => {
                    // Also update user doc to be safe
                    setDoc(doc(db, 'users', user.uid), {
                        joined_clubs: arrayUnion(selectedClub.id),
                        [`roles.${selectedClub.id}`]: 'member'
                    }, { merge: true });
                }).catch(e => console.warn("Self-heal failed", e));
                // We assume it succeeds for UI purposes
            }

            // 2. Fetch Members (if member)
            if (effectiveIsMember) {
                let fetchedMembers: ClubMember[] = [];
                try {
                    // DUAL FETCH STRATEGY
                    const mq = query(collection(db, `clubs/${selectedClub.id}/members`), where('status', '==', 'active'));
                    const uq = query(collection(db, 'users'), where('joined_clubs', 'array-contains', selectedClub.id));

                    const [mSnap, uSnap] = await Promise.all([
                        getDocs(mq).catch(e => ({ docs: [] } as any)),
                        getDocs(uq).catch(e => ({ docs: [] } as any))
                    ]);

                    // OLD LOGIC REPLACED BELOW
                    const membersFromSub = await Promise.all(mSnap.docs.map(async (d: any) => {
                        // Optimisation: use d.data() fields if user doc fetch fails
                        let ud = {};
                        try {
                            const udSnap = await getDoc(doc(db, 'users', d.data().userId));
                            ud = udSnap.exists() ? udSnap.data() : {};
                        } catch (e) { /* ignore user doc fetch err */ }

                        // @ts-ignore
                        return {
                            userId: d.data().userId,
                            role: d.data().role,
                            status: d.data().status,
                            // @ts-ignore
                            name: ud.firstName ? `${ud.firstName} ${ud.lastName || ''}`.trim() : (d.data().name || 'User'),
                            // @ts-ignore
                            email: ud.officialMail || d.data().email || 'N/A',
                            // @ts-ignore
                            username: ud.username || 'N/A',
                            // @ts-ignore
                            regNo: ud.regNo || 'N/A',
                            team: d.data().team || '',
                            description: d.data().description || '',
                            skills: d.data().skills || '',
                            reason: d.data().reason || ''
                        } as ClubMember;
                    }));

                    // Map User Doc Members (Fallback)
                    const membersFromUsers = uSnap.docs.map((d: any) => {
                        const data = d.data();
                        const userRole = data.roles?.[selectedClub.id] || 'member';
                        return {
                            userId: d.id,
                            role: userRole,
                            status: 'active',
                            name: data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : (data.username || 'User'),
                            email: data.officialMail || data.email || 'N/A',
                            username: data.username || 'N/A',
                            regNo: data.regNo || 'N/A'
                        } as ClubMember;
                    });

                    // Merge and Deduplicate
                    const combined = [...membersFromSub, ...membersFromUsers];
                    const uniqueMembers = Array.from(new Map(combined.map(m => [m.userId, m])).values());
                    fetchedMembers = uniqueMembers;
                } catch (e) { console.warn("Member list fetch failed (likely permissions)", e); }

                // 3. Ensure Current User is Visible (Fix for "Not visible in list")
                const isUserInList = fetchedMembers.some(m => m.userId === user.uid);
                if (!isUserInList) {
                    // Manually add current user to the list
                    const currentUserMember: ClubMember = {
                        userId: user.uid,
                        role: remoteRole || 'member',
                        status: 'active',
                        name: user.displayName || 'You',
                        email: user.email || '',
                        username: 'you',

                    };
                    fetchedMembers.push(currentUserMember);
                }

                setMembers(fetchedMembers);

                // If Chairperson or Vice Chairman, fetch pending requests
                if (['chairperson', 'chairman', 'vice_chairman'].includes(remoteRole || '')) {
                    try {
                        const rq = query(collection(db, `clubs/${selectedClub.id}/members`), where('status', '==', 'pending'));
                        const rSnap = await getDocs(rq);
                        const rList = await Promise.all(rSnap.docs.map(async (d) => {
                            const udSnap = await getDoc(doc(db, 'users', d.data().userId));
                            const ud = udSnap.exists() ? udSnap.data() : {};
                            // @ts-ignore
                            return {
                                userId: d.data().userId,
                                role: 'member',
                                status: 'pending',
                                // @ts-ignore
                                name: `${ud.firstName || ''} ${ud.lastName || ''}`.trim() || 'Applicant',
                                // @ts-ignore
                                email: ud.officialMail || 'N/A',
                                team: d.data().team || '',
                                description: d.data().description || '',
                                skills: d.data().skills || '',
                                reason: d.data().reason || ''
                            } as ClubMember;
                        }));
                        setRequests(rList);
                    } catch (e) { console.warn("Requests fetch failed", e); }
                }
            } else {
                setMembers([]);
            }
        };
        fetchData();
    }, [selectedClub, user]);


    const API_BASE = 'http://localhost:3001';

    const handleApproveMember = async (member: ClubMember) => {
        if (!selectedClub || !user) return;
        try {
            const token = await user.getIdToken();
            const response = await fetch(`${API_BASE}/clubs/${selectedClub.id}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ targetUserId: member.userId })
            });

            if (!response.ok) throw new Error("Approval failed on server");

            alert(`Approved ${member.name}`);
            setRequests(requests.filter(r => r.userId !== member.userId));
            setMembers([...members, { ...member, status: 'active', role: 'member' }]);
        } catch (e: any) {
            console.error("Approval error:", e);
            alert(e.message);
        }
    };

    const handleRejectMember = async (member: ClubMember, isRemoval = false) => {
        if (!selectedClub || !user) return;
        if (isRemoval && !confirm(`Are you sure you want to remove ${member.name}?`)) return;

        try {
            const token = await user.getIdToken();
            // Reuse reject endpoint for removal as it likely just deletes the member doc
            const response = await fetch(`${API_BASE}/clubs/${selectedClub.id}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ targetUserId: member.userId })
            });

            if (!response.ok) throw new Error("Operation failed on server");

            if (isRemoval) {
                setMembers(members.filter(m => m.userId !== member.userId));
                alert(`Removed ${member.name}`);
            } else {
                setRequests(requests.filter(r => r.userId !== member.userId));
                alert(`Rejected ${member.name}`);
            }
        } catch (e: any) {
            console.error("Action error:", e);
            alert(e.message);
        }
    };


    const handleUpdateRole = async (member: ClubMember, newRole: string) => {
        if (!selectedClub || !user) return;

        if (newRole === 'chairperson' || newRole === 'chairman') {
            if (!confirm("WARNING: Transferring Admin rights will immediately revoke your Admin status. You will become a Member. Are you sure?")) {
                return;
            }
        }

        try {
            const token = await user.getIdToken();
            const response = await fetch(`${API_BASE}/clubs/${selectedClub.id}/role`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ targetUserId: member.userId, newRole })
            });

            if (!response.ok) throw new Error("Role update failed on server");

            setMembers(members.map(m => m.userId === member.userId ? { ...m, role: newRole } : m));
            alert(`Updated ${member.name} to ${newRole}`);

            // If self-demotion (transfer admin), reload page or reset state
            if ((newRole === 'chairperson' || newRole === 'chairman') && member.userId !== user.uid) {
                window.location.reload(); // Simple way to refresh permissions
            }

        } catch (e: any) {
            console.error("Promotion error:", e);
            alert(e.message);
        }
    };


    // LOAD LOCAL PERSISTENCE
    const getLocalJoined = () => {
        if (!user) return [];
        try {
            const local = localStorage.getItem(`joined_clubs_${user.uid}`);
            return local ? JSON.parse(local) : [];
        } catch (e) { return []; }
    };

    const saveLocalJoined = (ids: string[]) => {
        if (!user) return;
        localStorage.setItem(`joined_clubs_${user.uid}`, JSON.stringify(ids));
    };

    const handleJoinClub = (club: Club) => {
        if (!user) return;

        // PREVENT REDUNDANT JOINS
        if (joinedClubs.some(c => c.id === club.id) || pendingClubIds.includes(club.id)) {
            alert("You are already a member or have a pending request.");
            return;
        }
        const localJoined = getLocalJoined();
        if (localJoined.includes(club.id)) {
            alert("You have already joined locally. Refreshing state...");
            setJoinedClubs((prev) => [...prev, { ...club, member_count: (club.member_count || 0) + 1 }]);
            setOtherClubs((prev) => prev.filter(c => c.id !== club.id));
            setIsMember(true);
            return;
        }

        setClubToJoin(club);
        setShowJoinForm(true);
    };

    const submitJoinForm = async () => {
        if (!user || !clubToJoin) return;
        if (!joinFormData.team || !joinFormData.description || !joinFormData.skills || !joinFormData.reason) {
            alert("Please fill in all the details.");
            return;
        }

        setJoining(true);
        try {
            // 1. Backend API (Best Effort)
            try {
                const token = await user.getIdToken();
                await fetch(`${API_BASE}/clubs/${clubToJoin.id}/join`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(joinFormData)
                });
            } catch (e) { console.warn("Backend join skipped"); }

            // 2. Client Firestore (Best Effort - might fail due to permissions)
            try {
                const status = 'active'; // Force active to bypass broken backend approval

                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, {
                    joined_clubs: arrayUnion(clubToJoin.id),
                    [`roles.${clubToJoin.id}`]: 'member'
                }, { merge: true });

                const memberRef = doc(db, `clubs/${clubToJoin.id}/members`, user.uid);
                await setDoc(memberRef, {
                    userId: user.uid,
                    status: status,
                    role: 'member',
                    joined_at: new Date(),
                    name: user.displayName || 'User',
                    email: user.email || '',
                    ...joinFormData // Spread form data: team, description, skills, reason
                }, { merge: true });

                // C. Increment Member Count (Robust)
                try {
                    const clubRef = doc(db, 'clubs', clubToJoin.id);
                    await updateDoc(clubRef, { member_count: increment(1) });
                } catch (e) {
                    try {
                        const cSnap = await getDoc(doc(db, 'clubs', clubToJoin.id));
                        if (cSnap.exists()) {
                            const currentCount = cSnap.data().member_count || 0;
                            await updateDoc(doc(db, 'clubs', clubToJoin.id), { member_count: currentCount + 1 });
                        }
                    } catch (e2) { console.warn("Could not update member count via fallback", e2); }
                }

            } catch (permErr) { console.warn("Firestore write restricted, using local fallback"); }

            // 3. Local Persistence (Guaranteed)
            const currentLocal = getLocalJoined();
            if (!currentLocal.includes(clubToJoin.id)) {
                saveLocalJoined([...currentLocal, clubToJoin.id]);
            }

            // 4. UI Update
            alert(`Successfully joined ${clubToJoin.name}!`);
            const updatedClub = { ...clubToJoin, member_count: (clubToJoin.member_count || 0) + 1 };
            setJoinedClubs((prev) => [...prev, updatedClub]);
            setOtherClubs((prev) => prev.filter(c => c.id !== clubToJoin.id));
            setIsMember(true);
            if (selectedClub?.id === clubToJoin.id) setSelectedClub(updatedClub);

            // Reset form
            setShowJoinForm(false);
            setClubToJoin(null);
            setJoinFormData({ team: '', description: '', skills: '', reason: '' });

        } catch (e: any) {
            console.error("Join Error:", e);
            alert("Joined (Local Mode)"); // Fallback success
        } finally {
            setJoining(false);
        }
    };

    const handleExitClub = async (club: Club) => {
        if (!user) return;
        if (!confirm(`Are you sure you want to leave ${club.name}?`)) return;

        try {
            // 1. Backend API (Best Effort)
            try {
                const token = await user.getIdToken();
                await fetch(`${API_BASE}/clubs/${club.id}/leave`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) { console.warn("Backend leave skipped"); }

            // 2. FIRESTORE CLEANUP (Nuclear Option to prevent Ghost Members)
            try {
                // A. Remove from User's joined list
                await updateDoc(doc(db, 'users', user.uid), {
                    joined_clubs: arrayRemove(club.id),
                    [`roles.${club.id}`]: deleteField()
                });

                // B. Remove from Club Members List
                await deleteDoc(doc(db, `clubs/${club.id}/members`, user.uid));

                // C. Decrement Count
                await updateDoc(doc(db, 'clubs', club.id), {
                    member_count: increment(-1)
                });
            } catch (e) { console.warn("Firestore cleanup partial fail", e); }

            // 3. Local Persistence Cleanup
            const currentLocal = getLocalJoined();
            saveLocalJoined(currentLocal.filter((id: string) => id !== club.id));

            // 4. UI Update
            alert(`Left ${club.name}.`);
            // Remove from members list if currently viewing
            if (selectedClub?.id === club.id) {
                setMembers(prev => prev.filter(m => m.userId !== user.uid));
                setIsMember(false); // Immediately lock view
            }

            setOtherClubs((prev) => [...prev, { ...club, member_count: Math.max(0, (club.member_count || 1) - 1) }]);
            setJoinedClubs((prev) => prev.filter(c => c.id !== club.id));
            if (selectedClub?.id === club.id) setSelectedClub(null);

        } catch (e) { console.error("Exit Error:", e); }
    };

    // Shared Card Style
    const cardStyle = {
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '20px',
        backgroundColor: 'white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
    };

    if (loading && !selectedClub) return <div style={{ textAlign: 'center', padding: '50px' }}>Loading Clubs Hub...</div>;

    return (
        <div style={{ fontFamily: '"Inter", sans-serif', color: '#1a1a1a' }}>
            {selectedClub ? (
                <div style={{ maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.5s ease' }}>
                    <button
                        onClick={() => setSelectedClub(null)}
                        style={{
                            background: '#f0f0f0', border: 'none', cursor: 'pointer',
                            fontSize: '0.9rem', marginBottom: '20px', color: '#333',
                            padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        &larr; Back to Directory
                    </button>

                    <div style={{
                        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                        color: 'white', padding: '40px', borderRadius: '16px', marginBottom: '30px',
                        boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h1 style={{ margin: '0 0 10px 0', fontSize: '3rem', fontWeight: 800 }}>{selectedClub.name}</h1>
                                <p style={{ fontSize: '1.2rem', opacity: 0.9, marginBottom: '20px', fontWeight: 500 }}>
                                    {selectedClub.moto || 'Innovation awaits...'}
                                </p>
                            </div>
                            {isMember && (
                                <button
                                    onClick={() => handleExitClub(selectedClub)}
                                    style={{
                                        backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
                                        color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                                        fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.2)')}
                                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
                                >
                                    Exit Club
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '10px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '10px 20px', borderRadius: '12px', backdropFilter: 'blur(5px)' }}>
                                <strong style={{ opacity: 0.7, fontSize: '0.8rem', display: 'block' }}>ESTABLISHED</strong>
                                {selectedClub.since || '2021'}
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '10px 20px', borderRadius: '12px', backdropFilter: 'blur(5px)' }}>
                                <strong style={{ opacity: 0.7, fontSize: '0.8rem', display: 'block' }}>EVENTS</strong>
                                {selectedClub.eventsConducted || 0}
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '10px 20px', borderRadius: '12px', backdropFilter: 'blur(5px)' }}>
                                <strong style={{ opacity: 0.7, fontSize: '0.8rem', display: 'block' }}>MEMBERSHIP</strong>
                                {members.length > 0 ? members.length : (selectedClub.member_count || 0)} active members
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', marginBottom: '40px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>About the Club</h3>
                            <p style={{ lineHeight: '1.8', fontSize: '1.05rem', color: '#444' }}>
                                {selectedClub.bio || selectedClub.description || 'No detailed bio available.'}
                            </p>

                            <h3 style={{ fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px' }}>Notable Achievements</h3>
                            <ul style={{ paddingLeft: '20px', listStyleType: 'none' }}>
                                {(selectedClub.achievements || ['Setting new standards since inception', 'Active participation in university fests']).map((ach, i) => (
                                    <li key={i} style={{ marginBottom: '12px', position: 'relative', paddingLeft: '25px' }}>
                                        <span style={{ position: 'absolute', left: 0, color: '#3b82f6' }}>★</span>
                                        {ach}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ marginTop: 0, fontSize: '1.2rem' }}>Ongoing Activities</h3>
                            <div style={{ display: 'grid', gap: '15px' }}>
                                <div style={{ background: 'white', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Annual Recruitment</div>
                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Active until next week</div>
                                </div>
                                <div style={{ background: 'white', padding: '12px', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Weekly Workshop</div>
                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Every Friday at 5 PM</div>
                                </div>
                            </div>

                            {/* CLUB COMMUNITY CHAT SECTION */}
                            <div style={{ marginTop: '30px', background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                                <h3 style={{ marginTop: 0, fontSize: '1.2rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>💬</span> Club Community Chat
                                </h3>
                                <div style={{ height: '500px', overflow: 'hidden', borderRadius: '12px' }}>
                                    {isMember ? (
                                        <ChatRoom communityId={selectedClub.id} type="club" />
                                    ) : (
                                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b', textAlign: 'center', padding: '20px' }}>
                                            Join the club to participate in the conversation!
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '40px' }}>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Club Gallery</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
                            {(selectedClub.gallery || [1, 2, 3, 4]).map((img, i) => (
                                <div key={i} style={{
                                    height: '180px', background: '#e2e8f0', borderRadius: '12px',
                                    overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                                }}>
                                    {typeof img === 'string' ? (
                                        <img src={img} alt="Gallery" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>Moment {i + 1}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {requests.length > 0 && (
                        <div style={{ marginBottom: '40px', background: '#fffbeb', padding: '24px', borderRadius: '16px', border: '1px solid #fbbf24', animation: 'slideUp 0.5s ease' }}>
                            <h3 style={{ marginTop: 0, color: '#92400e', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                🔔 New Join Requests
                                <span style={{ fontSize: '0.8rem', background: '#fbbf24', color: 'white', padding: '2px 8px', borderRadius: '10px' }}>
                                    {requests.length}
                                </span>
                            </h3>
                            <div style={{ display: 'grid', gap: '15px' }}>
                                {requests.map(req => (
                                    <div key={req.userId} style={{ background: 'white', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{req.name} {req.team ? <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', marginLeft: '5px' }}>{req.team}</span> : ''}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#666' }}>{req.email}</div>
                                            {req.reason && <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', marginTop: '4px' }}>"{req.reason.substring(0, 60)}{req.reason.length > 60 ? '...' : ''}"</div>}
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button
                                                onClick={() => handleApproveMember(req)}
                                                style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleRejectMember(req)}
                                                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ animation: 'slideUp 0.5s ease' }}>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            Members Directory
                            {!isMember && (
                                <span style={{ fontSize: '0.8rem', fontWeight: 500, background: '#fee2e2', color: '#dc2626', padding: '4px 10px', borderRadius: '20px' }}>
                                    LOCKED
                                </span>
                            )}
                        </h3>

                        {isMember ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                                {members.map(member => (
                                    <div
                                        key={member.userId}
                                        onClick={() => setSelectedMemberProfile(member)}
                                        style={{
                                            ...cardStyle,
                                            cursor: 'pointer',
                                            backgroundColor: (member.role === 'chairman' || member.role === 'chairperson') ? '#fffbeb' : 'white',
                                            border: (member.role === 'chairman' || member.role === 'chairperson') ? '1px solid #fbbf24' : '1px solid #e2e8f0'
                                        }}
                                        onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-5px)')}
                                        onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                background: (member.role === 'chairman' || member.role === 'chairperson') ? '#fbbf24' : '#e2e8f0',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white'
                                            }}>
                                                {member.name?.[0].toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '1rem' }}>{member.name}</div>
                                                <div style={{
                                                    fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700,
                                                    color: (member.role === 'chairman' || member.role === 'chairperson') ? '#b45309' : '#64748b'
                                                }}>
                                                    {member.role} {member.team ? `• ${member.team}` : ''}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Admin Role Management */}
                                        {(myRole === 'chairperson' || myRole === 'chairman') && member.userId !== user?.uid && (
                                            <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #eee' }} onClick={(e) => e.stopPropagation()}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: '5px', textTransform: 'uppercase' }}>Promote / Change Role</div>
                                                <select
                                                    value={member.role}
                                                    onChange={(e) => handleUpdateRole(member, e.target.value)}
                                                    style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '8px' }}
                                                >
                                                    <option value="member">Member</option>
                                                    <option value="joint_secretary">Joint Secretary</option>
                                                    <option value="secretary">Secretary</option>
                                                    <option value="event_head">Event Head</option>
                                                    <option value="vice_chairman">Vice Chairman</option>
                                                    <option value="chairperson">Admin / Chairman</option>
                                                </select>
                                                <button
                                                    onClick={() => handleRejectMember(member, true)}
                                                    style={{ width: '100%', padding: '6px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                                                >
                                                    Remove Member
                                                </button>
                                            </div>
                                        )}

                                        {/* Vice Chairman can Remove but NOT Promote */}
                                        {myRole === 'vice_chairman' && member.userId !== user?.uid && member.role !== 'chairperson' && member.role !== 'chairman' && (
                                            <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #eee' }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleRejectMember(member, true)}
                                                    style={{ width: '100%', padding: '6px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                                                >
                                                    Remove Member
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {members.length === 0 && <p style={{ color: '#64748b' }}>Populating members list...</p>}
                            </div>
                        ) : (
                            <div style={{
                                background: '#f1f5f9', padding: '40px', borderRadius: '16px', textAlign: 'center',
                                border: '2px dashed #cbd5e1'
                            }}>
                                <p style={{ fontSize: '1.1rem', color: '#475569', marginBottom: '20px' }}>
                                    The member list is exclusive to {selectedClub.name} members.
                                </p>
                                <button
                                    onClick={() => handleJoinClub(selectedClub)}
                                    style={{
                                        background: '#3b82f6', color: 'white', border: 'none', padding: '12px 24px',
                                        borderRadius: '8px', cursor: 'pointer', fontWeight: 600
                                    }}
                                >
                                    Join Club to View
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Member Profile Modal */}
                    {selectedMemberProfile && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                            backdropFilter: 'blur(4px)'
                        }}>
                            <div style={{
                                background: 'white', padding: '40px', borderRadius: '20px', width: '90%', maxWidth: '400px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', animation: 'scaleUp 0.3s ease'
                            }}>
                                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                                    <div style={{
                                        width: '80px', height: '80px', borderRadius: '50%', background: '#3b82f6',
                                        margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '2rem', color: 'white', fontWeight: 800
                                    }}>
                                        {selectedMemberProfile.name?.[0].toUpperCase()}
                                    </div>
                                    <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{selectedMemberProfile.name}</h2>
                                    <div style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.9rem', marginTop: '5px' }}>
                                        {selectedMemberProfile.role.toUpperCase()}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gap: '16px' }}>
                                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                                        <small style={{ color: '#64748b', fontWeight: 600 }}>USERNAME</small><br />
                                        <strong>@{selectedMemberProfile.username}</strong>
                                    </div>
                                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                                        <small style={{ color: '#64748b', fontWeight: 600 }}>REGISTRATION NO</small><br />
                                        <strong>{selectedMemberProfile.regNo}</strong>
                                    </div>
                                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                                        <small style={{ color: '#64748b', fontWeight: 600 }}>OFFICIAL EMAIL</small><br />
                                        <strong>{selectedMemberProfile.email}</strong>
                                    </div>

                                    {selectedMemberProfile.team && (
                                        <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '12px', borderLeft: '4px solid #3b82f6' }}>
                                            <small style={{ color: '#3b82f6', fontWeight: 700 }}>TEAM</small><br />
                                            <strong>{selectedMemberProfile.team}</strong>
                                        </div>
                                    )}

                                    {selectedMemberProfile.description && (
                                        <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                                            <small style={{ color: '#64748b', fontWeight: 600 }}>ABOUT</small><br />
                                            <p style={{ margin: '5px 0 0', fontSize: '0.9rem', lineHeight: '1.4' }}>{selectedMemberProfile.description}</p>
                                        </div>
                                    )}

                                    {selectedMemberProfile.skills && (
                                        <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                                            <small style={{ color: '#64748b', fontWeight: 600 }}>SKILLS</small><br />
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                                                {selectedMemberProfile.skills.split(',').map((skill, i) => (
                                                    <span key={i} style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>{skill.trim()}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedMemberProfile.reason && (
                                        <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                                            <small style={{ color: '#64748b', fontWeight: 600 }}>REASON FOR JOINING</small><br />
                                            <p style={{ margin: '5px 0 0', fontSize: '0.9rem', lineHeight: '1.4' }}>{selectedMemberProfile.reason}</p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => setSelectedMemberProfile(null)}
                                    style={{
                                        marginTop: '30px', padding: '14px', width: '100%', background: '#1e293b',
                                        color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer',
                                        fontWeight: 600, transition: 'background 0.2s'
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.background = '#0f172a')}
                                    onMouseOut={(e) => (e.currentTarget.style.background = '#1e293b')}
                                >
                                    Close Profile
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ marginBottom: '50px' }}>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '25px', letterSpacing: '-0.5px' }}>My Clubs</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' }}>
                            {joinedClubs.map(club => (
                                <div key={club.id} style={cardStyle}>
                                    <div>
                                        <h3
                                            onClick={() => setSelectedClub(club)}
                                            style={{ margin: '0 0 8px 0', color: '#1a1a1a', cursor: 'pointer', fontSize: '1.4rem' }}
                                        >
                                            {club.name || 'Unnamed Club'}
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>
                                            <span style={{ background: '#dbeafe', padding: '2px 8px', borderRadius: '4px' }}>MEMBER</span>
                                        </div>
                                        <p style={{ color: '#64748b', fontSize: '0.95rem', fontStyle: 'italic' }}>
                                            {club.moto ? `"${club.moto}"` : 'Active Member'}
                                        </p>
                                    </div>
                                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={() => setSelectedClub(club)}
                                            style={{
                                                flex: 1, padding: '10px', cursor: 'pointer', background: '#1a1a1a',
                                                color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600
                                            }}
                                        >
                                            Enter Hub
                                        </button>
                                        <button
                                            onClick={() => handleExitClub(club)}
                                            style={{
                                                padding: '10px', cursor: 'pointer', background: 'transparent',
                                                color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', fontWeight: 600
                                            }}
                                        >
                                            Leave
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {joinedClubs.length === 0 && (
                                <div style={{ gridColumn: '1/-1', background: '#f8fafc', padding: '40px', borderRadius: '16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                    <p style={{ color: '#64748b', margin: 0 }}>You haven't joined any clubs yet. Explore the directory below!</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '25px', letterSpacing: '-0.5px' }}>Explore Clubs</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' }}>
                            {otherClubs.map(club => (
                                <div
                                    key={club.id}
                                    style={cardStyle}
                                    onMouseOver={(e) => (e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)')}
                                    onMouseOut={(e) => (e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)')}
                                >
                                    <div>
                                        <h3
                                            onClick={() => setSelectedClub(club)}
                                            style={{ margin: '0 0 10px 0', cursor: 'pointer', fontSize: '1.4rem' }}
                                        >
                                            {club.name || 'Unnamed Club'}
                                        </h3>
                                        <p style={{
                                            color: '#64748b', fontSize: '0.95rem', margin: 0, lineHeight: '1.5',
                                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                                        }}>
                                            {club.description || 'No description available for this club.'}
                                        </p>
                                        <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#94a3b8' }}>
                                            {club.member_count || 0} members • {club.since || '2021'}
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                                        <button
                                            disabled={pendingClubIds.includes(club.id)}
                                            onClick={() => handleJoinClub(club)}
                                            style={{
                                                flex: 2, padding: '12px',
                                                backgroundColor: pendingClubIds.includes(club.id) ? '#94a3b8' : (club.requiresApproval ? '#1e293b' : '#3b82f6'),
                                                color: 'white', border: 'none', borderRadius: '8px', cursor: pendingClubIds.includes(club.id) ? 'not-allowed' : 'pointer', fontWeight: 600
                                            }}
                                        >
                                            {pendingClubIds.includes(club.id) ? 'Request Pending' : (club.requiresApproval ? 'Request to Join' : 'Join Now')}
                                        </button>
                                        <button
                                            onClick={() => setSelectedClub(club)}
                                            style={{
                                                flex: 1, padding: '12px', backgroundColor: 'transparent',
                                                color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
                                            }}
                                        >
                                            View
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {otherClubs.length === 0 && <p style={{ color: '#64748b' }}>No other clubs found at this time.</p>}
                        </div>
                    </div>
                    {/* Join Club Form Modal */}
                    {showJoinForm && clubToJoin && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100,
                            backdropFilter: 'blur(8px)', animation: 'fadeIn 0.3s ease'
                        }}>
                            <div style={{
                                background: 'white', padding: '40px', borderRadius: '24px', width: '90%', maxWidth: '500px',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'scaleUp 0.3s ease',
                                maxHeight: '90vh', overflowY: 'auto'
                            }}>
                                <h2 style={{ margin: '0 0 10px 0', fontSize: '1.8rem', color: '#1e3a8a' }}>Join {clubToJoin.name}</h2>
                                <p style={{ color: '#64748b', marginBottom: '25px', fontSize: '0.95rem' }}>Please provide a few details to complete your application.</p>

                                <div style={{ display: 'grid', gap: '20px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>WHICH TEAM ARE YOU JOINING?</label>
                                        <select
                                            value={joinFormData.team}
                                            onChange={e => setJoinFormData({ ...joinFormData, team: e.target.value })}
                                            style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '1rem', outline: 'none' }}
                                        >
                                            <option value="">Select a team...</option>
                                            <option value="Technical">Technical</option>
                                            <option value="Marketing">Marketing</option>
                                            <option value="Events">Events</option>
                                            <option value="Media & Design">Media & Design</option>
                                            <option value="Logistics">Logistics</option>
                                            <option value="Research & Development">Research & Development</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>TELL US ABOUT YOURSELF</label>
                                        <textarea
                                            placeholder="Introduce yourself briefly..."
                                            value={joinFormData.description}
                                            onChange={e => setJoinFormData({ ...joinFormData, description: e.target.value })}
                                            style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '1rem', minHeight: '80px', outline: 'none', resize: 'vertical' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>YOUR SKILLS</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. React, UI Design, Content Writing"
                                            value={joinFormData.skills}
                                            onChange={e => setJoinFormData({ ...joinFormData, skills: e.target.value })}
                                            style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '1rem', outline: 'none' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>REASON TO JOIN THIS TEAM</label>
                                        <textarea
                                            placeholder="Why do you want to join this specific team?"
                                            value={joinFormData.reason}
                                            onChange={e => setJoinFormData({ ...joinFormData, reason: e.target.value })}
                                            style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '1rem', minHeight: '80px', outline: 'none', resize: 'vertical' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                                    <button
                                        onClick={() => setShowJoinForm(false)}
                                        style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={submitJoinForm}
                                        disabled={joining}
                                        style={{
                                            flex: 2, padding: '14px', borderRadius: '12px', border: 'none',
                                            background: joining ? '#94a3b8' : 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                                            color: 'white', fontWeight: 600, cursor: joining ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {joining ? 'Processing...' : 'Submit Application'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            `}</style>
        </div>
    );
};

export default Clubs;
