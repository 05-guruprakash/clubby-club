import { useState, type ChangeEvent, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

interface SignUpProps {
    onToggle: () => void;
    hideFooter?: boolean;
    isNested?: boolean;
    themeColor?: string;
    isDarkMode?: boolean;
}

const SignUp = ({ onToggle, hideFooter, isNested, themeColor = '#bcec15', isDarkMode = true }: SignUpProps) => {
    const [formData, setFormData] = useState({
        username: '',
        fullName: '',
        regNo: '',
        year: '1st',
        department: 'CSE',
        college: 'Madras Institute of Technology',
        officialMail: '',
        personalMail: '',
        phoneNumber: '',
        password: '',
        confirmPassword: '',
        termsAccepted: false
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleGoogleSignUp = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        // @ts-ignore
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, termsAccepted: e.target.checked }));
    };

    const validate = () => {
        if (formData.password !== formData.confirmPassword) return "Passwords do not match";
        if (!formData.termsAccepted) return "Accept terms to continue";
        if (formData.password.length < 6) return "Password too short (min 6 char)";
        return null;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            setLoading(false);
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.personalMail, formData.password);
            const user = userCredential.user;

            await setDoc(doc(db, 'users', user.uid), {
                username: formData.username,
                full_name: formData.fullName,
                regNo: formData.regNo,
                year: formData.year,
                department: formData.department,
                college: formData.college,
                officialMail: formData.officialMail,
                personalMail: formData.personalMail,
                phone: formData.phoneNumber,
                role: 'user',
                joined_clubs: [],
                createdAt: new Date().toISOString()
            });
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const glassStyle: React.CSSProperties = {
        background: isNested ? 'transparent' : (isDarkMode ? 'rgba(10, 10, 15, 0.85)' : 'rgba(255, 255, 255, 0.9)'),
        padding: isNested ? '0' : '40px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '24px',
        color: isDarkMode ? 'white' : '#1a1a1a',
        zIndex: 10,
        transition: 'all 0.4s'
    };

    const inputStyle: React.CSSProperties = {
        background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
        border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
        borderRadius: '12px',
        padding: '12px 18px',
        color: isDarkMode ? 'white' : '#1a1a1a',
        fontSize: '0.95rem',
        outline: 'none',
        transition: 'all 0.3s',
        width: '100%',
        boxSizing: 'border-box'
    };

    const primaryButtonStyle: React.CSSProperties = {
        background: themeColor,
        color: 'black',
        border: 'none',
        padding: '16px',
        borderRadius: '16px',
        fontSize: '1rem',
        fontWeight: '800',
        cursor: 'pointer',
        boxShadow: `0 8px 20px ${themeColor}4d`,
        transition: 'all 0.3s ease',
        width: '100%',
        textTransform: 'uppercase',
        letterSpacing: '1px'
    };

    return (
        <div style={glassStyle}>
            <div style={{ textAlign: 'center', width: '100%' }}>
                <h1 style={{ fontSize: '3rem', fontWeight: '900', marginBottom: '24px', letterSpacing: '-1.5px' }}>SIGN UP</h1>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <input name="username" placeholder="Username" value={formData.username} onChange={handleChange} required style={inputStyle} />
                    <input name="fullName" placeholder="Full Name" value={formData.fullName} onChange={handleChange} required style={inputStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <input name="regNo" placeholder="Reg No" value={formData.regNo} onChange={handleChange} required style={inputStyle} />
                    <select name="year" value={formData.year} onChange={handleChange} style={inputStyle}>
                        <option value="1st">1st Year</option>
                        <option value="2nd">2nd Year</option>
                        <option value="3rd">3rd Year</option>
                        <option value="4th">4th Year</option>
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <select name="department" value={formData.department} onChange={handleChange} style={inputStyle}>
                        <option value="CSE">CSE</option>
                        <option value="ECE">ECE</option>
                        <option value="Mechanical">Mechanical</option>
                        <option value="IT">IT</option>
                    </select>
                    <input name="phoneNumber" placeholder="Phone Number" value={formData.phoneNumber} onChange={handleChange} required style={inputStyle} />
                </div>

                <input name="officialMail" type="email" placeholder="College Email" value={formData.officialMail} onChange={handleChange} required style={inputStyle} />
                <input name="personalMail" type="email" placeholder="Personal Email" value={formData.personalMail} onChange={handleChange} required style={inputStyle} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} required style={inputStyle} />
                    <input name="confirmPassword" type="password" placeholder="Confirm" value={formData.confirmPassword} onChange={handleChange} required style={inputStyle} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0,0,0,0.5)' }}>
                    <input type="checkbox" checked={formData.termsAccepted} onChange={handleCheckboxChange} id="terms" required />
                    <label htmlFor="terms">I agree to the NEXUS Terms & Privacy</label>
                </div>

                <button type="submit" disabled={loading} style={primaryButtonStyle}>{loading ? 'Creating...' : 'CREATE ACCOUNT'}</button>
            </form>

            <div style={{ position: 'relative', textAlign: 'center' }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '1px', background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', zIndex: 0 }} />
                <span style={{ position: 'relative', background: isDarkMode ? '#05050A' : '#ffffff', padding: '0 15px', color: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0,0,0,0.3)', fontSize: '0.9rem', fontWeight: 'bold' }}>OR</span>
            </div>

            <button
                onClick={handleGoogleSignUp}
                style={{ ...inputStyle, background: isDarkMode ? 'white' : '#f0f0f0', color: 'black', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', border: 'none' }}
            >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" height="20" alt="G" />
                Sign up with Google
            </button>

            {error && <div style={{ color: '#ef4444', fontSize: '0.9rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '12px' }}>{error}</div>}

            {!hideFooter && (
                <div style={{ textAlign: 'center' }}>
                    <span style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0,0,0,0.4)', fontSize: '1rem' }}>Already joined? </span>
                    <button
                        onClick={onToggle}
                        style={{ background: 'transparent', border: 'none', color: themeColor, cursor: 'pointer', padding: 0, fontWeight: '800', fontSize: '1rem' }}
                    >
                        Sign In
                    </button>
                </div>
            )}
        </div>
    );
};

export default SignUp;
