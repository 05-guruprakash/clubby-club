import { useEffect, useState, type FC } from 'react';
import { collection, query, where, doc, getDoc, setDoc, updateDoc, arrayUnion, deleteDoc, increment, arrayRemove, deleteField, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';
// ChatRoom removed - using Go to Community button instead

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
    about?: string;
    skills?: string;
    team?: string;
    reason?: string;
    uid?: string;
}

interface JoinFormData {
    about: string;
    skills: string;
    team: string;
    reason: string;
}

interface ClubsProps {
    isDarkMode?: boolean;
}

const Clubs: FC<ClubsProps> = ({ isDarkMode = true }) => {
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
    const [joiningClub, setJoiningClub] = useState<Club | null>(null);
    const [joinFormData, setJoinFormData] = useState<JoinFormData>({
        about: '',
        skills: '',
        team: '',
        reason: ''
    });
    const [activeTab, setActiveTab] = useState<'all' | 'joined'>('all');

    const API_BASE = 'http://localhost:3001';

    // Helpers for local persistence
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

    const getClubGradient = (id: string) => {
        const colors = [
            'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
            'linear-gradient(135deg, #16222a 0%, #3a6073 100%)',
            'linear-gradient(135deg, #1f4037 0%, #111 100%)',
            'linear-gradient(135deg, #000 0%, #222 100%)',
        ];
        const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        return colors[index];
    };

    // 1. Real-time Listener for Clubs Hub List
    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, 'clubs'));
        const unsubClubs = onSnapshot(q, async (snapshot) => {
            const allClubs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Club));

            // Re-fetch user joined clubs to ensure sync
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            const joinedClubIds = userDocSnap.exists() ? (userDocSnap.data().joined_clubs || []) : [];
            const pIds = userDocSnap.exists() ? (userDocSnap.data().pending_clubs || []) : [];
            setPendingClubIds(pIds);

            const localJoinedIds = getLocalJoined();
            const combinedJoinedIds = Array.from(new Set([...joinedClubIds, ...localJoinedIds]));

            setJoinedClubs(allClubs.filter(c => combinedJoinedIds.includes(c.id)));
            setOtherClubs(allClubs.filter(c => !combinedJoinedIds.includes(c.id)));
            setLoading(false);
        });

        return () => unsubClubs();
    }, [user?.uid]);

    // 2. Real-time Listener for Selected Club Data (Members, Requests, Stats)
    useEffect(() => {
        if (!selectedClub || !user) {
            setIsMember(false);
            setMembers([]);
            setRequests([]);
            setMyRole(null);
            return;
        }

        const clubId = selectedClub.id;

        // A. Listen to Club Doc for Live Stats (member_count, etc.)
        const unsubClub = onSnapshot(doc(db, 'clubs', clubId), (snap: any) => {
            if (snap.exists()) {
                const data = { id: snap.id, ...snap.data() } as Club;
                setSelectedClub((prev: Club | null) => prev && prev.id === clubId ? data : prev);
            }
        });

        // B. Membership & Role Check
        const unsubMe = onSnapshot(doc(db, `clubs/${clubId}/members`, user.uid), (snap: any) => {
            const data = snap.data();
            const localJoined = getLocalJoined();
            const isActive = data?.status === 'active' || localJoined.includes(clubId);

            setIsMember(isActive);
            setMyRole(data?.role || (isActive ? 'member' : null));
        });

        // C. Members List Listener
        const mq = query(collection(db, `clubs/${clubId}/members`), where('status', '==', 'active'));
        const unsubMembers = onSnapshot(mq, async (snapshot: any) => {
            // Optimization: Use membership doc data first, avoid heavy user doc fetches if possible
            const list = snapshot.docs.map((d: any) => {
                const m = d.data();
                return {
                    userId: m.userId || d.id,
                    role: m.role || 'member',
                    status: m.status || 'active',
                    name: m.name || m.username || 'Unknown',
                    email: m.email || 'N/A',
                    username: m.username || 'user',
                    regNo: m.regNo || 'N/A',
                    skills: m.skills || 'N/A',
                    team: m.team || 'N/A'
                } as ClubMember;
            });
            setMembers(list);
        });

        // D. Requests List Listener (Admin Only)
        let unsubRequests: () => void = () => { };
        if (['chairperson', 'chairman', 'vice_chairman'].includes(myRole || '')) {
            const rq = query(collection(db, `clubs/${clubId}/members`), where('status', '==', 'pending'));
            unsubRequests = onSnapshot(rq, (snapshot: any) => {
                const rList = snapshot.docs.map((d: any) => ({
                    userId: d.id,
                    ...d.data(),
                    status: 'pending'
                } as ClubMember));
                setRequests(rList);
            });
        }

        return () => {
            unsubClub();
            unsubMe();
            unsubMembers();
            unsubRequests();
        };
    }, [selectedClub?.id, user?.uid, myRole]); // Re-run if club changes or role changes (to enable requests view)

    const handleJoinClub = async (club: Club, formData?: JoinFormData) => {
        if (!user) return;
        if (!formData) {
            setJoiningClub(club);
            setJoinFormData({ about: '', skills: '', team: '', reason: '' });
            setShowJoinForm(true);
            return;
        }

        try {
            const status = club.requiresApproval ? 'pending' : 'active';
            const token = await user.getIdToken();
            await fetch(`${API_BASE}/clubs/${club.id}/join`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => { });

            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                [status === 'active' ? 'joined_clubs' : 'pending_clubs']: arrayUnion(club.id)
            }).catch(async () => {
                await setDoc(userRef, {
                    [status === 'active' ? 'joined_clubs' : 'pending_clubs']: arrayUnion(club.id)
                }, { merge: true });
            });

            const memberRef = doc(db, `clubs/${club.id}/members`, user.uid);
            await setDoc(memberRef, {
                userId: user.uid,
                status: status,
                role: 'member',
                joined_at: new Date(),
                name: user.displayName || 'User',
                email: user.email || '',
                ...formData
            }, { merge: true });

            if (status === 'active') {
                await updateDoc(doc(db, 'clubs', club.id), { member_count: increment(1) }).catch(() => { });
                const currentLocal = getLocalJoined();
                saveLocalJoined([...currentLocal, club.id]);
                alert(`Welcome to ${club.name}!`);
                setIsMember(true);
            } else {
                setPendingClubIds((prev: string[]) => [...prev, club.id]);
                alert("Application submitted! Waiting for approval.");
            }

            setShowJoinForm(false);
            setJoiningClub(null);
        } catch (e) {
            console.error(e);
            alert("Join process failed. Please check your connection.");
        }
    };

    const submitJoinForm = () => {
        if (!joiningClub) return;
        if (!joinFormData.about || !joinFormData.skills || !joinFormData.team || !joinFormData.reason) {
            alert("All fields required");
            return;
        }
        handleJoinClub(joiningClub, joinFormData);
    };

    const handleExitClub = async (club: Club) => {
        if (!user || !confirm(`Leave ${club.name}?`)) return;
        try {
            const token = await user.getIdToken();
            await fetch(`${API_BASE}/clubs/${club.id}/leave`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => { });

            await updateDoc(doc(db, 'users', user.uid), {
                joined_clubs: arrayRemove(club.id),
                [`roles.${club.id}`]: deleteField()
            });
            await deleteDoc(doc(db, `clubs/${club.id}/members`, user.uid));
            await updateDoc(doc(db, 'clubs', club.id), { member_count: increment(-1) }).catch(() => { });

            const currentLocal = getLocalJoined();
            saveLocalJoined(currentLocal.filter((id: string) => id !== club.id));

            setOtherClubs(prev => [...prev, { ...club, member_count: Math.max(0, (club.member_count || 1) - 1) }]);
            setJoinedClubs(prev => prev.filter(c => c.id !== club.id));
            setSelectedClub(null);
        } catch (e) { console.error(e); }
    };

    const handleApproveMember = async (member: ClubMember) => {
        if (!selectedClub || !user) return;
        try {
            const token = await user.getIdToken();
            await fetch(`${API_BASE}/clubs/${selectedClub.id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ targetUserId: member.userId })
            });
            setRequests((prev: ClubMember[]) => prev.filter(r => r.userId !== member.userId));
            setMembers((prev: ClubMember[]) => [...prev, { ...member, status: 'active', role: 'member' }]);
        } catch (e) { alert("Approval failed"); }
    };

    const handleUpdateRole = async (member: ClubMember, newRole: string) => {
        if (!selectedClub || !user) return;
        try {
            const token = await user.getIdToken();
            await fetch(`${API_BASE}/clubs/${selectedClub.id}/role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ targetUserId: member.userId, newRole })
            });
            setMembers((prev: ClubMember[]) => prev.map(m => m.userId === member.userId ? { ...m, role: newRole } : m));
            alert("Role updated");
        } catch (e) { alert("Failed to update role"); }
    };

    if (loading && !selectedClub) {
        return (
            <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#bcec15', fontSize: '1.2rem', fontWeight: '900', letterSpacing: '2px', animation: 'pulse 1.5s infinite' }}>SYNCING COMMUNITIES...</div>
            </div>
        );
    }

    const theme = {
        bg: isDarkMode ? '#050505' : '#f8f9fa',
        cardBg: isDarkMode ? 'rgba(255,255,255,0.03)' : '#ffffff',
        border: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        text: isDarkMode ? '#ffffff' : '#111111',
        subtext: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
        accent: '#bcec15',
        accentSuble: isDarkMode ? 'rgba(188, 236, 21, 0.1)' : 'rgba(188, 236, 21, 0.2)',
    };

    return (
        <div style={{
            height: '100%',
            overflowY: 'scroll',
            scrollSnapType: 'y mandatory',
            scrollBehavior: 'smooth',
            background: 'transparent',
            scrollbarWidth: 'none',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '30px',
            padding: '20px 0'
        }}>
            {!selectedClub && (
                <div style={{
                    position: 'sticky',
                    top: '24px',
                    zIndex: 100,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    height: '60px',
                    marginBottom: '-60px'
                }}>
                    <div style={{
                        background: 'rgba(10, 10, 10, 0.75)',
                        backdropFilter: 'blur(30px)',
                        padding: '6px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
                        pointerEvents: 'auto'
                    }}>
                        {[
                            { id: 'all', label: 'ALL SECTORS' },
                            { id: 'joined', label: 'YOUR SECTORS' }
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                style={{
                                    height: '42px',
                                    padding: '0 28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '16px',
                                    border: 'none',
                                    background: activeTab === t.id ? theme.accent : 'transparent',
                                    color: activeTab === t.id ? '#000' : 'rgba(255,255,255,0.4)',
                                    fontSize: '0.7rem',
                                    fontWeight: '950',
                                    cursor: 'pointer',
                                    transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                                    letterSpacing: '1.5px',
                                    boxShadow: activeTab === t.id ? `0 8px 15px ${theme.accent}33` : 'none',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {!selectedClub ? (
                <>
                    {/* 1. Header Intro Card */}
                    <div style={{
                        height: 'calc(100% - 40px)',
                        width: '100%',
                        flexShrink: 0,
                        scrollSnapAlign: 'center',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: '32px',
                        background: 'linear-gradient(135deg, #050505 0%, #111 100%)',
                        border: `1px solid ${theme.border}`,
                        textAlign: 'center',
                        padding: '120px 40px 60px 40px',
                        boxSizing: 'border-box'
                    }}>
                        <h1 style={{
                            margin: 0,
                            fontSize: 'clamp(4.5rem, 12vw, 9rem)',
                            fontWeight: '950',
                            letterSpacing: '-6px',
                            lineHeight: '0.85',
                            color: '#fff',
                            animation: 'fadeInUp 1s cubic-bezier(0.23, 1, 0.32, 1)'
                        }}>
                            CLUBS<span style={{ color: theme.accent }}>.</span>
                        </h1>
                        <p style={{
                            margin: '30px 0 0 0', opacity: 0.6, fontWeight: '700',
                            fontSize: '1.2rem', letterSpacing: '4px', textTransform: 'uppercase',
                            animation: 'fadeInUp 1.2s cubic-bezier(0.23, 1, 0.32, 1)'
                        }}>
                            Elite Campus Communities
                        </p>
                        <div style={{
                            marginTop: '60px', display: 'flex', gap: '24px', alignItems: 'center',
                            animation: 'fadeInUp 1.4s cubic-bezier(0.23, 1, 0.32, 1)'
                        }}>
                            <div style={{
                                background: 'rgba(255,255,255,0.05)', padding: '14px 28px',
                                borderRadius: '50px', border: `1px solid ${theme.border}`,
                                fontSize: '0.85rem', fontWeight: '900', letterSpacing: '1px'
                            }}>
                                {activeTab === 'all' ? (joinedClubs.length + otherClubs.length) : joinedClubs.length} {activeTab === 'all' ? 'ACTIVE' : 'JOINED'} SECTORS
                            </div>
                            <div style={{
                                background: theme.accent, color: '#000', width: '50px', height: '50px',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.5rem', fontWeight: '950', animation: 'bounce 2s infinite'
                            }}>&darr;</div>
                        </div>
                    </div>

                    {/* 2. Map all clubs as full-page cards */}
                    {[
                        ...(activeTab === 'all'
                            ? [...joinedClubs.map(c => ({ ...c, isJoined: true })), ...otherClubs.map(c => ({ ...c, isJoined: false }))]
                            : joinedClubs.map(c => ({ ...c, isJoined: true }))
                        )
                    ].map((club: any) => {
                        return (
                            <div key={club.id}
                                onMouseMove={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                                    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                                }}
                                style={{
                                    height: 'calc(100% - 40px)',
                                    width: '100%',
                                    flexShrink: 0,
                                    scrollSnapAlign: 'center',
                                    position: 'relative',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    borderRadius: '32px',
                                    background: '#000',
                                    border: `1px solid ${theme.border}`,
                                    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                                    boxSizing: 'border-box'
                                }}>

                                {/* Background Layer (Fixed/Parallax effect) */}
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    background: club.gallery?.[0] ? `url(${club.gallery[0]}) center/cover no-repeat fixed` : getClubGradient(club.id),
                                    backgroundAttachment: 'fixed',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    opacity: 0.5,
                                    zIndex: 1
                                }}></div>

                                {/* Spotlight & Gradient Overlays */}
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    background: `
                                    radial-gradient(1000px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.08), transparent 40%),
                                    linear-gradient(to top, #000 0%, rgba(0,0,0,0.4) 50%, transparent 100%)
                                `,
                                    zIndex: 2, pointerEvents: 'none'
                                }}></div>

                                {/* Main Content Layer */}
                                <div style={{
                                    position: 'relative', zIndex: 3, width: '100%', maxWidth: '1400px',
                                    height: '100%', padding: '80px 6vw', display: 'flex', flexDirection: 'column',
                                    justifyContent: 'flex-end', boxSizing: 'border-box'
                                }}>
                                    <div style={{ marginBottom: 'auto', paddingTop: '40px' }}>
                                        {/* Status Badge */}
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '10px',
                                            padding: '10px 24px', background: club.isJoined ? 'rgba(188, 236, 21, 0.1)' : 'rgba(255,255,255,0.08)',
                                            border: club.isJoined ? '1px solid rgba(188, 236, 21, 0.4)' : '1px solid rgba(255,255,255,0.15)',
                                            borderRadius: '40px', color: club.isJoined ? '#bcec15' : '#fff',
                                            fontWeight: '900', marginBottom: '35px', fontSize: '0.75rem',
                                            letterSpacing: '2px', textTransform: 'uppercase', backdropFilter: 'blur(10px)'
                                        }}>
                                            <span style={{ width: '8px', height: '8px', background: club.isJoined ? '#bcec15' : '#fff', borderRadius: '50%', display: 'inline-block', boxShadow: club.isJoined ? '0 0 10px #bcec15' : 'none' }}></span>
                                            {club.isJoined ? 'ACTIVE SECTOR' : 'AVAILABLE FOR RECRUITMENT'}
                                        </div>

                                        {/* Club Title */}
                                        <h1 style={{
                                            fontSize: 'clamp(3.5rem, 8vw, 7rem)', fontWeight: '950',
                                            margin: '0 0 25px 0', lineHeight: 0.9, color: '#fff',
                                            letterSpacing: '-3px', textShadow: '0 30px 80px rgba(0,0,0,0.7)'
                                        }}>
                                            {club.name.toUpperCase()}
                                        </h1>

                                        {/* Moto/Description */}
                                        <p style={{
                                            fontSize: '1.4rem', color: 'rgba(255,255,255,0.85)',
                                            maxWidth: '750px', lineHeight: '1.5', fontWeight: '400',
                                            letterSpacing: '0.2px'
                                        }}>
                                            {club.moto || club.description}
                                        </p>
                                    </div>

                                    {/* Bottom Info Bar */}
                                    <div style={{
                                        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                                        paddingTop: '60px', flexWrap: 'wrap', gap: '40px'
                                    }}>
                                        <div style={{ display: 'flex', gap: '70px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '900' }}>Operational Strength</span>
                                                <div style={{ fontSize: '1.8rem', fontWeight: '950', color: '#fff', letterSpacing: '-0.5px' }}>{club.member_count || 0} MEMBERS</div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '900' }}>Authorization</span>
                                                <div style={{ fontSize: '1.8rem', fontWeight: '950', color: club.requiresApproval ? theme.accent : '#55ff55', letterSpacing: '-0.5px' }}>
                                                    {club.requiresApproval ? 'RESTRICTED' : 'OPEN'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '20px' }}>
                                            {/* Action Buttons */}
                                            <button
                                                onClick={() => setSelectedClub(club)}
                                                style={{
                                                    padding: '24px 48px', borderRadius: '60px',
                                                    background: 'rgba(255,255,255,0.05)', color: '#fff',
                                                    border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(30px)',
                                                    fontSize: '1.1rem', fontWeight: '900', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
                                                    letterSpacing: '1px'
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                            >EXPLORE</button>

                                            {!club.isJoined && (
                                                pendingClubIds.includes(club.id) ? (
                                                    <div style={{
                                                        background: 'rgba(255,255,255,0.1)', color: '#fff',
                                                        padding: '24px 60px', borderRadius: '60px',
                                                        fontWeight: '950', fontSize: '1.1rem',
                                                        border: '1px solid rgba(255,255,255,0.2)',
                                                        display: 'flex', alignItems: 'center', letterSpacing: '1px'
                                                    }}>PENDING APPLICATION</div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleJoinClub(club); }}
                                                        style={{
                                                            padding: '24px 64px', borderRadius: '60px',
                                                            background: theme.accent, color: '#000', border: 'none',
                                                            fontSize: '1.1rem', fontWeight: '950', cursor: 'pointer',
                                                            transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
                                                            boxShadow: `0 15px 45px ${theme.accent}55`,
                                                            letterSpacing: '1px'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05) translateY(-5px)'; e.currentTarget.style.boxShadow = `0 20px 60px ${theme.accent}77`; }}
                                                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)'; e.currentTarget.style.boxShadow = `0 15px 45px ${theme.accent}55`; }}
                                                    >JOIN SECTOR</button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {activeTab === 'joined' && joinedClubs.length === 0 && (
                        <div style={{
                            height: 'calc(100% - 40px)',
                            width: '100%',
                            flexShrink: 0,
                            scrollSnapAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            opacity: 0.7,
                            animation: 'fadeIn 1s ease-out'
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: '20px', filter: 'grayscale(1)' }}>🛰️</div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '950', letterSpacing: '4px', textAlign: 'center' }}>NO ACTIVE MISSIONS</h2>
                            <p style={{ margin: '10px 0 30px 0', fontSize: '0.8rem', fontWeight: '700', opacity: 0.5, letterSpacing: '1px' }}>Your sector assignments will appear here.</p>
                            <button
                                onClick={() => setActiveTab('all')}
                                style={{
                                    background: 'transparent', color: theme.accent,
                                    border: `1px solid ${theme.accent}66`, padding: '14px 32px',
                                    borderRadius: '16px', fontWeight: '950', cursor: 'pointer',
                                    fontSize: '0.75rem', letterSpacing: '1.5px', transition: '0.3s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.color = '#000'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.accent; }}
                            >EXPLORE HUB</button>
                        </div>
                    )}
                </>
            ) : (
                <div style={{ animation: 'fadeIn 0.6s cubic-bezier(0.23, 1, 0.32, 1)' }}>
                    {/* SLEEK CLUB DETAIL HEADER */}
                    <div style={{
                        position: 'relative',
                        height: '280px',
                        borderRadius: '32px',
                        overflow: 'hidden',
                        marginBottom: '32px',
                        boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.4)',
                        border: `1px solid ${theme.border}`
                    }}>
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            background: `linear-gradient(to bottom, rgba(0,0,0,0.3), #000 100%), url(${selectedClub!.gallery?.[0] || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop'})`,
                            backgroundSize: 'cover', backgroundPosition: 'center',
                            backgroundAttachment: 'fixed',
                            zIndex: 1,
                            opacity: 0.9
                        }}></div>

                        <div style={{
                            position: 'relative', zIndex: 2, height: '100%',
                            padding: '32px 40px',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                        }}>
                            {/* Top Row: Back Button */}
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <button
                                    onClick={() => setSelectedClub(null)}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.15)', padding: '10px 20px',
                                        borderRadius: '14px', fontWeight: '800', cursor: 'pointer', transition: '0.3s', fontSize: '0.8rem'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                >&larr; BACK TO HUB</button>
                            </div>

                            {/* Bottom Row: Club Info & Actions */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                        <div style={{ background: theme.accent, color: '#000', padding: '4px 12px', borderRadius: '50px', fontSize: '0.6rem', fontWeight: '950', letterSpacing: '1px' }}>OFFICIAL</div>
                                        {isMember && <div style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '4px 12px', borderRadius: '50px', fontSize: '0.6rem', fontWeight: '950', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>MEMBER</div>}
                                    </div>
                                    <h1 style={{
                                        margin: 0,
                                        fontSize: '2.8rem',
                                        fontWeight: '950',
                                        color: '#fff',
                                        letterSpacing: '-2px',
                                        lineHeight: '1',
                                        textShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                    }}>{selectedClub.name.toUpperCase()}</h1>
                                    <p style={{ margin: '10px 0 0 0', fontSize: '1rem', color: theme.accent, fontWeight: '700', letterSpacing: '0.5px', opacity: 0.9 }}>{selectedClub.moto?.toUpperCase()}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {isMember ? (
                                        <>
                                            <button
                                                onClick={() => handleExitClub(selectedClub)}
                                                style={{
                                                    background: 'rgba(255,100,100,0.15)', backdropFilter: 'blur(20px)', color: '#ff6464',
                                                    border: '1px solid rgba(255,100,100,0.2)', padding: '10px 20px',
                                                    borderRadius: '14px', fontWeight: '800', cursor: 'pointer', transition: '0.3s', fontSize: '0.8rem'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,100,100,0.25)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,100,100,0.15)'}
                                            >LEAVE</button>
                                        </>
                                    ) : (
                                        pendingClubIds.includes(selectedClub.id) ?
                                            <div style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', padding: '10px 24px', borderRadius: '14px', fontWeight: '900', fontSize: '0.8rem' }}>APPLICATION PENDING</div>
                                            : (
                                                <button
                                                    onClick={() => handleJoinClub(selectedClub)}
                                                    style={{
                                                        background: theme.accent, color: '#000', padding: '10px 28px',
                                                        borderRadius: '14px', fontWeight: '950', border: 'none',
                                                        cursor: 'pointer', transition: '0.3s', fontSize: '0.8rem',
                                                        boxShadow: `0 8px 20px ${theme.accent}44`
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                                >JOIN NOW</button>
                                            )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CONTENT - Single Column Layout */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                        {/* Statistics Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            {[
                                { label: 'SINCE', val: selectedClub.since || '2021' },
                                { label: 'EVENTS', val: selectedClub.eventsConducted || '0' },
                                { label: 'MEMBERS', val: members.length || selectedClub.member_count || '0' }
                            ].map((s, i) => (
                                <div key={i} style={{
                                    background: theme.cardBg, padding: '24px', borderRadius: '28px',
                                    border: `1px solid ${theme.border}`, textAlign: 'center',
                                    transition: '0.3s'
                                }}>
                                    <div style={{ fontSize: '0.6rem', fontWeight: '950', letterSpacing: '1.5px', color: theme.subtext, marginBottom: '6px' }}>{s.label}</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: '950', color: theme.text, letterSpacing: '-1px' }}>{s.val}</div>
                                </div>
                            ))}
                        </div>

                        {/* Mission Section */}
                        <div style={{
                            background: theme.cardBg, padding: '32px', borderRadius: '32px', border: `1px solid ${theme.border}`
                        }}>
                            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '950', letterSpacing: '0.5px' }}>THE MISSION</h2>
                            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.7', opacity: 0.7, fontWeight: '500' }}>
                                {selectedClub.bio || selectedClub.description || 'Our mission is to foster innovation and leadership in the campus community through collaborative projects and elite networking.'}
                            </p>
                        </div>

                        {/* Chronicles Section */}
                        <div>
                            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '950', letterSpacing: '0.5px' }}>CHRONICLES</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                {(selectedClub.gallery?.slice(0, 4) || [1, 2, 3, 4]).map((img, i) => (
                                    <div key={i} style={{
                                        borderRadius: '24px', background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#eee',
                                        overflow: 'hidden', border: `1px solid ${theme.border}`,
                                        height: '120px'
                                    }}>
                                        {typeof img === 'string' ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2, fontSize: '0.65rem', fontWeight: '900' }}>SNAPSHOT {i + 1}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Go to Club Community Button */}
                        {isMember && (
                            <div style={{
                                background: theme.accentSuble,
                                borderRadius: '28px',
                                padding: '24px 32px',
                                border: `1px solid ${theme.accent}33`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', color: theme.accent }}>CLUB COMMUNITY</h3>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.6, fontWeight: '600' }}>Access the club's discussion forum and chat with members.</p>
                                </div>
                                <button
                                    onClick={() => {
                                        // Navigate to Feed with club community context
                                        alert(`Redirecting to ${selectedClub.name} Community Feed...`);
                                        // This would link to a dedicated community page if available
                                    }}
                                    style={{
                                        background: theme.accent, color: '#000', padding: '12px 28px',
                                        borderRadius: '16px', fontWeight: '950', border: 'none',
                                        cursor: 'pointer', transition: '0.3s', fontSize: '0.85rem',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                >GO TO COMMUNITY &rarr;</button>
                            </div>
                        )}

                        {/* MEMBERS LIST */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', letterSpacing: '0.5px' }}>MEMBERS</h2>
                                <div style={{ padding: '4px 12px', background: theme.accentSuble, color: theme.accent, borderRadius: '50px', fontSize: '0.6rem', fontWeight: '900' }}>{members.length} ACTIVE</div>
                            </div>

                            {isMember ? (
                                members.length > 0 ? (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                        gap: '16px'
                                    }}>
                                        {members.map(m => (
                                            <div
                                                key={m.userId}
                                                onClick={() => setSelectedMemberProfile(m)}
                                                style={{
                                                    background: theme.cardBg, padding: '20px', borderRadius: '24px',
                                                    border: `1px solid ${theme.border}`, cursor: 'pointer', textAlign: 'center', transition: '0.3s'
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = theme.accent; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.transform = 'translateY(0)'; }}
                                            >
                                                <div style={{
                                                    width: '52px', height: '52px', borderRadius: '16px',
                                                    background: m.role?.toLowerCase().includes('chairman') ? theme.accent : (isDarkMode ? 'rgba(255,255,255,0.05)' : '#f0f0f0'),
                                                    color: m.role?.toLowerCase().includes('chairman') ? '#000' : theme.text,
                                                    fontSize: '1.2rem', fontWeight: '950', display: 'flex',
                                                    alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px'
                                                }}>
                                                    {m.name?.[0]?.toUpperCase() || 'U'}
                                                </div>
                                                <div style={{ fontWeight: '800', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                                                <div style={{ fontSize: '0.55rem', fontWeight: '950', color: theme.accent, opacity: 0.7, marginTop: '4px', letterSpacing: '1px' }}>{m.role?.toUpperCase() || 'MEMBER'}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '40px', textAlign: 'center', background: theme.cardBg, borderRadius: '28px', border: `1px solid ${theme.border}` }}>
                                        <p style={{ opacity: 0.4, fontWeight: '700' }}>Loading members...</p>
                                    </div>
                                )
                            ) : (
                                <div style={{
                                    background: theme.cardBg, padding: '50px 40px', borderRadius: '32px',
                                    border: `1px dashed ${theme.border}`, textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔒</div>
                                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: '900' }}>MEMBERS ONLY</h3>
                                    <p style={{ margin: 0, fontWeight: '600', opacity: 0.4, fontSize: '0.85rem' }}>Join the club to view member directory.</p>
                                    <button
                                        onClick={() => handleJoinClub(selectedClub)}
                                        style={{
                                            marginTop: '20px', background: theme.accent, color: '#000',
                                            border: 'none', padding: '12px 24px', borderRadius: '14px',
                                            fontWeight: '900', cursor: 'pointer'
                                        }}
                                    >JOIN NOW</button>
                                </div>
                            )}
                        </div>

                        {/* Pending Recruitments (Admin Only) */}
                        {requests.length > 0 && (
                            <div style={{
                                background: theme.accentSuble, padding: '24px', borderRadius: '28px',
                                border: `1px solid ${theme.accent}33`
                            }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '0.8rem', fontWeight: '950', color: theme.accent, letterSpacing: '1.5px' }}>PENDING REQUESTS ({requests.length})</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                    {requests.map(req => (
                                        <div key={req.userId} style={{
                                            background: isDarkMode ? 'rgba(255,255,255,0.04)' : '#fff', padding: '14px 18px',
                                            borderRadius: '16px', display: 'flex', justifyContent: 'space-between',
                                            alignItems: 'center', border: `1px solid ${theme.border}`
                                        }}>
                                            <span style={{ fontWeight: '800', fontSize: '0.8rem', opacity: 0.8 }}>{req.name?.toUpperCase() || 'APPLICANT'}</span>
                                            <button
                                                onClick={() => handleApproveMember(req)}
                                                style={{ background: theme.accent, color: '#000', border: 'none', padding: '6px 14px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '950', cursor: 'pointer' }}
                                            >ACCEPT</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Application Modal - Modern Sleek */}
            {
                showJoinForm && joiningClub && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{
                            background: isDarkMode ? '#0a0a0a' : '#fff', width: '90%', maxWidth: '500px',
                            borderRadius: '45px', padding: '40px', border: `1px solid ${theme.accent}33`,
                            boxShadow: `0 0 60px ${theme.accent}11`, animation: 'zoomIn 0.3s cubic-bezier(0.23, 1, 0.32, 1)'
                        }}>
                            <h2 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '950', letterSpacing: '-1.5px' }}>RECRUITMENT</h2>
                            <p style={{ margin: '8px 0 32px 0', opacity: 0.5, fontWeight: '800', fontSize: '0.8rem' }}>APPLYING TO {joiningClub.name.toUpperCase()}</p>

                            <div style={{ display: 'grid', gap: '20px' }}>
                                {[
                                    { k: 'about', l: 'INTEL', p: 'Briefly describe your vision...' },
                                    { k: 'skills', l: 'SKILLSET', p: 'React, Design, Python...' },
                                    { k: 'team', l: 'DEPARTMENT', p: 'Technical, Outreach, Events...' },
                                    { k: 'reason', l: 'OBJECTIVE', p: 'Why join this community?' }
                                ].map(x => (
                                    <div key={x.k}>
                                        <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: '950', color: theme.accent, marginBottom: '8px', letterSpacing: '2px' }}>{x.l}</label>
                                        <textarea
                                            placeholder={x.p}
                                            value={(joinFormData as any)[x.k]}
                                            onChange={e => setJoinFormData(prev => ({ ...prev, [x.k]: e.target.value }))}
                                            style={{
                                                width: '100%', background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f5f5f5',
                                                border: `1px solid ${theme.border}`, padding: '14px 20px',
                                                borderRadius: '18px', color: theme.text, fontSize: '0.9rem',
                                                outline: 'none', minHeight: '60px', resize: 'none'
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                                <button onClick={() => setShowJoinForm(false)} style={{ flex: 1, padding: '16px', borderRadius: '20px', background: 'transparent', color: theme.text, border: `1px solid ${theme.border}`, fontWeight: '950', cursor: 'pointer', fontSize: '0.85rem' }}>CANCEL</button>
                                <button onClick={submitJoinForm} style={{ flex: 2, padding: '16px', borderRadius: '20px', background: theme.accent, color: '#000', fontWeight: '950', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>SUBMIT APPLICATION</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Profile Modal - Detailed */}
            {
                selectedMemberProfile && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{
                            background: isDarkMode ? '#0a0a0a' : '#fff', width: '90%', maxWidth: '440px',
                            borderRadius: '45px', padding: '40px', border: `1px solid ${theme.border}`,
                            animation: 'zoomIn 0.3s cubic-bezier(0.23, 1, 0.32, 1)'
                        }}>
                            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                                <div style={{
                                    width: '90px', height: '90px', borderRadius: '32px',
                                    background: theme.accent, margin: '0 auto 16px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '2.5rem', fontWeight: '950', color: '#000'
                                }}>
                                    {selectedMemberProfile.name?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '950', letterSpacing: '-1.5px' }}>{selectedMemberProfile.name?.toUpperCase() || 'USER'}</h2>

                                <div style={{ color: theme.accent, fontWeight: '950', fontSize: '0.75rem', letterSpacing: '2px', marginTop: '6px' }}>{selectedMemberProfile.role?.toUpperCase() || 'AGENT'}</div>
                            </div>

                            <div style={{ display: 'grid', gap: '12px' }}>
                                {[
                                    { l: 'IDENTIFIER', v: selectedMemberProfile.regNo || 'N/A' },
                                    { l: 'DEPT', v: selectedMemberProfile.team || 'GENERAL' },
                                    { l: 'EXPERTISE', v: selectedMemberProfile.skills || 'UNDISCLOSED' },
                                    { l: 'CONTACT', v: selectedMemberProfile.email || 'PROTECTED' }
                                ].map((i, idx) => (
                                    <div key={idx} style={{
                                        background: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f9f9f9',
                                        padding: '16px 20px', borderRadius: '20px',
                                        border: `1px solid ${theme.border}`
                                    }}>
                                        <div style={{ opacity: 0.4, fontSize: '0.55rem', fontWeight: '950', letterSpacing: '1px', marginBottom: '4px' }}>{i.l}</div>
                                        <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>{i.v.toUpperCase()}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Admin Action Bar */}
                            {['chairperson', 'chairman', 'vice_chairman'].includes(myRole || '') && selectedMemberProfile.userId !== user?.uid && (
                                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                    <select
                                        onChange={(e) => handleUpdateRole(selectedMemberProfile, e.target.value)}
                                        style={{
                                            flex: 1, padding: '12px', background: isDarkMode ? 'rgba(255,255,255,0.05)' : '#eee',
                                            color: theme.text, border: `1px solid ${theme.border}`,
                                            borderRadius: '14px', fontWeight: '800', outline: 'none', fontSize: '0.75rem'
                                        }}
                                        value={selectedMemberProfile.role}
                                    >
                                        <option value="member">MEMBER</option>
                                        <option value="event_head">EVENT HEAD</option>
                                        <option value="vice_chairman">VICE CHAIR</option>
                                    </select>
                                    <button
                                        onClick={() => selectedMemberProfile && alert("Member expulsion deactivated for maintenance.")}
                                        style={{
                                            padding: '12px 20px', borderRadius: '14px',
                                            background: 'rgba(255,68,68,0.1)', color: '#ff4444',
                                            border: '1px solid rgba(255,68,68,0.1)', fontWeight: '900',
                                            cursor: 'pointer', fontSize: '0.75rem'
                                        }}
                                    >EXPEL</button>
                                </div>
                            )}

                            <button onClick={() => setSelectedMemberProfile(null)} style={{ width: '100%', marginTop: '24px', padding: '18px', borderRadius: '22px', background: theme.text, color: theme.bg || '#000', fontWeight: '950', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>CLOSE PROFILE</button>
                        </div>
                    </div>
                )}

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;600;700;800;900&display=swap');
                @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                @keyframes zoomIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
                @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
                ::-webkit-scrollbar { width: 5px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(188, 236, 21, 0.15); border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: #bcec15; }
            `}</style>
        </div>
    );
};

export default Clubs;
