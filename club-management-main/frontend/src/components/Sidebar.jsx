import React from 'react';

const navItems = [
    {
        id: 'discover',
        label: 'Discover',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        ),
    },
    {
        id: 'clubs',
        label: 'Clubs',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        ),
    },
    {
        id: 'feed',
        label: 'Feed',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
        ),
    },
    {
        id: 'profile',
        label: 'Profile',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    },
];

const Sidebar = ({ activeTab = 'discover', onTabChange }) => {
    return (
        <aside className="hidden md:flex fixed left-0 top-14 bottom-0 w-56 z-40 glass border-r border-white/10 flex-col">
            <nav className="flex-1 py-6 px-3">
                <ul className="space-y-1">
                    {navItems.map((item) => (
                        <li key={item.id}>
                            <button
                                onClick={() => onTabChange?.(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === item.id
                                        ? 'bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/10'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                            >
                                {item.icon}
                                <span className="font-medium">{item.label}</span>
                                {activeTab === item.id && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Footer section */}
            <div className="p-4 border-t border-white/10">
                <div className="glass rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-2">NEXUS v1.0</p>
                    <p className="text-xs text-gray-500">Campus Life Platform</p>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
