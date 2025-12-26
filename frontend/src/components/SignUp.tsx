import { useState, type ChangeEvent, type FormEvent } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const SignUp = () => {
    const [formData, setFormData] = useState({
        username: '', // New
        firstName: '',
        lastName: '',
        regNo: '', // Renamed from studentId
        year: '',
        department: '',
        college: '', // New
        officialMail: '', // New
        personalMail: '', // used for auth
        phoneNumber: '',
        password: '' // New entry for form handling
    });
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validate = () => {
        // if (!formData.personalMail.includes('@')) return "Invalid personal email";
        // if (formData.password.length < 6) return "Password too short";
        // if (!formData.regNo.trim()) return "Registration Number required";
        // if (!formData.officialMail.includes('@')) return "Invalid official email";
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
                firstName: formData.firstName,
                lastName: formData.lastName,
                regNo: formData.regNo,
                year: formData.year,
                department: formData.department,
                college: formData.college,
                officialMail: formData.officialMail,
                personalMail: formData.personalMail,
                phoneNumber: formData.phoneNumber,
                role: 'user', // Default role for NEXUS
                joined_clubs: []
            });

            alert('User created successfully!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
            <h3>Sign Up (NEXUS)</h3>
            {/* 9 Fields + Password */}
            <input name="username" placeholder="Username" onChange={handleChange} required />
            <input name="firstName" placeholder="First Name" onChange={handleChange} required />
            <input name="lastName" placeholder="Last Name" onChange={handleChange} required />
            <input name="regNo" placeholder="Reg No" onChange={handleChange} required />
            <input name="year" placeholder="Year" onChange={handleChange} required />
            <input name="department" placeholder="Department" onChange={handleChange} required />
            <input name="college" placeholder="College" onChange={handleChange} required />
            <input name="officialMail" type="email" placeholder="Official Mail" onChange={handleChange} required />
            <input name="personalMail" type="email" placeholder="Personal Mail (Login)" onChange={handleChange} required />
            <input name="phoneNumber" placeholder="Phone Number" onChange={handleChange} required />

            <input name="password" type="password" placeholder="Password" onChange={handleChange} required />

            <button type="submit">Sign Up</button>
            {error && <div style={{ color: 'red' }}>{error}</div>}
        </form>
    );
};

export default SignUp;
