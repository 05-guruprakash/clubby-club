import { type FC, type ReactNode } from 'react';
import InteractiveGrid from './InteractiveGrid';

interface GlobalShellProps {
    children: ReactNode;
    setView: (view: any) => void;
    currentView: string;
    isDarkMode: boolean;
    toggleTheme: () => void;
}

const GlobalShell: FC<GlobalShellProps> = ({ children, setView, currentView, isDarkMode, toggleTheme }) => {

    // Nav Items Config
    const navItems = [
        {
            id: 'discover',
            label: 'Discover',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
            )
        },
        {
            id: 'clubs',
            label: 'Clubs',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
            )
        },
        {
            id: 'feed',
            label: 'Feed',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <line x1="12" y1="11" x2="16" y2="11" />
                    <line x1="12" y1="15" x2="16" y2="15" />
                    <line x1="8" y1="11" x2="8" y2="11" />
                    <line x1="8" y1="15" x2="8" y2="15" />
                </svg>
            )
        },
        {
            id: 'profile',
            label: 'Profile',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
            )
        },
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
                padding: '20px 40px',
                zIndex: 10,
                background: 'transparent',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ fontWeight: '900', fontSize: '1.8rem', letterSpacing: '4px', color: '#bcec15' }}>ClubOps</div>

                <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
                    <button
                        onClick={() => setView('notifications')}
                        style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'inherit', display: 'flex' }}
                        title="Notifications"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                    </button>
                    <button
                        onClick={toggleTheme}
                        style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'inherit', display: 'flex' }}
                        title="Toggle Theme"
                    >
                        {isDarkMode ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        )}
                    </button>
                    <div
                        onClick={() => setView('profile')}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: '#bcec15',
                            color: 'black',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            boxShadow: '0 0 20px rgba(188, 236, 21, 0.4)',
                            transition: 'all 0.3s ease'
                        }}
                        title="Profile"
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center', // "Event tabs should come centre"
                paddingBottom: '100px', // More Space for bottom nav
                zIndex: 5,
                position: 'relative'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: '1400px', // Wider content
                    height: '100%',
                    position: 'relative'
                }}>
                    {children}
                </div>
            </main>

            {/* Bottom Navigation Tabs - Centered & Floating */}
            <nav style={{
                position: 'fixed',
                bottom: '30px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 20,
                background: isDarkMode ? 'rgba(10, 10, 10, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '12px 40px',
                display: 'flex',
                gap: '50px',
                boxShadow: isDarkMode ? '0 20px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.1)',
                border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)'
            }}>
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: currentView === item.id ? '#bcec15' : (isDarkMode ? '#666' : '#999'),
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: currentView === item.id ? 'translateY(-5px) scale(1.1)' : 'translateY(0) scale(1)'
                        }}
                    >
                        <span style={{
                            fontSize: '1.4rem',
                            display: 'flex',
                            filter: currentView === item.id ? 'drop-shadow(0 0 10px rgba(188, 236, 21, 0.5))' : 'none'
                        }}>
                            {item.icon}
                        </span>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default GlobalShell;
