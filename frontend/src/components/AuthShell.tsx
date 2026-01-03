import React, { useState } from 'react';
import Login from './Login';
import SignUp from './SignUp';

const AuthShell: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);

    const toggle = () => setIsSignUp(!isSignUp);

    const containerStyle: React.CSSProperties = {
        background: 'rgba(5, 5, 12, 0.98)',
        border: '1px solid rgba(139, 92, 246, 0.4)',
        boxShadow: '0 0 100px rgba(0, 0, 0, 0.9)',
        borderRadius: '35px',
        position: 'relative',
        width: '1100px', // Extra large width for massive grid impact
        maxWidth: '96vw',
        height: '750px', // Taller to accommodate expanded forms
        overflow: 'hidden',
        backdropFilter: 'blur(50px)',
        display: 'flex',
        color: 'white',
        zIndex: 10,
        boxSizing: 'border-box'
    };

    const overlayStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: isSignUp ? '50%' : '0%',
        width: '50%',
        height: '100%',
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        transition: 'all 0.65s cubic-bezier(0.7, 0, 0.3, 1)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 60px',
        textAlign: 'center',
        color: 'white',
        boxSizing: 'border-box'
    };

    const formWrapperStyle = (isActive: boolean): React.CSSProperties => ({
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '50px',
        transition: 'all 0.65s cubic-bezier(0.7, 0, 0.3, 1)',
        opacity: isActive ? 1 : 0.4, // Slight peek for depth
        visibility: isActive ? 'visible' : 'hidden',
        pointerEvents: isActive ? 'auto' : 'none',
        transform: isActive ? 'scale(1)' : 'scale(0.92)',
        boxSizing: 'border-box'
    });

    return (
        <div style={containerStyle}>
            {/* Sliding Overlay Panel */}
            <div style={overlayStyle}>
                <div style={{ width: '100%', maxWidth: '380px' }}>
                    <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '20px', letterSpacing: '-1.5px', lineHeight: '1.1' }}>
                        {isSignUp ? "WELCOME BACK ->" : "<- SIGN IN"}
                    </h1>
                    <p style={{ marginBottom: '40px', fontSize: '1.2rem', opacity: 0.8, fontWeight: '500', lineHeight: '1.5' }}>
                        {isSignUp
                            ? "To keep connected with us please login with your personal info."
                            : "Enter your personal details and start your journey with us."}
                    </p>
                    <button
                        onClick={toggle}
                        style={{
                            padding: '20px 70px',
                            borderRadius: '50px',
                            border: '3px solid white',
                            background: 'transparent',
                            color: 'white',
                            fontWeight: '900',
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                            letterSpacing: '1.5px',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            textTransform: 'uppercase'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.scale = '1.05';
                            e.currentTarget.style.background = 'white';
                            e.currentTarget.style.color = '#7c3aed';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.scale = '1';
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'white';
                        }}
                    >
                        {isSignUp ? "Sign In" : "Register"}
                    </button>
                </div>
            </div>

            {/* Form Layers */}
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                {/* Left Half: SignUp Section */}
                <div style={formWrapperStyle(isSignUp)}>
                    <div style={{ width: '100%', maxWidth: '440px' }}>
                        <SignUp onToggle={() => { }} hideFooter isNested />
                    </div>
                </div>

                {/* Right Half: Login Section */}
                <div style={formWrapperStyle(!isSignUp)}>
                    <div style={{ width: '100%', maxWidth: '400px' }}>
                        <Login onToggle={() => { }} hideFooter isNested />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthShell;
