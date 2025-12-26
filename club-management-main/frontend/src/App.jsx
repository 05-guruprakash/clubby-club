import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import RootLayout from './layouts/RootLayout';
import LoadingScreen from './components/ui/LoadingScreen';
import { useAuthStore, useThemeStore } from './store';
import { auth, db } from './config/firebase';

// Lazy load pages
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const ClubsPage = lazy(() => import('./pages/ClubsPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ClubDetailsPage = lazy(() => import('./pages/PlaceholderPages').then(m => ({ default: m.ClubDetailsPage })));
const EventDetailsPage = lazy(() => import('./pages/PlaceholderPages').then(m => ({ default: m.EventDetailsPage })));
const AdminDashboard = lazy(() => import('./pages/PlaceholderPages').then(m => ({ default: m.AdminDashboard })));

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuthStore();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  return children;
};

// Public Route (prevent logged in users from seeing login/register)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuthStore();

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/" replace />;

  return children;
};

function App() {
  const { setUser, setLoading } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    // Set theme attribute on html element globally
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Subscribe to real-time user data
        const unsubscribeUser = onSnapshot(doc(db, 'users', firebaseUser.uid), (doc) => {
          if (doc.exists()) {
            setUser({ uid: firebaseUser.uid, ...doc.data() });
          } else {
            setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
          }
          setLoading(false);
        }, (error) => {
          console.error("User sync error:", error);
          setLoading(false);
        });
        return () => unsubscribeUser();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [setUser, setLoading]);

  return (
    <Router>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#111',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

          {/* App Routes */}
          <Route path="/" element={<ProtectedRoute><RootLayout><DiscoverPage /></RootLayout></ProtectedRoute>} />
          <Route path="/clubs" element={<ProtectedRoute><RootLayout><ClubsPage /></RootLayout></ProtectedRoute>} />
          <Route path="/clubs/:id" element={<ProtectedRoute><RootLayout><ClubDetailsPage /></RootLayout></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><RootLayout><FeedPage /></RootLayout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><RootLayout><ProfilePage /></RootLayout></ProtectedRoute>} />
          <Route path="/events/:id" element={<ProtectedRoute><RootLayout><EventDetailsPage /></RootLayout></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute><RootLayout><AdminDashboard /></RootLayout></ProtectedRoute>} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
