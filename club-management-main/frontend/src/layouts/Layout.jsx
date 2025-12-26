import React from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';

const Layout = ({ children, activeTab, onTabChange }) => {
    return (
        <div className="min-h-screen text-white">
            {/* Header */}
            <Header />

            {/* Sidebar - Desktop only */}
            <Sidebar activeTab={activeTab} onTabChange={onTabChange} />

            {/* Main Content Area */}
            <main className="pt-14 pb-20 md:pb-6 md:pl-56">
                <div className="p-4 md:p-6 lg:p-8">
                    {children}
                </div>
            </main>

            {/* Bottom Nav - Mobile only */}
            <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
        </div>
    );
};

export default Layout;
