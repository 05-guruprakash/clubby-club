import { useEffect, useState } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebaseConfig';
import { useAuth } from '../AuthContext';
import AdminGuard from './AdminGuard';
import AdminTools from './AdminTools';

interface UserProfile {
    username: string;
    firstName: string;
    lastName: string;
    email: string; // From auth or officialMail
    regNo: string;
    department: string;
    officialMail: string;
}

const Profile = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            const docSnap = await getDoc(doc(db, 'users', user.uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfile({
                    username: data.username || 'N/A',
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    email: user.email || '',
                    regNo: data.regNo || 'N/A',
                    department: data.department || 'N/A',
                    officialMail: data.officialMail || 'N/A'
                });
            }
        };
        fetchProfile();
    }, [user]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            // App.tsx handles the redirect due to auth state change
        } catch (e) {
            console.error("Logout failed", e);
        }
    };

    if (!profile) return <div>Loading Profile...</div>;

    return (
        <div style={{ maxWidth: '400px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>My Profile</h2>
            <div style={{ marginBottom: '20px' }}>
                <p><strong>Username:</strong> {profile.username}</p>
                <p><strong>Name:</strong> {profile.firstName} {profile.lastName}</p>
                <p><strong>Reg No:</strong> {profile.regNo}</p>
                <p><strong>Email:</strong> {profile.officialMail} (Official)</p>
                <p><strong>Department:</strong> {profile.department}</p>
            </div>

            <button
                onClick={handleLogout}
                style={{
                    background: 'red',
                    color: 'white',
                    padding: '10px 20px',
                    border: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    marginTop: '20px'
                }}
            >
                Logout
            </button>

            <div style={{ marginTop: '40px', borderTop: '2px solid #eee' }}>
                <AdminGuard>
                    <AdminTools />
                </AdminGuard>
            </div>
        </div>
    );
};

export default Profile;
