import { useEffect, useState } from 'react';
import { getDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../firebaseConfig';
import { useAuth } from '../AuthContext';
import AdminGuard from './AdminGuard';
import AdminTools from './AdminTools';
import { API_BASE } from '../config';

// Types
interface UserProfile {
    username: string;
    full_name: string;
    email: string;
    phone: string;
    photoURL?: string;
    regNo: string;
    department: string;
    year: string;
    college: string;
    officialMail: string;
    joined_clubs?: string[];
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
    status: string;
}

interface ProfileProps {
    setView?: (view: string) => void;
    isDarkMode?: boolean;
}

const Profile = ({ setView, isDarkMode = true }: ProfileProps) => {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [myClubs, setMyClubs] = useState<ClubData[]>([]);
    const [myEvents, setMyEvents] = useState<EventData[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
    const [loading, setLoading] = useState(true);
    const [scrollY, setScrollY] = useState(0);

    // New State for Upload
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);



    // Parallax scroll effect
    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                alert("File size exceeds 10MB limit.");
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!user || !editForm) return;
        setUploading(true);
        try {
            let photoBase64 = null;
            let photoType = null;

            if (selectedFile) {
                const reader = new FileReader();
                photoBase64 = await new Promise<string>((resolve) => {
                    reader.onload = () => {
                        const res = reader.result as string;
                        resolve(res.split(',')[1]);
                    };
                    reader.readAsDataURL(selectedFile);
                });
                photoType = selectedFile.type;
            }

            const token = await user.getIdToken();
            const response = await fetch(`${API_BASE}/user/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    full_name: editForm.full_name,
                    username: editForm.username,
                    phone: editForm.phone,
                    photoBase64,
                    photoType,
                    photoURL: editForm.photoURL
                })
            });

            if (!response.ok) throw new Error("Backend update failed");

            const result = await response.json();
            const updatedProfile = {
                ...editForm,
                photoURL: result.photoURL || editForm.photoURL
            } as UserProfile;

            setProfile(updatedProfile);
            setEditForm(updatedProfile);
            setIsEditing(false);
            setSelectedFile(null);
            setPreviewUrl(null);
            alert("Profile updated successfully!");
        } catch (e) {
            console.error("Update failed", e);
            alert("Failed to update profile. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!user || !user.email) return;
        if (confirm(`Send password reset email to ${user.email}?`)) {
            try {
                await sendPasswordResetEmail(auth, user.email);
                alert("Password reset email sent! Check your inbox.");
            } catch (e: any) {
                console.error("Reset password failed", e);
                alert("Failed to send reset email: " + e.message);
            }
        }
    };

    // Theme colors
    const theme = {
        bg: isDarkMode ? '#050505' : '#f8f9fa',
        cardBg: isDarkMode ? 'rgba(255,255,255,0.03)' : '#ffffff',
        border: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        text: isDarkMode ? '#ffffff' : '#111111',
        subtext: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
        accent: '#bcec15',
        accentSubtle: isDarkMode ? 'rgba(188, 236, 21, 0.1)' : 'rgba(188, 236, 21, 0.2)',
    };

    if (loading) {
        return (
            <div style={{
                height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Outfit", "Inter", sans-serif'
            }}>
                <div style={{
                    color: theme.accent, fontSize: '1.2rem', fontWeight: '900',
                    letterSpacing: '2px', animation: 'pulse 1.5s infinite'
                }}>LOADING PROFILE...</div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div style={{
                height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: theme.text, fontFamily: '"Outfit", "Inter", sans-serif'
            }}>
                <div>Profile not found.</div>
            </div>
        );
    }

    return (
        <div style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '20px',
            paddingBottom: '120px',
            color: theme.text,
            fontFamily: '"Outfit", "Inter", sans-serif'
        }}>
            {/* Hero Header with Parallax */}
            <div style={{
                position: 'relative',
                height: '280px',
                borderRadius: '40px',
                overflow: 'hidden',
                marginBottom: '32px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                border: `1px solid ${theme.border}`,
                animation: 'fadeIn 0.6s ease'
            }}>
                {/* Parallax Background */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: `linear-gradient(135deg, ${isDarkMode ? '#0a0a0a' : '#e0e0e0'} 0%, ${isDarkMode ? '#1a1a1a' : '#f5f5f5'} 50%, #bcec15 200%)`,
                    backgroundSize: 'cover',
                    transform: `translateY(${scrollY * 0.2}px)`,
                    transition: 'transform 0.1s ease-out',
                    zIndex: 1
                }}></div>

                {/* Decorative Elements */}
                <div style={{
                    position: 'absolute',
                    top: '20%', right: '10%',
                    width: '150px', height: '150px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${theme.accent}33 0%, transparent 70%)`,
                    filter: 'blur(40px)',
                    zIndex: 2,
                    transform: `translate(${scrollY * 0.1}px, ${scrollY * 0.05}px)`
                }}></div>

                {/* Profile Content */}
                <div style={{
                    position: 'relative', zIndex: 3, height: '100%',
                    padding: '32px 40px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
                        {/* Avatar */}
                        <div style={{
                            width: '110px', height: '110px',
                            minWidth: '110px',
                            borderRadius: '32px',
                            background: profile.photoURL ? `url(${profile.photoURL}) center/cover` : theme.accent,
                            border: `3px solid ${theme.accent}`,
                            boxShadow: `0 15px 40px ${theme.accent}33`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2.8rem', fontWeight: '950', color: '#000',
                            overflow: 'hidden',
                            transition: '0.3s cubic-bezier(0.23, 1, 0.32, 1)'
                        }}>
                            {!profile.photoURL && (profile.full_name?.[0]?.toUpperCase() || 'U')}
                        </div>

                        {/* Name & Username */}
                        <div style={{ flex: 1 }}>
                            <div style={{
                                background: theme.accent, color: '#000',
                                display: 'inline-block',
                                padding: '4px 14px', borderRadius: '50px',
                                fontSize: '0.65rem', fontWeight: '950', letterSpacing: '1.5px',
                                marginBottom: '10px'
                            }}>VERIFIED</div>
                            <h1 style={{
                                margin: 0, fontSize: '2.8rem', fontWeight: '950',
                                letterSpacing: '-2.5px', lineHeight: '1',
                                textShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                color: '#fff'
                            }}>{profile.full_name?.toUpperCase() || 'USER'}</h1>
                            <p style={{
                                margin: '6px 0 0 0', fontSize: '1.1rem',
                                color: theme.accent, fontWeight: '700', opacity: 0.9,
                                letterSpacing: '0.5px'
                            }}>@{profile.username}</p>
                        </div>

                        {/* Edit Button */}
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            style={{
                                background: isEditing ? theme.accent : 'rgba(255,255,255,0.08)',
                                backdropFilter: 'blur(20px)',
                                color: isEditing ? '#000' : '#fff',
                                border: `1px solid ${isEditing ? theme.accent : 'rgba(255,255,255,0.1)'}`,
                                padding: '14px 28px', borderRadius: '18px',
                                fontWeight: '900', cursor: 'pointer', fontSize: '0.75rem',
                                transition: '0.3s cubic-bezier(0.23, 1, 0.32, 1)',
                                letterSpacing: '0.5px'
                            }}
                        >{isEditing ? 'CLOSE PANEL' : 'EDIT PROFILE'}</button>
                    </div>
                </div>
            </div>

            {/* Edit Form Modal */}
            {isEditing && (
                <div style={{
                    background: isDarkMode ? 'rgba(10,10,10,0.8)' : '#fff',
                    backdropFilter: 'blur(30px)',
                    borderRadius: '35px',
                    padding: '35px',
                    marginBottom: '32px',
                    border: `1px solid ${theme.border}`,
                    boxShadow: '0 30px 60px rgba(0,0,0,0.2)',
                    animation: 'fadeIn 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            {/* Small Preview in Form */}
                            <div style={{
                                width: '50px', height: '50px', borderRadius: '15px',
                                background: previewUrl ? `url(${previewUrl}) center/cover` : (profile.photoURL ? `url(${profile.photoURL}) center/cover` : theme.accent),
                                border: `2px solid ${theme.accent}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1rem', fontWeight: '950', color: '#000', overflow: 'hidden'
                            }}>
                                {!previewUrl && !profile.photoURL && (profile.full_name?.[0]?.toUpperCase() || 'U')}
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '950', color: theme.accent, letterSpacing: '1px' }}>PROFILE ADJUSTMENT</h3>
                        </div>
                        <button
                            onClick={handleChangePassword}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: theme.subtext,
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >RESET PASSWORD</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {[
                            { key: 'full_name', label: 'FULL NAME', placeholder: 'Enter Name' },
                            { key: 'username', label: 'NICKNAME', placeholder: 'Enter Username' },
                            { key: 'phone', label: 'MOBILE CONTACT', placeholder: '+XX XXXXX XXXXX' }
                        ].map(field => (
                            <div key={field.key}>
                                <label style={{
                                    display: 'block', fontSize: '0.65rem', fontWeight: '950',
                                    color: theme.subtext, marginBottom: '10px', letterSpacing: '1.5px'
                                }}>{field.label}</label>
                                <input
                                    style={{
                                        width: '100%',
                                        height: '58px',
                                        background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f9f9f9',
                                        border: `1px solid ${theme.border}`,
                                        color: theme.text,
                                        padding: '0 24px',
                                        borderRadius: '18px',
                                        fontSize: '0.95rem',
                                        fontWeight: '600',
                                        outline: 'none',
                                        transition: '0.3s ease',
                                        boxSizing: 'border-box'
                                    }}
                                    value={(editForm as any)[field.key] || ''}
                                    onChange={e => setEditForm({ ...editForm, [field.key]: e.target.value })}
                                    placeholder={field.placeholder}
                                />
                            </div>
                        ))}

                        {/* Avatar Upload Option */}
                        <div>
                            <label style={{
                                display: 'block', fontSize: '0.65rem', fontWeight: '950',
                                color: theme.subtext, marginBottom: '10px', letterSpacing: '1.5px'
                            }}>AVATAR UPLOAD (MAX 10MB)</label>
                            <label style={{
                                width: '100%',
                                height: '58px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                background: isDarkMode ? 'rgba(188, 236, 21, 0.05)' : '#f0f0f0',
                                border: `1px dashed ${theme.accent}66`,
                                color: theme.text,
                                padding: '0 24px',
                                borderRadius: '18px',
                                fontSize: '0.85rem',
                                fontWeight: '900',
                                cursor: 'pointer',
                                transition: '0.3s',
                                boxSizing: 'border-box',
                                letterSpacing: '1px'
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                    {selectedFile ? selectedFile.name.toUpperCase() : 'CHOOSE PHOTO'}
                                </span>
                                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                            </label>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '30px' }}>
                        <button
                            onClick={handleSave}
                            disabled={uploading}
                            style={{
                                height: '58px',
                                borderRadius: '18px',
                                background: uploading ? theme.subtext : theme.accent,
                                color: '#000',
                                fontWeight: '950',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                transition: '0.3s',
                                opacity: uploading ? 0.7 : 1,
                                boxSizing: 'border-box',
                                letterSpacing: '0.5px'
                            }}
                        >{uploading ? 'UPLOADING...' : 'SAVE UPDATES'}</button>
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setSelectedFile(null);
                                setPreviewUrl(null);
                            }}
                            style={{
                                height: '58px',
                                borderRadius: '18px',
                                background: 'transparent',
                                color: theme.text,
                                fontWeight: '900',
                                border: `1px solid ${theme.border}`,
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                transition: '0.3s',
                                boxSizing: 'border-box',
                                letterSpacing: '0.5px'
                            }}
                        >CANCEL</button>
                    </div>
                </div>
            )}

            {/* Stats Row */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px',
                marginBottom: '24px', animation: 'fadeIn 0.5s ease 0.1s both'
            }}>
                {[
                    { label: 'CLUBS', val: myClubs.length },
                    { label: 'EVENTS', val: myEvents.length },
                    { label: 'YEAR', val: profile.year || 'N/A' }
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

            {/* Info Cards */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
                marginBottom: '24px', animation: 'fadeIn 0.5s ease 0.2s both'
            }}>
                {[
                    { label: 'DEPARTMENT', val: profile.department },
                    { label: 'COLLEGE', val: profile.college },
                    { label: 'REG NO', val: profile.regNo },
                    { label: 'EMAIL', val: profile.officialMail }
                ].map((item, i) => (
                    <div key={i} style={{
                        background: theme.cardBg, padding: '20px 24px', borderRadius: '24px',
                        border: `1px solid ${theme.border}`
                    }}>
                        <div style={{ fontSize: '0.55rem', fontWeight: '950', letterSpacing: '1.5px', color: theme.subtext, marginBottom: '6px' }}>{item.label}</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: theme.text }}>{item.val}</div>
                    </div>
                ))}
            </div>

            {/* My Clubs Section */}
            <div style={{
                marginBottom: '24px', animation: 'fadeIn 0.5s ease 0.3s both'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', letterSpacing: '0.5px' }}>MY CLUBS</h2>
                    <div style={{ padding: '4px 12px', background: theme.accentSubtle, color: theme.accent, borderRadius: '50px', fontSize: '0.6rem', fontWeight: '900' }}>{myClubs.length} JOINED</div>
                </div>

                {myClubs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {myClubs.map(club => (
                            <div
                                key={club.id}
                                style={{
                                    background: theme.cardBg, padding: '20px 24px', borderRadius: '24px',
                                    border: `1px solid ${theme.border}`, display: 'flex',
                                    justifyContent: 'space-between', alignItems: 'center',
                                    transition: '0.3s', cursor: 'pointer'
                                }}
                                onClick={() => setView && setView('clubs')}
                            >
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontWeight: '800', fontSize: '1rem' }}>{club.name}</h4>
                                    <span style={{
                                        fontSize: '0.65rem', fontWeight: '900', letterSpacing: '1px',
                                        color: theme.accent, opacity: 0.7
                                    }}>{club.role.toUpperCase()}</span>
                                </div>
                                <div style={{ color: theme.accent, fontWeight: '900', fontSize: '0.8rem' }}>VIEW &rarr;</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{
                        background: theme.cardBg, padding: '40px', borderRadius: '28px',
                        border: `1px dashed ${theme.border}`, textAlign: 'center'
                    }}>
                        <p style={{ opacity: 0.4, fontWeight: '700', margin: 0 }}>No clubs joined yet.</p>
                        <button
                            onClick={() => setView && setView('clubs')}
                            style={{
                                marginTop: '16px', background: theme.accent, color: '#000',
                                border: 'none', padding: '12px 24px', borderRadius: '14px',
                                fontWeight: '900', cursor: 'pointer'
                            }}
                        >EXPLORE CLUBS</button>
                    </div>
                )}
            </div>

            {/* Events Section */}
            <div style={{ marginBottom: '24px', animation: 'fadeIn 0.5s ease 0.4s both' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', letterSpacing: '0.5px' }}>MY EVENTS</h2>
                    <div style={{ padding: '4px 12px', background: theme.accentSubtle, color: theme.accent, borderRadius: '50px', fontSize: '0.6rem', fontWeight: '900' }}>{myEvents.length} REGISTERED</div>
                </div>

                <div style={{ background: theme.cardBg, borderRadius: '28px', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
                    {/* Upcoming */}
                    <div style={{ padding: '20px 24px', borderBottom: `1px solid ${theme.border}` }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.7rem', fontWeight: '950', color: theme.accent, letterSpacing: '1.5px' }}>UPCOMING</h4>
                        {myEvents.filter(e => e.status === 'upcoming').length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {myEvents.filter(e => e.status === 'upcoming').map(e => (
                                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>📅 {e.title}</span>
                                        <span style={{ fontSize: '0.75rem', color: theme.accent, fontWeight: '700' }}>{e.date}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ margin: 0, opacity: 0.4, fontSize: '0.85rem' }}>No upcoming events.</p>
                        )}
                    </div>

                    {/* Past */}
                    <div style={{ padding: '20px 24px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.7rem', fontWeight: '950', color: theme.subtext, letterSpacing: '1.5px' }}>COMPLETED</h4>
                        {myEvents.filter(e => e.status === 'past').length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {myEvents.filter(e => e.status === 'past').map(e => (
                                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6 }}>
                                        <span style={{ color: theme.accent }}>✓</span>
                                        <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{e.title}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ margin: 0, opacity: 0.4, fontSize: '0.85rem' }}>No past events.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Admin Section */}
            <AdminGuard>
                <div style={{
                    marginBottom: '24px', animation: 'fadeIn 0.5s ease 0.5s both',
                    background: theme.accentSubtle, borderRadius: '28px',
                    padding: '24px', border: `1px solid ${theme.accent}33`
                }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: '950', color: theme.accent }}>ADMIN CONTROLS</h3>
                    <p style={{ margin: '0 0 20px 0', fontSize: '0.8rem', opacity: 0.6 }}>Manage club settings and members</p>
                    <AdminTools />
                </div>
            </AdminGuard>

            {/* Logout Button */}
            <button
                onClick={handleLogout}
                style={{
                    width: '100%', padding: '18px', borderRadius: '20px',
                    background: 'rgba(220, 38, 38, 0.15)', color: '#ff4444',
                    border: '1px solid rgba(220, 38, 38, 0.2)', fontWeight: '900',
                    cursor: 'pointer', fontSize: '0.9rem', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '10px',
                    transition: '0.3s', animation: 'fadeIn 0.5s ease 0.6s both'
                }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                LOGOUT
            </button>

            {/* Animations */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;600;700;800;900&display=swap');
                @keyframes fadeIn { 
                    from { opacity: 0; transform: translateY(15px); } 
                    to { opacity: 1; transform: translateY(0); } 
                }
                @keyframes pulse { 
                    0% { opacity: 0.6; } 
                    50% { opacity: 1; } 
                    100% { opacity: 0.6; } 
                }
            `}</style>
        </div>
    );
};

export default Profile;
