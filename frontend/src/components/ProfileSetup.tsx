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
        fullName: user.displayName || '',
        regNo: '',
        department: 'CSE',
        year: '1st',
        college: 'Madras Institute of Technology',
        officialMail: '',
        personalMail: user.email || '',
        phone: user.phoneNumber || '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await setDoc(doc(db, 'users', user.uid), {
                username: formData.username,
                full_name: formData.fullName,
                regNo: formData.regNo,
                department: formData.department,
                year: formData.year,
                college: formData.college,
                officialMail: formData.officialMail,
                personalMail: formData.personalMail,
                phone: formData.phone,
                role: 'user',
                joined_clubs: [],
                isProfileComplete: true,
                photoURL: user.photoURL || '',
                createdAt: new Date().toISOString()
            }, { merge: true });

            onComplete();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = { padding: '10px', borderRadius: '6px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' as const };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '50px', fontFamily: 'Inter, sans-serif' }}>
            <h2>Complete Your Profile</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>Please provide the following details to continue.</p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '350px', width: '100%' }}>
                <input name="username" placeholder="Username (Unique)" value={formData.username} onChange={handleChange} required style={inputStyle} />
                <input name="fullName" placeholder="Full Name" value={formData.fullName} onChange={handleChange} required style={inputStyle} />
                <input name="regNo" placeholder="Register Number" value={formData.regNo} onChange={handleChange} required style={inputStyle} />

                <select name="year" value={formData.year} onChange={handleChange} style={inputStyle}>
                    <option value="1st">1st Year</option>
                    <option value="2nd">2nd Year</option>
                    <option value="3rd">3rd Year</option>
                    <option value="4th">4th Year</option>
                </select>

                <select name="department" value={formData.department} onChange={handleChange} style={inputStyle}>
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="IT">IT</option>
                    <option value="Aero">Aero</option>
                    <option value="Auto">Auto</option>
                    <option value="EIE">EIE</option>
                    <option value="Prod">Prod</option>
                    <option value="Rubber">Rubber</option>
                    <option value="IBT">IBT</option>
                </select>

                <input name="college" placeholder="College Name" value={formData.college} disabled style={{ ...inputStyle, background: '#f0f0f0' }} />
                <input name="officialMail" type="email" placeholder="College Email ID" value={formData.officialMail} onChange={handleChange} required style={inputStyle} />
                <input name="personalMail" type="email" placeholder="Personal Email ID" value={formData.personalMail} onChange={handleChange} required style={inputStyle} />
                <input name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required style={inputStyle} />

                <button type="submit" disabled={loading} style={{ padding: '12px', background: '#646cff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {loading ? 'Saving...' : 'Save & Continue'}
                </button>
                {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
            </form>
        </div>
    );
};

export default ProfileSetup;
