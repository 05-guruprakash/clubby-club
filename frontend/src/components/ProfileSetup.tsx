import { useState, type ChangeEvent, type FormEvent } from 'react';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { User } from 'firebase/auth';

interface ProfileSetupProps {
    user: User;
    onComplete: () => void;
}

const ProfileSetup = ({ user, onComplete }: ProfileSetupProps) => {
    const [formData, setFormData] = useState({
        username: '',
        regNo: '',
        department: '',
        year: '',
        college: '',
        officialMail: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await setDoc(doc(db, 'users', user.uid), {
                username: formData.username,
                regNo: formData.regNo,
                department: formData.department,
                year: formData.year,
                college: formData.college,
                officialMail: formData.officialMail,
                secondary_password: formData.password,
                isProfileComplete: true,
                personalMail: user.email,
                full_name: user.displayName || 'User',
                photoURL: user.photoURL || '',
                updated_at: new Date()
            }, { merge: true });

            onComplete();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '50px' }}>
            <h2>Complete Your Profile</h2>
            <p>Please provide the following details to continue.</p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px', width: '100%' }}>
                <input name="username" placeholder="Username" onChange={handleChange} required />
                <input name="regNo" placeholder="Register Number" onChange={handleChange} required />
                <input name="department" placeholder="Department" onChange={handleChange} required />
                <input name="year" placeholder="Year" onChange={handleChange} required />
                <input name="college" placeholder="College Name" onChange={handleChange} required />
                <input name="officialMail" type="email" placeholder="College Mail ID" onChange={handleChange} required />
                <input name="password" type="password" placeholder="Set a Password" onChange={handleChange} required />

                <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save & Continue'}</button>
                {error && <div style={{ color: 'red' }}>{error}</div>}
            </form>
        </div>
    );
};

export default ProfileSetup;
