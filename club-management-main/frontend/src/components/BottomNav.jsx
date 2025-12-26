import React from 'react';
import { Compass, Users, Radio, Settings } from 'lucide-react';

const navItems = [
    { id: 'discover', label: 'Discover', icon: <Compass size={24} /> },
    { id: 'clubs', label: 'Clubs', icon: <Users size={24} /> },
    { id: 'feed', label: 'Feed', icon: <Radio size={24} /> },
    { id: 'admin', label: 'Admin', icon: <Settings size={24} /> },
];

const BottomNav = ({ activeTab = 'discover', onTabChange }) => {
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#020617] border-t border-white/5 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-around h-24 max-w-lg mx-auto px-4">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange?.(item.id)}
                        className={`flex flex-col items-center justify-center gap-2 transition-all duration-300 ${activeTab === item.id
                                ? 'text-white'
                                : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <div className={`p-1.5 rounded-xl transition-all ${activeTab === item.id ? 'bg-white/5 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : ''}`}>
                            {item.icon}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-tighter ${activeTab === item.id ? 'opacity-100' : 'opacity-60'}`}>
                            {item.label}
                        </span>
                    </button>
                ))}
            </div>
        </nav>
    );
};

export default BottomNav;
