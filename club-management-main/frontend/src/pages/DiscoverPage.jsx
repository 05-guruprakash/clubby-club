import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, Heart, X, RefreshCw, Info } from 'lucide-react';
import { subscribeToEvents } from '../services/eventService';
import { useModalStore } from '../store';
import { seedEvents } from '../utils/seeder';
import EventDetailsModal from '../components/modals/EventDetailsModal';
import toast from 'react-hot-toast';

// Helper to safely render values that might be Objects (like Firestore Timestamps)
const safeRender = (val, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string' || typeof val === 'number') return val;
    if (typeof val === 'object' && val.toDate) return val.toDate().toLocaleDateString(); // Firestore Timestamp
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

const DiscoverPage = () => {
    const [events, setEvents] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const { openModal } = useModalStore();

    useEffect(() => {
        const unsubscribe = subscribeToEvents((data) => {
            setEvents(data);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSwipe = (swipeDirection) => {
        setDirection(swipeDirection);
        setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
            setDirection(null);
        }, 200);
    };

    const handleRefresh = () => {
        setCurrentIndex(0);
    };

    const handleForceSeed = async () => {
        const res = await seedEvents(true);
        if (res.success) {
            toast.success(res.message);
            setCurrentIndex(0);
        } else {
            toast.error(res.message);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-gray-500 uppercase tracking-widest text-xs font-bold">Scanning Campus Events...</p>
            </div>
        );
    }

    if (events.length === 0 || currentIndex >= events.length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-8 animate-fade-in">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
                    <RefreshCw size={40} className="text-primary" />
                </div>
                <h2 className="text-3xl font-black italic mb-2 uppercase tracking-tighter text-white">ALL CAUGHT UP!</h2>
                <p className="text-gray-500 max-w-xs mx-auto mb-8 font-medium">No more events to discover for today. Check back later for new updates.</p>

                <div className="flex flex-col gap-3 w-full max-w-[280px] mx-auto">
                    <button
                        onClick={handleRefresh}
                        className="bg-primary hover:bg-blue-600 px-8 py-4 rounded-2xl font-black text-white transition-all active:scale-95 shadow-xl shadow-primary/20 uppercase tracking-widest text-xs"
                    >
                        REFRESH STACK
                    </button>

                    <button
                        onClick={handleForceSeed}
                        className="glass border-primary/20 text-primary hover:bg-primary/5 px-8 py-4 rounded-2xl font-black transition-all active:scale-95 uppercase tracking-widest text-xs"
                    >
                        {events.length === 0 ? "FORCE RE-SEED DATA" : "WIPE & RE-SEED"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative max-w-lg mx-auto h-[75vh] md:h-[80vh] flex flex-col pt-4">
            <div className="flex-1 relative perspective-1000">
                <AnimatePresence>
                    {events.slice(currentIndex, currentIndex + 3).reverse().map((event, index) => {
                        const actualIndexInSlice = events.slice(currentIndex, currentIndex + 3).length - 1 - index;
                        const isTop = index === (events.slice(currentIndex, currentIndex + 3).length - 1);
                        if (!event) return null;
                        return (
                            <EventCard
                                key={event.id || index}
                                event={event}
                                isTop={isTop}
                                onSwipe={handleSwipe}
                                onOpenDetails={() => openModal('eventDetails', event)}
                            />
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-6 mt-8 pb-4">
                <button
                    onClick={() => handleSwipe('left')}
                    className="w-16 h-16 rounded-full glass border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90"
                >
                    <X size={28} strokeWidth={3} />
                </button>
                <button
                    onClick={() => events[currentIndex] && openModal('eventDetails', events[currentIndex])}
                    className="w-14 h-14 rounded-full glass border-blue-500/20 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all active:scale-90"
                >
                    <Info size={24} strokeWidth={3} />
                </button>
                <button
                    onClick={() => handleSwipe('right')}
                    className="w-16 h-16 rounded-full glass border-green-500/20 text-green-500 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all active:scale-90"
                >
                    <Heart size={28} strokeWidth={3} />
                </button>
            </div>

            <EventDetailsModal />
        </div>
    );
};

const EventCard = ({ event, isTop, onSwipe, onOpenDetails }) => {
    if (!event) return null;

    return (
        <motion.div
            drag={isTop ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(e, info) => {
                if (info.offset.x > 100) onSwipe('right');
                else if (info.offset.x < -100) onSwipe('left');
            }}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: isTop ? 1 : 0.95, opacity: 1, y: isTop ? 0 : 10 }}
            exit={{
                x: onSwipe === 'right' ? 1000 : -1000,
                rotate: onSwipe === 'right' ? 20 : -20,
                opacity: 0
            }}
            className={`absolute inset-0 cursor-grab active:cursor-grabbing ${!isTop && 'pointer-events-none'}`}
            style={{ zIndex: isTop ? 10 : 0 }}
        >
            <div className="relative h-full rounded-[32px] overflow-hidden border border-white/10 shadow-2xl bg-[#111]">
                {/* Banner */}
                <img
                    src={event.banner || 'https://images.unsplash.com/photo-1540575861501-7ad060e39fe5?q=80&w=2070'}
                    className="w-full h-full object-cover"
                    alt={safeRender(event.title, 'Event')}
                />

                {/* Overlay Gradients */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent"></div>

                {/* Club Logo */}
                <div className="absolute top-6 left-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl glass border-white/10 p-1 flex items-center justify-center">
                        <img src={event.clubRef?.profilePic || 'https://api.dicebear.com/7.x/initials/svg?seed=MIT'} className="w-full h-full rounded-xl object-cover" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80 drop-shadow-md">
                        {safeRender(event.clubName, 'TECH CLUB')}
                    </span>
                </div>

                {/* Info */}
                <div className="absolute inset-x-0 bottom-0 p-8 pt-0">
                    <h2 className="text-3xl font-black text-white italic mb-4 leading-tight">
                        {safeRender(event.title, 'Untitled Event')}
                    </h2>

                    <div className="flex flex-wrap gap-4 text-gray-300 text-xs font-bold uppercase tracking-widest mb-6">
                        <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-primary" />
                            <span>{safeRender(event.date, 'TBA')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-primary" />
                            <span>{safeRender(event.venue, 'CAMPUS')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Users size={14} className="text-primary" />
                            <span>{safeRender(event.maxTeamSize, 1)}s</span>
                        </div>
                    </div>

                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenDetails(); }}
                        className="w-full py-4 glass text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl hover:bg-white/10 transition-all border-white/5"
                    >
                        Swipe for Details
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default DiscoverPage;
