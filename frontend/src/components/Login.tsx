import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { auth } from '../firebaseConfig';

declare global {
    interface Window {
        recaptchaVerifier: RecaptchaVerifier;
    }
}

const Login = () => {
    const [method, setMethod] = useState<'email' | 'phone'>('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleEmailLogin = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const setupRecaptcha = () => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'normal',
                'callback': () => {
                    // reCAPTCHA solved
                },
                'expired-callback': () => {
                    setError('Recaptcha expired. Please try again.');
                }
            });
        }
    };

    const requestOtp = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        setupRecaptcha();
        const appVerifier = window.recaptchaVerifier;
        try {
            // Ensure phone number has country code if not present, e.g. +91
            const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
            const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
            setConfirmResult(confirmation);
            setLoading(false);
        } catch (err: any) {
            setLoading(false);
            setError(err.message);
            // Reset recaptcha
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.clear();
                // @ts-ignore
                window.recaptchaVerifier = null;
            }
        }
    };

    const verifyOtp = async (e: FormEvent) => {
        e.preventDefault();
        if (!confirmResult) return;
        setLoading(true);
        try {
            await confirmResult.confirm(otp);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const inputStyle = { padding: '10px', borderRadius: '6px', border: '1px solid #ccc' };
    const btnStyle = { padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
            <h3>Login</h3>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <button
                    onClick={() => setMethod('email')}
                    style={{ ...btnStyle, flex: 1, background: method === 'email' ? '#646cff' : '#eee', color: method === 'email' ? 'white' : 'black' }}
                >
                    Email
                </button>
                <button
                    onClick={() => setMethod('phone')}
                    style={{ ...btnStyle, flex: 1, background: method === 'phone' ? '#646cff' : '#eee', color: method === 'phone' ? 'white' : 'black' }}
                >
                    Phone
                </button>
            </div>

            {method === 'email' ? (
                <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
                    <button type="submit" style={{ ...btnStyle, background: '#1a1a1a', color: 'white' }}>Login with Email</button>
                </form>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {!confirmResult ? (
                        <form onSubmit={requestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input
                                placeholder="Phone (e.g. 9876543210)"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                                style={inputStyle}
                            />
                            <div id="recaptcha-container"></div>
                            <button type="submit" disabled={loading} style={{ ...btnStyle, background: '#1a1a1a', color: 'white' }}>
                                {loading ? 'Sending OTP...' : 'Send OTP'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={verifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input
                                placeholder="Enter OTP"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                required
                                style={inputStyle}
                            />
                            <button type="submit" disabled={loading} style={{ ...btnStyle, background: '#1a1a1a', color: 'white' }}>
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </button>
                            <button type="button" onClick={() => setConfirmResult(null)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}>
                                Change Number
                            </button>
                        </form>
                    )}
                </div>
            )}

            <button type="button" onClick={handleGoogleLogin} style={{ ...btnStyle, background: '#4285F4', color: 'white', marginTop: '10px' }}>
                Sign in with Google
            </button>

            {error && <div style={{ color: 'red', fontSize: '0.9rem' }}>{error}</div>}
        </div>
    );
};

export default Login;
