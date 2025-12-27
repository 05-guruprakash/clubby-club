import { type FC, type ReactNode, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface GlobalShellProps {
    children: ReactNode;
    setView: (view: any) => void;
    currentView: string;
}

const GlobalShell: FC<GlobalShellProps> = ({ children, setView, currentView }) => {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const q = query(collection(db, 'notifications'), where('read', '==', false));
        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                setUnreadCount(snapshot.size);
            },
            (error) => {
                console.warn("Notifications listener blocked by permissions:", error.message);
                setUnreadCount(0);
            }
        );
        return () => unsubscribe();
    }, []);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
        // In a real app, this would apply class to body
        document.body.style.backgroundColor = theme === 'light' ? '#333' : '#fff';
        document.body.style.color = theme === 'light' ? '#fff' : '#000';
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
            {/* Header */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 20px',
                borderBottom: '1px solid currentColor'
            }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>NEXUS</div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <button onClick={() => setView('notifications')}>
                        Notifications {unreadCount > 0 && `(${unreadCount})`} {currentView === 'notifications' && '(Active)'}
                    </button>
                    <button onClick={toggleTheme}>
                        Theme: {theme.toUpperCase()}
                    </button>
                </div>
            </header>

            <div style={{ display: 'flex', flex: 1 }}>
                {/* Desktop Sidebar (Mocking responsive behavior with simple div) */}
                <aside style={{
                    width: '200px',
                    padding: '20px',
                    borderRight: '1px solid currentColor',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    <button onClick={() => setView('discover')} style={{ fontWeight: currentView === 'discover' ? 'bold' : 'normal' }}>Discover</button>
                    <button onClick={() => setView('clubs')} style={{ fontWeight: currentView === 'clubs' ? 'bold' : 'normal' }}>Clubs</button>
                    <button onClick={() => setView('feed')} style={{ fontWeight: currentView === 'feed' ? 'bold' : 'normal' }}>Feed</button>
                    <button onClick={() => setView('profile')} style={{ fontWeight: currentView === 'profile' ? 'bold' : 'normal' }}>Profile</button>
                </aside>

                {/* Main Content */}
                <main style={{ flex: 1, padding: '20px' }}>
                    {children}
                </main>
            </div>

            {/* Bottom Nav (Mobile - mocked structure, visible always in this skeleton) */}
            {/* Bottom Navigation Bar */}
            <nav style={{
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                backgroundColor: '#000',
                padding: '10px 0',
                position: 'fixed',
                bottom: 0,
                width: '100%',
                borderTop: '1px solid #333',
                zIndex: 1000
            }}>
                <button
                    onClick={() => setView('discover')}
                    style={{ background: 'none', border: 'none', color: currentView === 'discover' ? '#007bff' : '#666', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', gap: '4px' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    <span>Discover</span>
                </button>

                <button
                    onClick={() => setView('clubs')}
                    style={{ background: 'none', border: 'none', color: currentView === 'clubs' ? '#007bff' : '#666', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', gap: '4px' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    <span>Clubs</span>
                </button>

                <button
                    onClick={() => setView('feed')}
                    style={{ background: 'none', border: 'none', color: currentView === 'feed' ? '#007bff' : '#666', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', gap: '4px' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg>
                    <span>Feed</span>
                </button>

                <button
                    onClick={() => setView('profile')}
                    style={{ background: 'none', border: 'none', color: currentView === 'profile' ? '#007bff' : '#666', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.7rem', gap: '4px' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span>Profile</span>
                </button>
            </nav>
        </div>
    );
};

export default GlobalShell;
