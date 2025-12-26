import React, { useEffect } from 'react';
import { useAuthStore, useThemeStore } from '../store';
import Sidebar from '../components/layout/Sidebar';
import BottomNav from '../components/layout/BottomNav';
import Navbar from '../components/layout/Navbar';

const RootLayout = ({ children }) => {
    const { theme } = useThemeStore();

    useEffect(() => {
        // Set theme attribute on html element
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    return (
        <div className="min-h-screen bg-[var(--bg-app)] flex flex-col md:flex-row">
            {/* Desktop Sidebar */}
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Navbar */}
                <Navbar />

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        {children}
                    </div>
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <BottomNav />
        </div>
    );
};

export default RootLayout;
