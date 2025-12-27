import { useState, type ChangeEvent, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const SignUp = () => {
    const [formData, setFormData] = useState({
        username: '',
        fullName: '', // Changed to single Full Name field
        regNo: '',
        year: '1st', // Default to 1st
        department: 'CSE', // Default
        college: 'Madras Institute of Technology', // Pre-filled
        officialMail: '',
        personalMail: '',
        phoneNumber: '',
        password: '',
        confirmPassword: '',
        termsAccepted: false
    });
    const [error, setError] = useState<string | null>(null);

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
        if (!formData.termsAccepted) return "You must accept the terms and conditions";
        if (formData.password.length < 6) return "Password must be at least 6 characters";
        return null;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.personalMail, formData.password);
            const user = userCredential.user;

            await setDoc(doc(db, 'users', user.uid), {
                username: formData.username,
                full_name: formData.fullName, // Storing as full_name
                regNo: formData.regNo,
                year: formData.year,
                department: formData.department,
                college: formData.college,
                officialMail: formData.officialMail,
                personalMail: formData.personalMail,
                phone: formData.phoneNumber, // Standardizing to 'phone'
                role: 'user',
                joined_clubs: [],
                createdAt: new Date().toISOString()
            });

            alert('User created successfully!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const inputStyle = {
        padding: '10px',
        borderRadius: '6px',
        border: '1px solid #ccc',
        fontSize: '0.9rem'
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '350px' }}>
            <h3>Sign Up (NEXUS)</h3>
            <button type="button" onClick={handleGoogleSignUp} style={{ background: '#4285F4', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', marginBottom: '10px', fontWeight: 'bold' }}>
                Sign up with Google
            </button>
            <div style={{ textAlign: 'center', color: '#666' }}>OR</div>
            
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
            <input name="phoneNumber" placeholder="Phone Number" value={formData.phoneNumber} onChange={handleChange} required style={inputStyle} />

            <input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} required style={inputStyle} />
            {/* Basic Strength Indicator could go here */}
            <input name="confirmPassword" type="password" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} required style={inputStyle} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={formData.termsAccepted} onChange={handleCheckboxChange} id="terms" required />
                <label htmlFor="terms">I accept the <a href="#">Terms and Conditions</a></label>
            </div>

            <button type="submit" style={{ background: '#646cff', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
                Create Account
            </button>
            {error && <div style={{ color: 'red', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
        </form>
    );
};

export default SignUp;
