import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './components/Login';
import SignUp from './components/SignUp';
import Discover from './components/Discover';

import Notifications from './components/Notifications';
import Clubs from './components/Clubs';
import Feed from './components/Feed';
import Profile from './components/Profile';
import GlobalShell from './components/GlobalShell';
import ProfileSetup from './components/ProfileSetup';
import { db } from './firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
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

  if (authLoading) return <div>Loading...</div>;

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '50px' }}>
        <h1>Welcome to NEXUS</h1>
        <div style={{ display: 'flex', gap: '50px' }}>
          <Login />
          <div style={{ borderLeft: '1px solid black' }}></div>
          <SignUp />
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
    <GlobalShell setView={setView} currentView={currentView}>
      {currentView === 'discover' && <Discover />}
      {currentView === 'clubs' && <Clubs />}
      {currentView === 'feed' && <Feed />}
      {currentView === 'notifications' && <Notifications />}
      {currentView === 'profile' && <Profile />}
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
