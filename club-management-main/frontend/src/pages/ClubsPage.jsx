import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Grid, List, Users, ChevronRight, Plus, Follower } from 'lucide-react';
import { subscribeToClubs } from '../services/clubService';
import { useAuthStore } from '../store';
import { Link } from 'react-router-dom';

const ClubsPage = () => {
    const [clubs, setClubs] = useState([]);
    const [viewMode, setViewMode] = useState('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuthStore();

    useEffect(() => {
        const unsubscribe = subscribeToClubs((data) => {
            setClubs(data);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const joinedClubs = clubs.filter(club => user?.joinedClubs?.includes(club.id));
    const otherClubs = clubs.filter(club => !user?.joinedClubs?.includes(club.id));

    const filteredClubs = otherClubs.filter(club =>
        club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        club.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-gray-500 uppercase tracking-widest text-xs font-bold">Connecting To Student Organizations...</p>
            </div>
        );
    }

    return (
        <div className="space-y-12 animate-fade-in max-w-6xl mx-auto">
            {/* Search Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <h2 className="text-4xl font-black italic tracking-tight uppercase">Discover <span className="text-primary">Clubs</span></h2>
                    <p className="text-gray-500 font-medium">Join interest groups and communities across MIT</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
                        <input
                            placeholder="Search for clubs or interests..."
                            className="w-full bg-white/5 border border-white/5 focus:border-primary rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-700 outline-none transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex glass rounded-2xl p-1 shrink-0">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-gray-500'}`}
                        >
                            <Grid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary text-white' : 'text-gray-500'}`}
                        >
                            <List size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* My Joined Clubs */}
            {joinedClubs.length > 0 && (
                <section className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-gray-500">YOUR CLUBS</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence>
                            {joinedClubs.map(club => (
                                <ClubCard key={club.id} club={club} isJoined={true} />
                            ))}
                        </AnimatePresence>
                    </div>
                </section>
            )}

            {/* Explore More */}
            <section className="space-y-6">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-gray-500">EXPLORE COMMUNITIES</h3>
                <div className={viewMode === 'grid'
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    : "flex flex-col gap-4"
                }>
                    <AnimatePresence>
                        {filteredClubs.map(club => (
                            <ClubCard key={club.id} club={club} isJoined={false} viewMode={viewMode} />
                        ))}
                    </AnimatePresence>
                </div>
            </section>
        </div>
    );
};

const ClubCard = ({ club, isJoined, viewMode = 'grid' }) => {
    if (viewMode === 'list') {
        return (
            <motion.div
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass hover:bg-white/10 p-4 rounded-2xl border-white/5 flex items-center gap-4 transition-all group"
            >
                <img src={club.profilePic || 'https://api.dicebear.com/7.x/initials/svg?seed=' + club.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                    <h4 className="font-black italic text-white uppercase truncate">{club.name}</h4>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold flex items-center gap-2">
                        <Users size={12} className="text-primary" /> {club.memberCount || 0} Members
                    </p>
                </div>
                <Link
                    to={`/clubs/${club.id}`}
                    className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-primary transition-all flex items-center justify-center text-white"
                >
                    <ChevronRight size={20} />
                </Link>
            </motion.div>
        );
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-3xl overflow-hidden border-white/5 group hover:border-primary/20 transition-all"
        >
            <div className="relative h-32 bg-gray-900">
                <img src={club.coverImage || 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=2070'} className="w-full h-full object-cover opacity-50" />
                <div className="absolute -bottom-6 left-6 w-16 h-16 rounded-2xl glass border-white/10 p-1">
                    <img src={club.profilePic || 'https://api.dicebear.com/7.x/initials/svg?seed=' + club.name} className="w-full h-full rounded-xl object-cover" />
                </div>
            </div>

            <div className="p-8 pt-10">
                <h4 className="text-lg font-black italic text-white uppercase mb-1 truncate">{club.name}</h4>
                <p className="text-xs text-gray-500 line-clamp-2 h-8 mb-6">{club.description || 'A community of passionate students at MIT.'}</p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                    <div className="flex -space-x-3 overflow-hidden">
                        {[1, 2, 3].map(i => (
                            <img
                                key={i}
                                className="inline-block h-6 w-6 rounded-full ring-2 ring-black"
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${club.id}${i}`}
                            />
                        ))}
                    </div>
                    <Link
                        to={`/clubs/${club.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                        {isJoined ? 'OPEN' : 'JOIN'} <ChevronRight size={14} />
                    </Link>
                </div>
            </div>
        </motion.div>
    );
};

export default ClubsPage;
