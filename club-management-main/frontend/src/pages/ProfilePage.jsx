import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    User,
    Settings,
    LogOut,
    Building2,
    Calendar,
    CheckCircle2,
    Camera,
    ChevronRight,
    ShieldCheck,
    Mail,
    Phone,
    GraduationCap,
    Clock
} from 'lucide-react';
import { useAuthStore, useThemeStore } from '../store';
import { logout } from '../services/authService';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';

const ProfilePage = () => {
    const { user } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const navigate = useNavigate();
    const [registrations, setRegistrations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        // Fetch real registrations for this user
        // We look in eventRegistrations for docs where the user is a member
        const q = query(collection(db, 'teams'), where('members', 'array-contains', user.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const teamData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRegistrations(teamData);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleLogout = async () => {
        try {
            await logout();
            toast.success('Logged out successfully');
            navigate('/login');
        } catch (err) {
            toast.error('Failed to logout');
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
            {/* Hero Profile Section */}
            <section className="glass rounded-[40px] border-white/5 overflow-hidden">
                <div className="h-40 bg-gradient-to-r from-primary/20 via-blue-900/40 to-secondary/20 relative">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                </div>
                <div className="px-8 pb-10">
                    <div className="relative -mt-20 mb-6 group inline-block">
                        <img
                            src={user.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
                            className="w-40 h-40 rounded-[32px] border-8 border-[#000] bg-[#111] object-cover shadow-2xl"
                        />
                        <button className="absolute bottom-2 right-2 w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all">
                            <Camera size={18} />
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-1">
                            <h2 className="text-4xl font-black italic tracking-tight text-white uppercase">{user.name}</h2>
                            <div className="flex items-center gap-3">
                                <p className="text-primary font-bold tracking-widest uppercase text-xs">@{user.username}</p>
                                <span className="text-white/10">•</span>
                                <p className="text-gray-500 font-bold tracking-widest uppercase text-xs">{user.department}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button className="glass px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/5 transition-all">
                                <Settings size={16} /> Edit Profile
                            </button>
                            <button
                                onClick={handleLogout}
                                className="bg-red-500/10 text-red-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-500 hover:text-white transition-all"
                            >
                                <LogOut size={16} /> Logout
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Stats Column */}
                <div className="md:col-span-1 space-y-6">
                    <section className="glass rounded-[32px] p-6 border-white/5 space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Academic Status</h3>
                        <div className="space-y-4">
                            <StatItem icon={<GraduationCap size={18} />} label="Reg No" value={user.registerNumber} />
                            <StatItem icon={<Calendar size={18} />} label="Year" value={user.year} />
                            <StatItem icon={<ShieldCheck size={18} />} label="Global Role" value={user.role} isBadge />
                        </div>
                    </section>

                    <section className="glass rounded-[32px] p-6 border-white/5 space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Contact Info</h3>
                        <div className="space-y-4 overflow-hidden">
                            <StatItem icon={<Mail size={16} />} label="Education" value={user.collegeEmail} isEmail />
                            <StatItem icon={<Phone size={16} />} label="Phone" value={user.phoneNumber} />
                        </div>
                    </section>
                </div>

                {/* Right Content Column */}
                <div className="md:col-span-2 space-y-8">
                    {/* Member of Section */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 px-2">Affiliated Clubs</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {user.joinedClubs?.length > 0 ? (
                                user.joinedClubs.map(clubId => (
                                    <ClubAffiliation key={clubId} clubId={clubId} role={user.roles?.[clubId] || 'Member'} />
                                ))
                            ) : (
                                <div className="col-span-full glass rounded-[32px] p-10 border-white/5 text-center flex flex-col items-center gap-3">
                                    <Building2 size={32} className="text-gray-700" />
                                    <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">No active club memberships</p>
                                    <button onClick={() => navigate('/clubs')} className="text-primary text-[10px] font-black border-b border-primary pb-px hover:tracking-widest transition-all">DISCOVER CLUBS</button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Event Participations Section */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 px-2">Registered Events</h3>
                        <div className="space-y-3">
                            {registrations.length > 0 ? (
                                registrations.map(reg => (
                                    <EventRecord
                                        key={reg.id}
                                        title={reg.eventTitle}
                                        teamName={reg.teamName}
                                        status={reg.status}
                                    />
                                ))
                            ) : (
                                <div className="glass rounded-[32px] p-10 border-white/5 text-center flex flex-col items-center gap-3">
                                    {isLoading ? (
                                        <Loader2 className="animate-spin text-primary" />
                                    ) : (
                                        <>
                                            <Calendar size={32} className="text-gray-700" />
                                            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">No registrations yet</p>
                                            <button onClick={() => navigate('/')} className="text-primary text-[10px] font-black border-b border-primary pb-px hover:tracking-widest transition-all">EXPLORE EVENTS</button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

const StatItem = ({ icon, label, value, isBadge, isEmail }) => (
    <div className="flex items-center gap-4 group">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-primary transition-colors border border-white/5">
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest">{label}</p>
            {isBadge ? (
                <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-md inline-block mt-1">
                    {value}
                </span>
            ) : (
                <p className={`text-sm font-bold text-white truncate ${isEmail && 'text-xs'}`}>{value || '---'}</p>
            )}
        </div>
    </div>
);

const ClubAffiliation = ({ clubId, role }) => (
    <div className="glass hover:bg-white/10 p-5 rounded-[24px] border-white/5 flex items-center gap-4 transition-all group cursor-pointer">
        <div className="w-12 h-12 rounded-xl bg-[#111] flex items-center justify-center text-gray-700 font-black italic text-xl border border-white/5 group-hover:border-primary/20 transition-all">
            {clubId.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black italic text-white uppercase truncate">{clubId.length > 10 ? `Club #${clubId.substring(0, 4)}` : clubId}</h4>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{role}</p>
        </div>
        <ChevronRight size={16} className="text-gray-700 group-hover:text-white transition-all transform group-hover:translate-x-1" />
    </div>
);

const EventRecord = ({ title, teamName, status }) => (
    <div className="glass hover:bg-white/10 p-5 rounded-[24px] border-white/5 flex items-center justify-between transition-all group">
        <div className="flex items-center gap-4 overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <CheckCircle2 size={24} />
            </div>
            <div className="min-w-0">
                <h4 className="text-sm font-black italic text-white uppercase truncate">{title}</h4>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate">Team: {teamName}</p>
            </div>
        </div>
        <div className="text-right shrink-0">
            <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${status === 'registered' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'
                }`}>
                {status}
            </span>
        </div>
    </div>
);

const Loader2 = ({ className }) => (
    <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className={className}
    >
        <Clock size={32} />
    </motion.div>
);

export default ProfilePage;
