import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './Sidebar';

const BottomNav = () => {
    return (
        <nav className="fixed bottom-0 left-0 right-0 md:hidden z-50 glass-heavy border-t border-white/5 h-20 px-4">
            <div className="flex items-center justify-around h-full max-w-lg mx-auto">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
              flex flex-col items-center gap-1 transition-all duration-300
              ${isActive ? 'text-primary scale-110' : 'text-[var(--text-secondary)] opacity-100'}
            `}
                    >
                        <div className={`
              p-2 rounded-xl transition-all
              ${({ isActive }) => isActive ? 'bg-primary/10 shadow-[0_0_15px_rgba(37,99,235,0.2)]' : ''}
            `}>
                            <item.icon size={22} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tight">
                            {item.label}
                        </span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export default BottomNav;
