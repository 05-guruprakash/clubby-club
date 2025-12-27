import { useEffect, useState } from 'react';
import { getDoc, doc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebaseConfig';
import { useAuth } from '../AuthContext';
import AdminGuard from './AdminGuard';
import AdminTools from './AdminTools';

// Types
interface UserProfile {
    // Basic Info
    username: string;
    full_name: string;
    email: string;
    phone: string;
    photoURL?: string;

    // Academic Info
    regNo: string;
    department: string;
    year: string;
    college: string;
    officialMail: string;

    // Club Info
    joined_clubs?: string[]; // Array of Club IDs
}

interface ClubData {
    id: string;
    name: string;
    role: string;
}

interface EventData {
    id: string;
    title: string;
    date: string;
    status: string; // upcoming/past
}

interface ProfileProps {
    setView?: (view: string) => void;
}

const Profile = ({ setView }: ProfileProps) => {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [myClubs, setMyClubs] = useState<ClubData[]>([]);
    const [myEvents, setMyEvents] = useState<EventData[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                // 1. Fetch User Profile
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const userProfile: UserProfile = {
                        username: data.username || 'N/A',
                        full_name: data.full_name || (data.firstName ? data.firstName + ' ' + (data.lastName || '') : 'User'),
                        email: user.email || '',
                        phone: data.phone || '',
                        photoURL: data.photoURL || '',
                        regNo: data.regNo || 'N/A',
                        department: data.department || 'N/A',
                        year: data.year || 'N/A',
                        college: data.college || 'N/A',
                        officialMail: data.officialMail || 'N/A',
                        joined_clubs: data.joined_clubs || []
                    };
                    setProfile(userProfile);
                    setEditForm(userProfile);

                    // 2. Fetch Clubs
                    if (userProfile.joined_clubs && userProfile.joined_clubs.length > 0) {
                        const clubPromises = userProfile.joined_clubs.map(async (clubId) => {
                            try {
                                const clubSnap = await getDoc(doc(db, 'clubs', clubId));
                                const role = data.roles && data.roles[clubId] ? data.roles[clubId] : 'Member';
                                if (clubSnap.exists()) {
                                    return { id: clubId, name: clubSnap.data().name, role: role };
                                }
                            } catch (e) { console.error("Club fetch err", e); }
                            return null;
                        });
                        const clubs = (await Promise.all(clubPromises)).filter(Boolean) as ClubData[];
                        setMyClubs(clubs);
                    }

                    // 3. Fetch Events
                    try {
                        const eventsQuery = query(collection(db, 'events'), where('participants', 'array-contains', user.uid));
                        const eventSnaps = await getDocs(eventsQuery);
                        const events: EventData[] = [];
                        eventSnaps.forEach(doc => {
                            const d = doc.data();
                            events.push({
                                id: doc.id,
                                title: d.title,
                                date: d.date,
                                status: new Date(d.date) > new Date() ? 'upcoming' : 'past'
                            });
                        });
                        setMyEvents(events);
                    } catch (err) {
                        console.log("Could not fetch events or index missing", err);
                    }
                }
            } catch (err) {
                console.error("Error fetching profile", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (e) {
            console.error("Logout failed", e);
        }
    };

    const handleSave = async () => {
        if (!user || !editForm) return;
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                full_name: editForm.full_name,
                phone: editForm.phone,
                photoURL: editForm.photoURL,
                username: editForm.username // Added username update
            });
            setProfile(editForm as UserProfile);
            setIsEditing(false);
            alert("Profile updated successfully!");
        } catch (e) {
            console.error("Update failed", e);
            alert("Failed to update profile");
        }
    };

    const handleChangePassword = async () => {
        if (!user || !user.email) return;
        if (confirm(`Send password reset email to ${user.email}?`)) {
            try {
                // Dynamic import to avoid import errors if module not found in tool context
                const { sendPasswordResetEmail } = await import('firebase/auth');
                await sendPasswordResetEmail(auth, user.email);
                alert("Password reset email sent! Check your inbox.");
            } catch (e: any) {
                console.error("Reset password failed", e);
                alert("Failed to send reset email: " + e.message);
            }
        }
    };

    if (loading) return <div style={{ color: 'white', padding: '20px' }}>Loading Profile...</div>;
    if (!profile) return <div style={{ color: 'white', padding: '20px' }}>Profile not found.</div>;

    const styles = {
        container: {
            maxWidth: '100%',
            margin: '0 auto',
            padding: '10px 10px 80px 10px', // Extra button padding for bottom navigation
            color: '#e0e0e0',
            fontFamily: "'Inter', 'Segoe UI', sans-serif"
        },
        profileCard: {
            background: 'rgba(20, 20, 20, 0.95)',
            padding: '24px',
            borderRadius: '20px',
            border: '1px solid #333',
            marginBottom: '20px',
            position: 'relative' as const
        },
        profileHeader: {
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '24px'
        },
        avatar: {
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            objectFit: 'cover' as const,
            border: '2px solid #fff',
            backgroundColor: '#333'
        },
        nameSection: {
            flex: 1
        },
        name: {
            fontSize: '1.5rem',
            margin: '0',
            color: '#fff',
            fontWeight: 700
        },
        username: {
            color: '#888',
            margin: '4px 0 0 0',
            fontSize: '0.9rem'
        },
        settingsBtn: {
            position: 'absolute' as const,
            top: '20px',
            right: '20px',
            background: '#333',
            border: '1px solid #444',
            color: '#fff',
            borderRadius: '8px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
        },
        infoGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            borderTop: '1px solid #333',
            paddingTop: '20px'
        },
        infoItem: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '4px'
        },
        infoLabel: {
            fontSize: '0.8rem',
            color: '#888'
        },
        infoValue: {
            color: '#fff',
            fontWeight: 500,
            fontSize: '0.95rem'
        },
        sectionCard: {
            background: 'rgba(20, 20, 20, 0.95)',
            padding: '24px',
            borderRadius: '20px',
            border: '1px solid #333',
            marginBottom: '20px'
        },
        sectionTitle: {
            fontSize: '1.1rem',
            fontWeight: 700,
            margin: '0 0 4px 0',
            color: '#fff'
        },
        sectionSubtitle: {
            fontSize: '0.85rem',
            color: '#666',
            marginBottom: '20px'
        },
        logoutBtn: {
            width: '100%',
            padding: '16px',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
        },
        editInput: {
            width: '100%',
            background: '#222',
            border: '1px solid #444',
            color: 'white',
            padding: '8px',
            borderRadius: '6px',
            marginBottom: '10px'
        },
        button: {
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600
        }
    };

    return (
        <div style={styles.container}>
            {/* Profile Card */}
            <div style={styles.profileCard}>
                <button
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        background: '#333',
                        border: '1px solid #444',
                        color: 'white',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                    }}
                    onClick={() => setIsEditing(!isEditing)}
                >
                    {isEditing ? 'Close' : 'Edit Profile'}
                </button>

                {isEditing ? (
                    <div>
                        <h3 style={{ marginBottom: '15px' }}>Edit Profile</h3>
                        <input style={styles.editInput} value={editForm.full_name || ''} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="Full Name" />
                        <input style={styles.editInput} value={editForm.username || ''} onChange={e => setEditForm({ ...editForm, username: e.target.value })} placeholder="Username" />
                        <input style={styles.editInput} value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Phone" />
                        <input style={styles.editInput} value={editForm.photoURL || ''} onChange={e => setEditForm({ ...editForm, photoURL: e.target.value })} placeholder="Photo URL" />

                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button style={{ ...styles.button, background: '#646cff', color: 'white' }} onClick={handleSave}>Save</button>
                            <button style={{ ...styles.button, background: '#333', color: '#ccc' }} onClick={() => setIsEditing(false)}>Cancel</button>
                        </div>
                        <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '10px' }}>
                            <button style={{ ...styles.button, background: '#333', color: 'white', marginRight: '10px' }} onClick={handleChangePassword}>Change Password</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={styles.profileHeader}>
                            <img src={profile.photoURL || 'https://via.placeholder.com/150'} alt="Avatar" style={styles.avatar} />
                            <div style={styles.nameSection}>
                                <h2 style={styles.name}>{profile.full_name}</h2>
                                <p style={styles.username}>@{profile.username}</p>
                            </div>
                        </div>

                        <div style={styles.infoGrid}>
                            <div style={styles.infoItem}>
                                <span style={styles.infoLabel}>Branch</span>
                                <span style={styles.infoValue}>{profile.department}</span>
                            </div>
                            <div style={styles.infoItem}>
                                <span style={styles.infoLabel}>Year</span>
                                <span style={styles.infoValue}>Year {profile.year}</span>
                            </div>
                            <div style={styles.infoItem}>
                                <span style={styles.infoLabel}>Email</span>
                                <span style={{ ...styles.infoValue, fontSize: '0.85rem' }}>{profile.officialMail}</span>
                            </div>
                            <div style={styles.infoItem}>
                                <span style={styles.infoLabel}>Phone</span>
                                <span style={styles.infoValue}>{profile.phone || 'N/A'}</span>
                            </div>
                            <div style={{ ...styles.infoItem, gridColumn: '1 / -1' }}>
                                <span style={styles.infoLabel}>Register Number</span>
                                <span style={styles.infoValue}>{profile.regNo}</span>
                            </div>
                            <div style={{ ...styles.infoItem, gridColumn: '1 / -1' }}>
                                <span style={styles.infoLabel}>College</span>
                                <span style={styles.infoValue}>{profile.college}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* My Clubs Section */}
            <div style={styles.sectionCard}>
                <h3 style={styles.sectionTitle}>My Clubs</h3>
                <p style={styles.sectionSubtitle}>Clubs you are a member of</p>

                {myClubs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {myClubs.map(club => (
                            <div key={club.id} style={{ background: '#2a2a2a', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 5px 0' }}>{club.name}</h4>
                                    <span style={{ fontSize: '0.8rem', color: '#888', background: '#1a1a1a', padding: '2px 8px', borderRadius: '4px' }}>{club.role}</span>
                                </div>
                                <button style={{ background: 'none', border: 'none', color: '#646cff', cursor: 'pointer', fontWeight: 600 }} onClick={() => setView && setView('clubs')}>Visit</button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ color: '#666', fontStyle: 'italic' }}>You haven't joined any clubs yet.</p>
                )}
            </div>

            {/* Events Section */}
            <div style={styles.sectionCard}>
                <h3 style={styles.sectionTitle}>Events</h3>
                <p style={styles.sectionSubtitle}>Your registered and past events</p>

                <h4 style={{ marginTop: '0', fontSize: '0.95rem', color: '#ddd' }}>Registered Events</h4>
                {myEvents.filter(e => e.status === 'upcoming').length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0, marginBottom: '20px' }}>
                        {myEvents.filter(e => e.status === 'upcoming').map(e => (
                            <li key={e.id} style={{ marginBottom: '10px', fontSize: '0.9rem' }}>📅 {e.title} - <span style={{ color: '#646cff' }}>{e.date}</span></li>
                        ))}
                    </ul>
                ) : (
                    <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '20px' }}>No registered events yet.</p>
                )}

                <h4 style={{ marginTop: '0', fontSize: '0.95rem', color: '#ddd', borderTop: '1px solid #333', paddingTop: '15px' }}>Past Events</h4>
                {myEvents.filter(e => e.status === 'past').length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {myEvents.filter(e => e.status === 'past').map(e => (
                            <li key={e.id} style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#888' }}>✔️ {e.title}</li>
                        ))}
                    </ul>
                ) : (
                    <p style={{ color: '#666', fontSize: '0.9rem' }}>No past events yet.</p>
                )}
            </div>

            <AdminGuard>
                <div style={{ ...styles.sectionCard, border: '1px solid #4f46e5' }}>
                    <h3 style={{ ...styles.sectionTitle, color: '#4f46e5' }}>Admin Controls</h3>
                    <p style={styles.sectionSubtitle}>Manage your club settings</p>
                    <AdminTools />
                </div>
            </AdminGuard>

            <button style={styles.logoutBtn} onClick={handleLogout}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                Logout
            </button>
        </div>
    );
};

export default Profile;
