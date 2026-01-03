import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import AuthShell from './components/AuthShell';
import Discover from './components/Discover';

import Notifications from './components/Notifications';
import Clubs from './components/Clubs';
import Feed from './components/Feed';
import Profile from './components/Profile';
import GlobalShell from './components/GlobalShell';
import ProfileSetup from './components/ProfileSetup';
import { db } from './firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import InteractiveGrid from './components/InteractiveGrid';
import './App.css';

const AppContent = () => {
  const { user, loading: authLoading } = useAuth();
  const [currentView, setView] = useState('discover');
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (d) => {
        // Check if doc exists and has the flag. 
        // Note: verifyToken backend middleware might create a Doc without isProfileComplete.
        if (d.exists() && d.data().isProfileComplete) {
          setProfileComplete(true);
        } else {
          setProfileComplete(false);
        }
      });
      return () => unsub();
    } else {
      setProfileComplete(null);
    }
  }, [user]);



  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(true);
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.body.style.backgroundColor = !isDarkMode ? '#000' : '#f8f9fa';
  };

  if (authLoading) return <div style={{ background: '#0f172a', color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  if (!user) {
    return (
      <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <InteractiveGrid isDarkMode={isDarkMode} />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1
        }}>
          <AuthShell isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
        </div>
      </div>
    );
  }

  if (profileComplete === false) {
    return <ProfileSetup user={user} onComplete={() => { }} />;
  }

  // Optional: show loading while checking profile
  if (profileComplete === null) return <div>Loading Profile...</div>;

  return (
    <GlobalShell setView={setView} currentView={currentView} isDarkMode={isDarkMode} toggleTheme={toggleTheme}>
      {currentView === 'discover' && <Discover />}
      {currentView === 'clubs' && <Clubs isDarkMode={isDarkMode} />}
      {currentView === 'feed' && <Feed isDarkMode={isDarkMode} />}
      {currentView === 'notifications' && <Notifications isDarkMode={isDarkMode} />}
      {currentView === 'profile' && <Profile setView={setView} isDarkMode={isDarkMode} />}
    </GlobalShell>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
