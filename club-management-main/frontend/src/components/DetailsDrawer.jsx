import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const DetailsDrawer = ({ isOpen, onClose, event }) => {
    const [dragY, setDragY] = useState(0);
    const constraintsRef = useRef(null);

    if (!event) return null;

    const handleDragEnd = (event, info) => {
        // If dragged down more than 150px, close the drawer
        if (info.offset.y > 150) {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Drawer */}
                    <motion.div
                        ref={constraintsRef}
                        initial={{ y: '100%' }}
                        animate={{ y: '20%' }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: 'spring',
                            damping: 30,
                            stiffness: 300,
                        }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.2}
                        onDragEnd={handleDragEnd}
                        onDrag={(e, info) => setDragY(info.offset.y)}
                        className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
                        style={{ height: '80%' }}
                    >
                        {/* Drawer Container */}
                        <div className="h-full glass rounded-t-[32px] shadow-2xl flex flex-col overflow-hidden border-t border-white/20">
                            {/* Sticky Header with Close Handle */}
                            <div className="flex-shrink-0 sticky top-0 z-10 glass border-b border-white/10 px-6 py-4">
                                {/* Drag Handle */}
                                <div className="flex justify-center mb-3">
                                    <div className="w-12 h-1.5 rounded-full bg-gray-600 cursor-grab active:cursor-grabbing" />
                                </div>

                                {/* Header Content */}
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h2 className="text-2xl font-bold text-white mb-1">
                                            {event.eventName}
                                        </h2>
                                        <p className="text-sm text-gray-400">{event.clubName}</p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-xl hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable Body */}
                            <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
                                {/* Event Image */}
                                <div className="w-full h-48 rounded-2xl overflow-hidden mb-6">
                                    <img
                                        src={event.image}
                                        alt={event.eventName}
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                {/* Event Details */}
                                <div className="space-y-6">
                                    {/* Description */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-3">
                                            About This Event
                                        </h3>
                                        <p className="text-gray-300 leading-relaxed">
                                            {event.description ||
                                                `Join us for ${event.eventName}! This is an amazing opportunity to connect with fellow students, showcase your skills, and be part of something special. Whether you're a beginner or an expert, everyone is welcome to participate and make lasting memories.`}
                                        </p>
                                    </div>

                                    {/* Event Info Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="glass rounded-xl p-4">
                                            <p className="text-xs text-gray-500 mb-1">Date</p>
                                            <p className="text-white font-medium">{event.date}</p>
                                        </div>
                                        <div className="glass rounded-xl p-4">
                                            <p className="text-xs text-gray-500 mb-1">Time</p>
                                            <p className="text-white font-medium">{event.time}</p>
                                        </div>
                                        <div className="glass rounded-xl p-4 col-span-2">
                                            <p className="text-xs text-gray-500 mb-1">Venue</p>
                                            <p className="text-white font-medium">{event.venue}</p>
                                        </div>
                                    </div>

                                    {/* Event Rules */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-3">
                                            Event Rules
                                        </h3>
                                        <ul className="space-y-2">
                                            {(event.rules || [
                                                'All participants must register before the event deadline',
                                                'Valid student ID required for entry',
                                                'Teams must have 2-4 members',
                                                'Follow the code of conduct at all times',
                                                'Respect all participants and organizers',
                                            ]).map((rule, index) => (
                                                <li key={index} className="flex items-start gap-3 text-gray-300">
                                                    <span className="text-blue-400 mt-1">•</span>
                                                    <span>{rule}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Prize Pool */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-3">
                                            Prize Pool
                                        </h3>
                                        <div className="space-y-3">
                                            {(event.prizes || [
                                                { place: '1st Place', prize: '$500 + Trophy' },
                                                { place: '2nd Place', prize: '$300 + Certificate' },
                                                { place: '3rd Place', prize: '$200 + Certificate' },
                                            ]).map((prize, index) => (
                                                <div key={index} className="glass rounded-xl p-4 flex justify-between items-center">
                                                    <span className="text-white font-medium">{prize.place}</span>
                                                    <span className="text-blue-400 font-semibold">{prize.prize}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Extra spacing for footer */}
                                    <div className="h-24" />
                                </div>
                            </div>

                            {/* Fixed Footer with Register Button */}
                            <div className="flex-shrink-0 sticky bottom-0 glass border-t border-white/10 px-6 py-4">
                                <button
                                    className="w-full py-4 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                                    style={{
                                        backgroundColor: '#0D47A1',
                                        boxShadow: '0 10px 30px rgba(13, 71, 161, 0.3)',
                                    }}
                                    onClick={() => {
                                        console.log('Registering for:', event.eventName);
                                        // Handle registration logic
                                    }}
                                >
                                    Register Now
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default DetailsDrawer;
