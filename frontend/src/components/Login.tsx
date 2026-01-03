import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebaseConfig';

interface LoginProps {
    onToggle: () => void;
    hideFooter?: boolean;
    isNested?: boolean;
}

const Login = ({ onToggle, hideFooter, isNested }: LoginProps) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const glassStyle: React.CSSProperties = {
        background: isNested ? 'transparent' : 'rgba(10, 10, 15, 0.85)',
        border: isNested ? 'none' : '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: isNested ? 'none' : '0 0 60px rgba(139, 92, 246, 0.15)',
        borderRadius: '24px',
        padding: isNested ? '0' : '50px 40px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '30px',
        color: 'white',
        backdropFilter: isNested ? 'none' : 'blur(20px)',
        zIndex: 10
    };

    const inputStyle: React.CSSProperties = {
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '18px 24px',
        color: 'white',
        fontSize: '1.1rem',
        outline: 'none',
        transition: 'all 0.3s ease',
        width: '100%',
        boxSizing: 'border-box'
    };

    const primaryButtonStyle: React.CSSProperties = {
        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        color: 'white',
        border: 'none',
        padding: '20px',
        borderRadius: '16px',
        fontSize: '1.1rem',
        fontWeight: '800',
        cursor: 'pointer',
        boxShadow: '0 10px 25px rgba(139, 92, 246, 0.4)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        width: '100%',
        textTransform: 'uppercase',
        letterSpacing: '1px'
    };

    return (
        <div style={glassStyle}>
            <div style={{ textAlign: 'center', width: '100%' }}>
                <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '24px', letterSpacing: '-2px' }}>LOGIN</h1>
            </div>

            <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
                <button type="submit" disabled={loading} style={primaryButtonStyle}>{loading ? 'Authenticating...' : 'LOG IN'}</button>
            </form>

            <div style={{ position: 'relative', textAlign: 'center' }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '1px', background: 'rgba(255, 255, 255, 0.1)', zIndex: 0 }} />
                <span style={{ position: 'relative', background: '#05050A', padding: '0 15px', color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.9rem', fontWeight: 'bold' }}>OR</span>
            </div>

            <button
                onClick={handleGoogleLogin}
                style={{ ...inputStyle, background: 'white', color: 'black', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', border: 'none' }}
            >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="24" height="24" alt="G" />
                Continue with Google
            </button>

            {error && <div style={{ color: '#ef4444', fontSize: '1rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '16px', fontWeight: '500' }}>{error}</div>}

            {!hideFooter && (
                <div style={{ textAlign: 'center' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '1.1rem' }}>No account? </span>
                    <button
                        onClick={onToggle}
                        style={{ background: 'transparent', border: 'none', color: '#8b5cf6', cursor: 'pointer', padding: 0, fontWeight: '800', fontSize: '1.1rem' }}
                    >
                        Join NEXUS
                    </button>
                </div>
            )}
        </div>
    );
};

export default Login;
