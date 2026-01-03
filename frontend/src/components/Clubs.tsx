import { useEffect, useState, type FC } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, deleteDoc, increment, arrayRemove, deleteField } from 'firebase/firestore';
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

    useEffect(() => {
        const fetchClubs = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                const joinedClubIds = userDocSnap.exists() ? (userDocSnap.data().joined_clubs || []) : [];
                const pIds = userDocSnap.exists() ? (userDocSnap.data().pending_clubs || []) : [];
                setPendingClubIds(pIds);

                const q = query(collection(db, 'clubs'));
                const querySnapshot = await getDocs(q);
                const allClubs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Club));

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

    useEffect(() => {
        const fetchSelectedData = async () => {
            if (!selectedClub || !user) {
                setIsMember(false);
                setMembers([]);
                setRequests([]);
                setMyRole(null);
                return;
            }

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
            console.log("Checking membership for:", selectedClub.name, "isMember:", effectiveIsMember);
            setIsMember(effectiveIsMember);
            setMyRole(remoteRole || (isLocalMember ? 'member' : null));

            if (effectiveIsMember) {
                try {
                    const mq = query(collection(db, `clubs/${selectedClub.id}/members`), where('status', '==', 'active'));
                    const mSnap = await getDocs(mq);
                    const list = await Promise.all(mSnap.docs.map(async d => {
                        const udSnap = await getDoc(doc(db, 'users', d.data().userId));
                        const ud = udSnap.exists() ? udSnap.data() : {};
                        return {
                            userId: d.data().userId,
                            role: d.data().role,
                            status: d.data().status,
                            name: ud.firstName ? `${ud.firstName} ${ud.lastName || ''}`.trim() : (d.data().name || 'Unknown'),
                            email: ud.officialMail || d.data().email || 'N/A',
                            username: ud.username || 'user',
                            regNo: ud.regNo || 'N/A',
                            skills: d.data().skills || 'N/A',
                            team: d.data().team || 'N/A'
                        } as ClubMember;
                    }));
                    setMembers(list);

                    if (['chairperson', 'chairman', 'vice_chairman'].includes(remoteRole || '')) {
                        const rq = query(collection(db, `clubs/${selectedClub.id}/members`), where('status', '==', 'pending'));
                        const rSnap = await getDocs(rq);
                        const rList = await Promise.all(rSnap.docs.map(async d => {
                            const udSnap = await getDoc(doc(db, 'users', d.data().userId));
                            const ud = udSnap.exists() ? udSnap.data() : {};
                            return {
                                userId: d.data().userId,
                                role: 'member',
                                status: 'pending',
                                name: ud.firstName ? `${ud.firstName} ${ud.lastName || ''}`.trim() : 'Applicant',
                                email: ud.officialMail || 'N/A'
                            } as ClubMember;
                        }));
                        setRequests(rList);
                    }
                } catch (e) { console.warn("Fetch members failed", e); }
            } else {
                setMembers([]);
            }
        };
        fetchSelectedData();
    }, [selectedClub, user]);

    const handleJoinClub = async (club: Club, formData?: JoinFormData) => {
        if (!user) return;
        if (!formData) {
            setJoiningClub(club);
            setShowJoinForm(true);
            return;
        }

        try {
            const token = await user.getIdToken();
            await fetch(`${API_BASE}/clubs/${club.id}/join`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => { });

            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                joined_clubs: arrayUnion(club.id),
                [`roles.${club.id}`]: 'member'
            }, { merge: true });

            const memberRef = doc(db, `clubs/${club.id}/members`, user.uid);
            await setDoc(memberRef, {
                userId: user.uid, status: 'active', role: 'member',
                joined_at: new Date(), name: user.displayName || 'User', email: user.email || '',
                ...formData
            }, { merge: true });

            await updateDoc(doc(db, 'clubs', club.id), { member_count: increment(1) }).catch(() => { });

            const currentLocal = getLocalJoined();
            saveLocalJoined([...currentLocal, club.id]);

            alert(`Welcome to ${club.name}!`);
            const updatedClub = { ...club, member_count: (club.member_count || 0) + 1 };
            setJoinedClubs(prev => [...prev, updatedClub]);
            setOtherClubs(prev => prev.filter(c => c.id !== club.id));
            setIsMember(true);
            setSelectedClub(updatedClub);
        } catch (e) {
            console.error(e);
            alert("Join failed. Check connection.");
        }
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
            setRequests(prev => prev.filter(r => r.userId !== member.userId));
            setMembers(prev => [...prev, { ...member, status: 'active', role: 'member' }]);
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
            setMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, role: newRole } : m));
            alert("Role updated");
        } catch (e) { alert("Failed to update role"); }
    };

    const submitJoinForm = () => {
        if (!joiningClub) return;
        if (!joinFormData.about || !joinFormData.skills || !joinFormData.team || !joinFormData.reason) {
            alert("All fields required");
            return;
        }
        handleJoinClub(joiningClub, joinFormData);
        setShowJoinForm(false);
        setJoinFormData({ about: '', skills: '', team: '', reason: '' });
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
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '20px',
            minHeight: '90vh',
            color: theme.text,
            fontFamily: '"Outfit", "Inter", sans-serif'
        }}>
            {!selectedClub ? (
                <div style={{ animation: 'fadeIn 0.6s cubic-bezier(0.23, 1, 0.32, 1)' }}>
                    {/* Compact Hub Header */}
                    <div style={{ marginBottom: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <h1 style={{
                                margin: 0,
                                fontSize: '3.5rem',
                                fontWeight: '950',
                                letterSpacing: '-3px',
                                lineHeight: '1'
                            }}>
                                CLUBS<span style={{ color: theme.accent }}>.</span>
                            </h1>
                            <p style={{ margin: '12px 0 0 0', opacity: 0.6, fontWeight: '600', fontSize: '1.1rem' }}>
                                Elite Campus Communities.
                            </p>
                        </div>
                    </div>

                    {/* YOUR SECTORS - Compact Horizontal Scroll or Grid */}
                    {joinedClubs.length > 0 && (
                        <section style={{ marginBottom: '60px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', letterSpacing: '-0.5px' }}>YOUR SECTORS</h2>
                                <div style={{ height: '1px', flex: 1, background: theme.border }}></div>
                                <span style={{ fontSize: '0.8rem', fontWeight: '900', opacity: 0.4 }}>{joinedClubs.length} ACTIVE</span>
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                                gap: '20px'
                            }}>
                                {joinedClubs.map(club => (
                                    <div
                                        key={club.id}
                                        onClick={() => setSelectedClub(club)}
                                        style={{
                                            position: 'relative',
                                            height: '220px',
                                            borderRadius: '32px',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.3s',
                                            border: `1px solid ${theme.border}`,
                                            boxShadow: isDarkMode ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.05)'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02) translateY(-8px)'; e.currentTarget.style.borderColor = theme.accent; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = theme.border; }}
                                    >
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                            background: `linear-gradient(to top, ${isDarkMode ? '#000' : '#222'} 0%, transparent 80%), url(${club.gallery?.[0] || 'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?q=80&w=2070&auto=format&fit=crop'})`,
                                            backgroundSize: 'cover', backgroundPosition: 'center',
                                            opacity: 0.8,
                                            transition: '0.5s'
                                        }}></div>
                                        <div style={{ position: 'relative', zIndex: 2, height: '100%', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                            <div style={{ background: theme.accent, color: '#000', padding: '4px 10px', borderRadius: '50px', fontSize: '0.6rem', fontWeight: '950', width: 'fit-content', marginBottom: '8px' }}>MEMBER</div>
                                            <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '950', color: '#fff', letterSpacing: '-1.5px', lineHeight: '1' }}>{club.name.toUpperCase()}</h3>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: theme.accent, fontWeight: '700', opacity: 0.8 }}>{club.moto?.toUpperCase()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* DISCOVER - Sleek Grid */}
                    <section>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', letterSpacing: '-0.5px' }}>DISCOVER</h2>
                            <div style={{ height: '1px', flex: 1, background: theme.border }}></div>
                            <span style={{ fontSize: '0.8rem', fontWeight: '900', opacity: 0.4 }}>{otherClubs.length} AVAILABLE</span>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '20px'
                        }}>
                            {otherClubs.map(club => (
                                <div
                                    key={club.id}
                                    onClick={() => setSelectedClub(club)}
                                    style={{
                                        background: theme.cardBg,
                                        borderRadius: '32px',
                                        padding: '24px',
                                        border: `1px solid ${theme.border}`,
                                        cursor: 'pointer',
                                        transition: '0.3s cubic-bezier(0.23, 1, 0.32, 1)',
                                        minHeight: '180px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.03)'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.05)' : '#f0f0f0'; e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = theme.accent; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = theme.cardBg; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = theme.border; }}
                                >
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', letterSpacing: '-0.5px' }}>{club.name}</h3>
                                        <p style={{ margin: '8px 0 0 0', opacity: 0.5, fontSize: '0.85rem', lineHeight: '1.5', fontWeight: '500' }}>{club.moto || club.description}</p>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: '900', opacity: 0.4 }}>{club.member_count || 0} RECRUITS</div>
                                        <div style={{ color: theme.accent, fontSize: '0.8rem', fontWeight: '950' }}>JOIN &rarr;</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
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
                            background: `linear-gradient(to bottom, rgba(0,0,0,0.3), #000 100%), url(${selectedClub.gallery?.[0] || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop'})`,
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
            {showJoinForm && joiningClub && (
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
            )}

            {/* Profile Modal - Detailed */}
            {selectedMemberProfile && (
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

                        <button onClick={() => setSelectedMemberProfile(null)} style={{ width: '100%', marginTop: '24px', padding: '18px', borderRadius: '22px', background: theme.text, color: theme.bg, fontWeight: '950', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>CLOSE PROFILE</button>
                    </div>
                </div>
            )}

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;600;700;800;900&display=swap');
                @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
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
