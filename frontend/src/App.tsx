import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './components/Login';
import SignUp from './components/SignUp';
import Discover from './components/Discover';

import Notifications from './components/Notifications';
import Clubs from './components/Clubs';
import Feed from './components/Feed';
import Profile from './components/Profile';
import GlobalShell from './components/GlobalShell';
import './App.css';

const AppContent = () => {
  const { user, loading } = useAuth();
  const [currentView, setView] = useState('discover');

  if (loading) return <div>Loading...</div>;

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
