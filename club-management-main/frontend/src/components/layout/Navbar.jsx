import React from 'react';
import { useAuthStore, useThemeStore, useNotificationStore } from '../../store';
import { Bell, Sun, Moon, LogOut, User as UserIcon } from 'lucide-react';
import { logout } from '../../services/authService';

const Navbar = () => {
    const { user } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const { unreadCount } = useNotificationStore();

    return (
        <header className="sticky top-0 z-40 w-full glass border-b border-white/5 h-16 flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
                {/* Placeholder for college logo */}
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-white italic">
                    M
                </div>
                <h1 className="text-xl font-bold tracking-tight hidden sm:block">
                    MIT <span className="text-primary italic">Club Hub</span>
                </h1>
            </div>

            <div className="flex items-center gap-4">
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full hover:bg-white/5 transition-colors text-[var(--text-secondary)]"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                {/* Notifications */}
                <button className="relative p-2 rounded-full hover:bg-white/5 transition-colors text-[var(--text-secondary)]">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                            {unreadCount}
                        </span>
                    )}
                </button>

                {/* User Profile / Auth */}
                {user ? (
                    <div className="flex items-center gap-3 ml-2 pl-4 border-l border-white/10">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{user.role}</p>
                        </div>
                        <img
                            src={user.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
                            alt={user.name}
                            className="w-10 h-10 rounded-full border border-white/10"
                        />
                    </div>
                ) : (
                    <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
                        Login
                    </button>
                )}
            </div>
        </header>
    );
};

export default Navbar;
