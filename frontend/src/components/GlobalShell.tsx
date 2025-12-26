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
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUnreadCount(snapshot.size);
        });
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
                    <div
                        onClick={() => setView('profile')}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#007bff',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                        title="Profile"
                    >
                        P
                    </div>
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
                </aside>

                {/* Main Content */}
                <main style={{ flex: 1, padding: '20px' }}>
                    {children}
                </main>
            </div>

            {/* Bottom Nav (Mobile - mocked structure, visible always in this skeleton) */}
            <nav style={{
                display: 'flex',
                justifyContent: 'space-around',
                borderTop: '1px solid currentColor',
                padding: '10px',
                // In real responsive CSS, this would be display: none on desktop
            }}>
                <span>Mobile Nav Placeholder</span>
            </nav>
        </div>
    );
};

export default GlobalShell;
