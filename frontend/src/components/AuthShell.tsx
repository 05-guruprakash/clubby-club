import React, { useState } from 'react';
import Login from './Login';
import SignUp from './SignUp';

interface AuthShellProps {
    isDarkMode: boolean;
    toggleTheme: () => void;
}

const AuthShell: React.FC<AuthShellProps> = ({ isDarkMode, toggleTheme }) => {
    const [isSignUp, setIsSignUp] = useState(false);

    const toggle = () => setIsSignUp(!isSignUp);

    const containerStyle: React.CSSProperties = {
        background: isDarkMode ? 'rgba(5, 5, 12, 0.98)' : 'rgba(255, 255, 255, 0.95)',
        border: `1px solid ${isDarkMode ? 'rgba(188, 236, 21, 0.3)' : 'rgba(0,0,0,0.1)'}`,
        boxShadow: isDarkMode ? '0 0 100px rgba(0, 0, 0, 0.9)' : '0 20px 50px rgba(0,0,0,0.1)',
        borderRadius: '35px',
        position: 'relative',
        width: '1100px',
        maxWidth: '96vw',
        height: '750px',
        overflow: 'hidden',
        backdropFilter: 'blur(50px)',
        display: 'flex',
        color: isDarkMode ? 'white' : '#1a1a1a',
        zIndex: 10,
        boxSizing: 'border-box',
        transition: 'all 0.5s ease'
    };

    const overlayStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: isSignUp ? '50%' : '0%',
        width: '50%',
        height: '100%',
        background: '#bcec15', // VOLT COLOR
        transition: 'all 0.65s cubic-bezier(0.7, 0, 0.3, 1)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 60px',
        textAlign: 'center',
        color: 'black',
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
        opacity: isActive ? 1 : 0.4,
        visibility: isActive ? 'visible' : 'hidden',
        pointerEvents: isActive ? 'auto' : 'none',
        transform: isActive ? 'scale(1)' : 'scale(0.92)',
        boxSizing: 'border-box'
    });

    const themeToggleStyle: React.CSSProperties = {
        position: 'absolute',
        top: '30px',
        right: '30px',
        zIndex: 300,
        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
        border: 'none',
        padding: '12px',
        borderRadius: '50%',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isDarkMode ? '#bcec15' : '#000',
        transition: 'all 0.3s'
    };

    return (
        <div style={containerStyle}>
            {/* Theme Toggle */}
            <button style={themeToggleStyle} onClick={toggleTheme} title="Toggle Theme">
                {isDarkMode ? (
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                ) : (
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                )}
            </button>

            {/* Sliding Overlay Panel */}
            <div style={overlayStyle}>
                <div style={{ width: '100%', maxWidth: '380px' }}>
                    <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '20px', letterSpacing: '-1.5px', lineHeight: '1.1' }}>
                        {isSignUp ? "WELCOME BACK ->" : "<- SIGN IN"}
                    </h1>
                    <p style={{ marginBottom: '40px', fontSize: '1.2rem', opacity: 0.8, fontWeight: '600', lineHeight: '1.5' }}>
                        {isSignUp
                            ? "To keep connected with us please login with your personal info."
                            : "Enter your personal details and start your journey with us."}
                    </p>
                    <button
                        onClick={toggle}
                        style={{
                            padding: '20px 70px',
                            borderRadius: '50px',
                            border: '3px solid black',
                            background: 'transparent',
                            color: 'black',
                            fontWeight: '900',
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                            letterSpacing: '1.5px',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            textTransform: 'uppercase'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.scale = '1.05';
                            e.currentTarget.style.background = 'black';
                            e.currentTarget.style.color = '#bcec15';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.scale = '1';
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'black';
                        }}
                    >
                        {isSignUp ? "Sign In" : "Register"}
                    </button>
                </div>
            </div>

            {/* Form Layers */}
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                <div style={formWrapperStyle(isSignUp)}>
                    <div style={{ width: '100%', maxWidth: '440px' }}>
                        <SignUp onToggle={() => { }} hideFooter isNested themeColor="#bcec15" isDarkMode={isDarkMode} />
                    </div>
                </div>

                <div style={formWrapperStyle(!isSignUp)}>
                    <div style={{ width: '100%', maxWidth: '400px' }}>
                        <Login onToggle={() => { }} hideFooter isNested themeColor="#bcec15" isDarkMode={isDarkMode} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthShell;
