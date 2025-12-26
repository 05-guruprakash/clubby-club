import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, MapPin, Users, Trophy, BookOpen, Clock, ChevronRight, UserPlus, Users2, Camera, Loader2, Share2, QrCode, CheckCircle2, Plus } from 'lucide-react';
import { useModalStore, useAuthStore } from '../../store';
import { createTeam, subscribeToTeams, requestToJoinTeam } from '../../services/eventService';
import toast from 'react-hot-toast';

// Helper to safely render values that might be Objects (like Firestore Timestamps)
const safeRender = (val, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string' || typeof val === 'number') return val;
    if (typeof val === 'object' && val.toDate) return val.toDate().toLocaleDateString(); // Firestore Timestamp
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

const EventDetailsModal = () => {
    const { modals, closeModal } = useModalStore();
    const { user } = useAuthStore();
    const { isOpen, data: event } = modals.eventDetails;

    // Flow State: 'details' | 'select' | 'create' | 'join' | 'success'
    const [flow, setFlow] = useState('details');
    const [teams, setTeams] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdTeam, setCreatedTeam] = useState(null);

    const [teamForm, setTeamForm] = useState({
        name: '',
        description: '',
        profilePic: ''
    });

    useEffect(() => {
        if (!isOpen) {
            setFlow('details');
            setTeamForm({ name: '', description: '', profilePic: '' });
            setCreatedTeam(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (flow === 'join' && event) {
            const unsubscribe = subscribeToTeams(event.id, (data) => {
                setTeams(data.filter(t => t.status === 'forming'));
            });
            return () => unsubscribe();
        }
    }, [flow, event]);

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const maxMembers = Number(event.maxTeamSize || event.maxMembers || 4);
            const teamData = {
                eventId: event.id,
                eventTitle: safeRender(event.title, 'Untitled Event'),
                teamName: teamForm.name,
                description: teamForm.description,
                profilePic: teamForm.profilePic || `https://api.dicebear.com/7.x/initials/svg?seed=${teamForm.name}`,
                leaderId: user.uid,
                leaderName: user.name || user.email?.split('@')[0] || 'Member',
                maxMembers: maxMembers,
                isFull: maxMembers === 1
            };
            const res = await createTeam(teamData);
            setCreatedTeam({ id: res.id, ...teamData });
            setFlow('success');
            toast.success('Team created successfully!');
        } catch (error) {
            toast.error(error.message || 'Failed to create team');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleJoinRequest = async (teamId) => {
        try {
            await requestToJoinTeam(teamId, user.uid, `Hi, I'd like to join your team for ${event.title}!`);
            toast.success('Request sent to team leader!');
            closeModal('eventDetails');
        } catch (error) {
            toast.error(error.message || 'Failed to send request');
        }
    };

    if (!event) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => closeModal('eventDetails')}
                        className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100]"
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: '0%' }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-x-0 bottom-0 h-[92vh] glass-heavy rounded-t-[40px] z-[101] overflow-hidden flex flex-col border-t border-white/10"
                    >
                        {/* Header / Handle */}
                        <div className="h-14 flex items-center justify-center relative touch-pan-y shrink-0">
                            <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                            <button
                                onClick={() => closeModal('eventDetails')}
                                className="absolute right-6 top-6 w-10 h-10 rounded-full glass flex items-center justify-center text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto px-6 pb-24 md:px-10">
                            {flow === 'details' && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10 animate-fade-in">
                                    {/* Event Meta */}
                                    <div>
                                        <span className="inline-block px-3 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-4">
                                            {safeRender(event.category, 'WORKSHOP')}
                                        </span>
                                        <h2 className="text-4xl font-black italic tracking-tight text-white mb-2 leading-tight">
                                            {safeRender(event.title)}
                                        </h2>
                                        <p className="text-primary font-bold flex items-center gap-2">
                                            by {safeRender(event.clubName, 'Tech Club')}
                                        </p>
                                    </div>

                                    {/* Quick Info Grid */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <QuickItem icon={<Calendar size={18} />} label="Date" value={safeRender(event.date)} />
                                        <QuickItem icon={<Clock size={18} />} label="Time" value={safeRender(event.time)} />
                                        <QuickItem icon={<MapPin size={18} />} label="Venue" value={safeRender(event.venue)} />
                                        <QuickItem icon={<Users size={18} />} label="Team Size" value={`${safeRender(event.minTeamSize, 1)}-${safeRender(event.maxTeamSize, 1)} Members`} />
                                    </div>

                                    {/* About Section */}
                                    <section>
                                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-gray-500 mb-4 flex items-center gap-2">
                                            <BookOpen size={16} /> ABOUT THE EVENT
                                        </h3>
                                        <p className="text-gray-300 leading-relaxed text-lg font-medium">
                                            {safeRender(event.description)}
                                        </p>
                                    </section>

                                    {/* Perks */}
                                    <section>
                                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-gray-500 mb-4 flex items-center gap-2">
                                            <Trophy size={16} /> PERKS & PRIZES
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {['Cash Prizes for winners', 'Participation Certificates', 'Lunch & Refreshments'].map((perk, i) => (
                                                <div key={i} className="flex items-center gap-3 p-4 glass rounded-2xl border-white/5">
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                        <Trophy size={14} />
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-300 uppercase tracking-tight">{perk}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Capacity */}
                                    <section className="bg-primary/5 rounded-3xl p-8 border border-primary/20">
                                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-primary mb-4 flex items-center gap-2">
                                            REGISTRATION STATUS
                                        </h3>
                                        <div className="flex items-end justify-between mb-4">
                                            <p className="text-4xl font-black text-white italic">
                                                {safeRender(event.registeredCount, 0)}
                                                <span className="text-gray-500 text-lg not-italic">
                                                    /{safeRender(event.maxCapacity, 100)}
                                                </span>
                                            </p>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Slots Filled</p>
                                        </div>
                                        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(Number(event.registeredCount || 0) / (Number(event.maxCapacity || 100))) * 100}%` }}
                                                className="h-full bg-primary rounded-full"
                                            />
                                        </div>
                                    </section>
                                </motion.div>
                            )}

                            {flow === 'select' && (
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex flex-col items-center justify-center text-center gap-12">
                                    <div className="space-y-4">
                                        <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">Registration Hub</h2>
                                        <p className="text-gray-500 uppercase tracking-widest text-xs font-bold">Pick your entry style for {safeRender(event.title)}</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                                        <SelectionCard
                                            icon={<Plus size={32} />}
                                            title="Create Team"
                                            desc="Start a new team and invite your tech squad"
                                            onClick={() => setFlow('create')}
                                            primary
                                        />
                                        <SelectionCard
                                            icon={<Users2 size={32} />}
                                            title="Join Team"
                                            desc="Find an existing team looking for members"
                                            onClick={() => setFlow('join')}
                                        />
                                    </div>

                                    <button onClick={() => setFlow('details')} className="text-gray-500 font-black uppercase text-[10px] tracking-[0.2em] border-b border-gray-800 pb-1 hover:text-white transition-all">
                                        Go Back to details
                                    </button>
                                </motion.div>
                            )}

                            {flow === 'create' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-xl mx-auto py-10">
                                    <h2 className="text-3xl font-black italic text-white uppercase mb-8">Team Formation</h2>
                                    <form onSubmit={handleCreateTeam} className="space-y-6">
                                        <div className="flex justify-center mb-8">
                                            <div className="relative group">
                                                <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-700 overflow-hidden">
                                                    {teamForm.profilePic ? (
                                                        <img src={teamForm.profilePic} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Users2 size={32} />
                                                    )}
                                                </div>
                                                <button type="button" className="absolute bottom-[-10px] right-[-10px] w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-all">
                                                    <Camera size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Team Name</label>
                                                <input
                                                    required
                                                    placeholder="e.g. Nexus Pioneers"
                                                    className="w-full bg-white/5 border border-white/5 focus:border-primary rounded-2xl py-4 px-6 text-white text-lg font-bold placeholder:text-gray-800 outline-none transition-all"
                                                    value={teamForm.name}
                                                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Team Motto / Description</label>
                                                <textarea
                                                    rows={3}
                                                    placeholder="Briefly describe your team's goal..."
                                                    className="w-full bg-white/5 border border-white/5 focus:border-primary rounded-2xl py-4 px-6 text-white font-medium placeholder:text-gray-800 outline-none transition-all resize-none"
                                                    value={teamForm.description}
                                                    onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-6 flex gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setFlow('select')}
                                                className="flex-1 glass py-5 rounded-[24px] text-white font-black uppercase tracking-widest"
                                            >
                                                CANCEL
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="flex-[2] bg-primary hover:bg-blue-600 disabled:opacity-50 py-5 rounded-[24px] text-white font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-primary/20"
                                            >
                                                {isSubmitting ? <Loader2 className="animate-spin" /> : 'CREATE TEAM'}
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            )}

                            {flow === 'join' && (
                                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="max-w-2xl mx-auto py-10 space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-3xl font-black italic text-white uppercase">Available Teams</h2>
                                        <button onClick={() => setFlow('select')} className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Back</button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {teams.length > 0 ? (
                                            teams.map(team => (
                                                <div key={team.id} className="glass p-6 rounded-[28px] border-white/5 flex items-center gap-6 group hover:bg-white/[0.03] transition-all">
                                                    <img src={team.profilePic} className="w-16 h-16 rounded-2xl object-cover shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-lg font-black italic text-white uppercase truncate">{safeRender(team.teamName)}</h4>
                                                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Leader: {safeRender(team.leaderName)}</p>
                                                        <div className="flex items-center gap-4 mt-2">
                                                            <div className="flex items-center gap-1.5 text-gray-500 font-bold text-[10px] uppercase">
                                                                <Users size={12} /> {team.members?.length || 0}/{safeRender(team.maxMembers, 0)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleJoinRequest(team.id)}
                                                        className="px-6 py-3 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                                    >
                                                        SEND REQUEST
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-20 bg-white/5 rounded-[32px] border border-dashed border-white/10">
                                                <Users2 size={40} className="mx-auto text-gray-700 mb-4" />
                                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No teams are currently forming. Why not create one?</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {flow === 'success' && (
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-10">
                                    <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-8 border border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.1)]">
                                        <CheckCircle2 size={48} strokeWidth={3} />
                                    </div>
                                    <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-4">You're in!</h2>
                                    <p className="text-gray-500 font-medium text-lg mb-12">Team <span className="text-primary font-black italic">{safeRender(createdTeam?.teamName)}</span> is now active. Start recruiting your squad!</p>

                                    <div className="grid grid-cols-2 gap-4 w-full mb-8">
                                        <ShareButton icon={<Share2 size={20} />} label="Invite squad" />
                                        <ShareButton icon={<QrCode size={20} />} label="Show Entry QR" />
                                    </div>

                                    <button
                                        onClick={() => closeModal('eventDetails')}
                                        className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-5 rounded-[24px] uppercase tracking-widest transition-all border border-white/5"
                                    >
                                        Back to explorer
                                    </button>
                                </motion.div>
                            )}
                        </div>

                        {/* Sticky Footer: Details CTA */}
                        {flow === 'details' && (
                            <div className="p-6 md:p-10 glass border-t border-white/10 absolute bottom-0 inset-x-0 shrink-0">
                                <button
                                    onClick={() => setFlow('select')}
                                    className="w-full bg-primary hover:bg-blue-600 active:scale-95 text-white font-black py-5 rounded-[24px] flex items-center justify-center gap-3 transition-all shadow-xl shadow-primary/20 text-lg uppercase tracking-[0.2em]"
                                >
                                    <span>Register Now</span>
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

const QuickItem = ({ icon, label, value }) => (
    <div className="glass p-4 rounded-2xl border-white/5 space-y-1 hover:bg-white/[0.03] transition-all">
        <div className="text-primary flex items-center gap-2">
            {icon}
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 opacity-60">{label}</span>
        </div>
        <p className="font-black text-sm text-white truncate uppercase tracking-tight">{value}</p>
    </div>
);

const SelectionCard = ({ icon, title, desc, onClick, primary }) => (
    <button
        onClick={onClick}
        className={`p-8 rounded-[32px] text-left transition-all border space-y-4 group hover:scale-[1.02] active:scale-95 ${primary
            ? 'bg-primary/10 border-primary/20 hover:bg-primary/20'
            : 'glass border-white/5 hover:border-white/20'
            }`}
    >
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${primary ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-gray-400 group-hover:text-white'
            }`}>
            {icon}
        </div>
        <div className="space-y-1">
            <h4 className="text-xl font-black italic text-white uppercase">{title}</h4>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">{desc}</p>
        </div>
    </button>
);

const ShareButton = ({ icon, label }) => (
    <button className="flex flex-col items-center gap-3 p-6 glass rounded-3xl border-white/5 hover:bg-white/10 transition-all active:scale-95 group">
        <div className="text-gray-400 group-hover:text-primary transition-colors">
            {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</span>
    </button>
);

export default EventDetailsModal;
