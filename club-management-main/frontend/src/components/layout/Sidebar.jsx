import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Grid, Radio, User } from 'lucide-react';

export const NAV_ITEMS = [
    { path: '/', label: 'Discover', icon: Compass },
    { path: '/clubs', label: 'Clubs', icon: Grid },
    { path: '/feed', label: 'Feed', icon: Radio },
    { path: '/profile', label: 'Profile', icon: User },
];

const Sidebar = () => {
    return (
        <aside className="hidden md:flex flex-col w-64 glass border-r border-white/5 h-screen sticky top-0">
            <div className="p-8">
                <h2 className="text-2xl font-black italic text-primary">NEXUS</h2>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-2">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
              flex items-center gap-4 px-4 py-3 rounded-xl transition-all
              ${isActive
                                ? 'bg-primary/10 text-primary font-bold shadow-[0_0_20px_rgba(37,99,235,0.1)]'
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'}
            `}
                    >
                        <item.icon size={22} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-white/5">
                <p className="text-[10px] text-[var(--text-secondary)] text-center opacity-50">
                    © 2025 MIT CLUB HUB
                </p>
            </div>
        </aside>
    );
};

export default Sidebar;
