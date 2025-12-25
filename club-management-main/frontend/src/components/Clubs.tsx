import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';

interface Club {
    id: string;
    name: string;
    description: string;
    moto: string;
    since?: string;
    eventsConducted?: number;
    requiresApproval: boolean;
}

interface ClubMember {
    userId: string;
    role: string;
    name?: string;
    email?: string;
    username?: string;
    regNo?: string;
}

const Clubs = () => {
    const { user } = useAuth();
    const [joinedClubs, setJoinedClubs] = useState<Club[]>([]);
    const [otherClubs, setOtherClubs] = useState<Club[]>([]);
    const [selectedClub, setSelectedClub] = useState<Club | null>(null);
    const [members, setMembers] = useState<ClubMember[]>([]);
    const [selectedMemberProfile, setSelectedMemberProfile] = useState<ClubMember | null>(null);

    useEffect(() => {
        const fetchClubs = async () => {
            if (!user) return;
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            const joinedClubIds = userDocSnap.exists() ? (userDocSnap.data().joined_clubs || []) : [];

            const q = query(collection(db, 'clubs'));
            const querySnapshot = await getDocs(q);
            const allClubs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Club));

            setJoinedClubs(allClubs.filter(c => joinedClubIds.includes(c.id)));
            setOtherClubs(allClubs.filter(c => !joinedClubIds.includes(c.id)));
        };

        fetchClubs();
    }, [user]);

    // Fetch members when opening a club
    useEffect(() => {
        const fetchMembers = async () => {
            if (!selectedClub) return;
            const q = query(collection(db, `clubs/${selectedClub.id}/members`));
            const snap = await getDocs(q);

            const memberPromises = snap.docs.map(async (memberDoc) => {
                const data = memberDoc.data();
                // Fetch User Details for Name/Profile
                const userSnap = await getDoc(doc(db, 'users', data.userId));
                const userData = userSnap.exists() ? userSnap.data() : {};

                return {
                    userId: data.userId,
                    role: data.role || 'member',
                    name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown User',
                    username: userData.username || 'N/A',
                    email: userData.officialMail || 'N/A',
                    regNo: userData.regNo || 'N/A'
                } as ClubMember;
            });

            const resolvedMembers = await Promise.all(memberPromises);
            setMembers(resolvedMembers);
        };

        if (selectedClub) {
            fetchMembers();
        } else {
            setMembers([]);
        }
    }, [selectedClub]);


    const handleJoinClub = async (club: Club) => {
        if (!user) return;
        try {
            if (club.requiresApproval) {
                await setDoc(doc(db, `clubs/${club.id}/members`, user.uid), {
                    userId: user.uid, status: 'pending', role: 'member'
                });
                alert(`Requested to join ${club.name}`);
            } else {
                await setDoc(doc(db, `clubs/${club.id}/members`, user.uid), {
                    userId: user.uid, status: 'active', role: 'member'
                });
                await updateDoc(doc(db, 'users', user.uid), { joined_clubs: arrayUnion(club.id) });
                alert(`Joined ${club.name}!`);
                setJoinedClubs([...joinedClubs, club]);
                setOtherClubs(otherClubs.filter(c => c.id !== club.id));
            }
        } catch (e) {
            console.error("Error joining:", e);
        }
    };

    // Shared Card Style
    const cardStyle = {
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
        minHeight: '120px'
    };

    return (
        <div>
            {selectedClub ? (
                // Detailed Hub View
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <button
                        onClick={() => setSelectedClub(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', marginBottom: '10px', color: '#007bff' }}
                    >
                        &larr; Back to Directory
                    </button>

                    <div style={{
                        backgroundColor: '#f8f9fa', padding: '30px', borderRadius: '12px', marginBottom: '30px',
                        border: '1px solid #eee'
                    }}>
                        <h1 style={{ margin: '0 0 10px 0', fontSize: '2.5rem' }}>{selectedClub.name}</h1>
                        <p style={{ fontStyle: 'italic', fontSize: '1.2rem', color: '#555', margin: '0 0 20px 0' }}>
                            "{selectedClub.moto || 'Innovation awaits...'}"
                        </p>
                        <p style={{ lineHeight: '1.6' }}>{selectedClub.description || 'No description available for this club.'}</p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', marginTop: '20px', fontSize: '0.9rem', color: '#333' }}>
                            <div style={{ background: 'white', padding: '10px 20px', borderRadius: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <strong>Since:</strong> {selectedClub.since || '2021'}
                            </div>
                            <div style={{ background: 'white', padding: '10px 20px', borderRadius: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <strong>Events Conducted:</strong> {selectedClub.eventsConducted || 12}
                            </div>
                        </div>

                        <div style={{ marginTop: '20px', background: '#ffe', padding: '15px', borderRadius: '8px', border: '1px solid #eeb' }}>
                            <strong>Currently Conducting:</strong>
                            <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                                <li><em>Hackathon 2025 (Ongoing)</em></li>
                                <li><em>Weekly Workshop</em></li>
                                {/* In real app, map over ongoing events */}
                            </ul>
                        </div>
                    </div>

                    <div style={{ marginBottom: '40px' }}>
                        <h3 style={{ borderBottom: '2px solid #333', paddingBottom: '10px' }}>Gallery</h3>
                        <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} style={{
                                    minWidth: '200px', height: '150px',
                                    background: '#e0e0e0', borderRadius: '8px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888'
                                }}>
                                    Image {i}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 style={{ borderBottom: '2px solid #333', paddingBottom: '10px' }}>Members & Roles</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                            {members.map(member => (
                                <div
                                    key={member.userId}
                                    onClick={() => setSelectedMemberProfile(member)}
                                    style={{
                                        ...cardStyle,
                                        cursor: 'pointer',
                                        backgroundColor: member.role === 'chairman' ? '#fffbeb' : 'white',
                                        border: member.role === 'chairman' ? '1px solid #ffd700' : '1px solid #e0e0e0',
                                        minHeight: 'auto'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{member.name}</div>
                                    <div style={{
                                        marginTop: '5px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px',
                                        color: member.role === 'chairman' ? '#b8860b' : '#666'
                                    }}>
                                        {member.role}
                                    </div>
                                </div>
                            ))}
                            {members.length === 0 && <p>No members found.</p>}
                        </div>
                    </div>

                    {/* Member Profile Modal */}
                    {selectedMemberProfile && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                        }}>
                            <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }}>
                                <h2 style={{ marginTop: 0 }}>{selectedMemberProfile.name}</h2>
                                <div style={{ display: 'grid', gap: '10px' }}>
                                    <div><small style={{ color: '#666' }}>Role</small><br /><strong>{selectedMemberProfile.role.toUpperCase()}</strong></div>
                                    <div><small style={{ color: '#666' }}>Username</small><br />{selectedMemberProfile.username}</div>
                                    <div><small style={{ color: '#666' }}>Reg No</small><br />{selectedMemberProfile.regNo}</div>
                                    <div><small style={{ color: '#666' }}>Email</small><br />{selectedMemberProfile.email}</div>
                                </div>
                                <button
                                    onClick={() => setSelectedMemberProfile(null)}
                                    style={{ marginTop: '20px', padding: '10px 20px', width: '100%', background: '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                // Directory View
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <h2 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>My Clubs</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                        {joinedClubs.map(club => (
                            <div key={club.id} style={cardStyle}>
                                <div>
                                    <h3
                                        onClick={() => setSelectedClub(club)}
                                        style={{ margin: '0 0 10px 0', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        {club.name || 'Unnamed Club'}
                                    </h3>
                                    <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
                                        {club.moto ? `"${club.moto}"` : 'Member'}
                                    </p>
                                </div>
                                <div style={{ marginTop: '15px' }}>
                                    <button onClick={() => setSelectedClub(club)} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                                        Open Hub
                                    </button>
                                </div>
                            </div>
                        ))}
                        {joinedClubs.length === 0 && <p style={{ color: '#666' }}>You haven't joined any clubs yet.</p>}
                    </div>

                    <h2 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>All Clubs</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {otherClubs.map(club => (
                            <div key={club.id} style={cardStyle}>
                                <div>
                                    <h3
                                        onClick={() => setSelectedClub(club)}
                                        style={{ margin: '0 0 10px 0', cursor: 'pointer' }}
                                    >
                                        {club.name || 'Unnamed Club'}
                                    </h3>
                                    <p style={{ color: '#666', fontSize: '0.9rem', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {club.description || 'No description.'}
                                    </p>
                                </div>
                                <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <button
                                        onClick={() => handleJoinClub(club)}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#28a745',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {club.requiresApproval ? 'Request to Join' : 'Join Now'}
                                    </button>
                                    <span
                                        onClick={() => setSelectedClub(club)}
                                        style={{ fontSize: '0.9rem', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        Details
                                    </span>
                                </div>
                            </div>
                        ))}
                        {otherClubs.length === 0 && <p style={{ color: '#666' }}>No other clubs found.</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clubs;
