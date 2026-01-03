import { type FC, type ReactNode, useState } from 'react';
import InteractiveGrid from './InteractiveGrid';

interface GlobalShellProps {
    children: ReactNode;
    setView: (view: any) => void;
    currentView: string;
}

const GlobalShell: FC<GlobalShellProps> = ({ children, setView, currentView }) => {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark'); // Default to dark for "premium" feel

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const isDarkMode = theme === 'dark';

    // Nav Items Config
    const navItems = [
        { id: 'discover', label: 'Discover', icon: '🌍' },
        { id: 'clubs', label: 'Clubs', icon: '🛡️' },
        { id: 'feed', label: 'Feed', icon: '📰' },
    ];

    return (
        <div style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden', // Prevent scroll on body, handle in children
            color: isDarkMode ? 'white' : 'black'
        }}>
            {/* Background Animation - Always present filling remaining space */}
            <InteractiveGrid isDarkMode={isDarkMode} />

            {/* Header */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '15px 30px',
                zIndex: 10,
                background: 'transparent', // Let grid show through
                backdropFilter: 'blur(5px)' // Subtle blur for text readbility
            }}>
                <div style={{ fontWeight: '900', fontSize: '1.5rem', letterSpacing: '2px' }}>NEXUS</div>

                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <button
                        onClick={() => setView('notifications')}
                        style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'inherit' }}
                    >
                        🔔
                    </button>
                    <button
                        onClick={toggleTheme}
                        style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'inherit' }}
                    >
                        {isDarkMode ? '☀️' : '🌙'}
                    </button>
                    <div
                        onClick={() => setView('profile')}
                        style={{
                            width: '35px',
                            height: '35px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #bcec15 0%, #28a745 100%)', // Volt gradient
                            color: 'black',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            boxShadow: '0 0 10px rgba(188, 236, 21, 0.4)'
                        }}
                        title="Profile"
                    >
                        P
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center', // "Event tabs should come centre"
                paddingBottom: '80px', // Space for bottom nav
                zIndex: 5,
                position: 'relative'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: '1200px', // Constrain width for "centered" feel
                    height: '100%',
                    position: 'relative'
                }}>
                    {children}
                </div>
            </main>

            {/* Bottom Navigation Tabs - Centered & Floating */}
            <nav style={{
                position: 'fixed',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 20,
                background: isDarkMode ? 'rgba(20, 20, 20, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(15px)',
                borderRadius: '50px',
                padding: '10px 30px',
                display: 'flex',
                gap: '40px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)'
            }}>
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: currentView === item.id ? '#bcec15' : 'inherit',
                            fontWeight: currentView === item.id ? 'bold' : 'normal',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'color 0.3s'
                        }}
                    >
                        <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                        <span style={{ fontSize: '0.8rem' }}>{item.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default GlobalShell;
