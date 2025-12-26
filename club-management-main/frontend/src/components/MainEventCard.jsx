import React from 'react';
import { Calendar, MapPin, Users } from 'lucide-react';

const MainEventCard = () => {
    return (
        <div className="w-full max-w-4xl mx-auto rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#0a1120]">
            {/* Panoramic Header Image */}
            <div className="relative h-64 md:h-80 lg:h-96 w-full">
                <img
                    src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop"
                    alt="Outdoor Adventure Day"
                    className="w-full h-full object-cover"
                />
                {/* Category Badge */}
                <div className="absolute top-6 left-6">
                    <span className="px-4 py-1.5 text-xs font-bold bg-black/60 backdrop-blur-md rounded-lg text-white border border-white/10 uppercase tracking-widest">
                        Sports
                    </span>
                </div>
            </div>

            {/* Info Section - Strong Glassmorphism */}
            <div className="relative p-8 pb-4">
                <div
                    className="absolute inset-0 bg-white/5"
                    style={{
                        backdropFilter: 'blur(60px)',
                        WebkitBackdropFilter: 'blur(60px)',
                    }}
                />

                <div className="relative z-10 px-4">
                    <h2 className="text-5xl font-extrabold text-white mb-4 tracking-tight">Outdoor Adventure Day</h2>
                    <p className="text-gray-300 text-xl mb-8 font-light max-w-2xl">
                        Hiking, kayaking, and rock climbing trip to the mountains.
                    </p>

                    {/* Meta Data Row */}
                    <div className="flex flex-wrap items-center gap-8 text-gray-400 mb-6">
                        <div className="flex items-center gap-3">
                            <Calendar size={20} className="text-blue-400" />
                            <span className="font-medium text-base text-gray-300">Mar 25</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin size={20} className="text-blue-400" />
                            <span className="font-medium text-base text-gray-300">Meet at Quad</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Users size={20} className="text-blue-400" />
                            <span className="font-medium text-base text-gray-300">4s</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="bg-[#050505] flex items-center h-24 px-10 border-t border-white/5">
                <div className="flex-1 flex justify-center">
                    <button className="px-24 py-4 border border-white/30 hover:bg-white/10 text-white font-bold rounded-xl transition-all uppercase tracking-[0.2em] text-sm">
                        Register
                    </button>
                </div>

                <button className="bg-[#121418] hover:bg-[#1a1d24] text-gray-300 text-sm font-bold px-8 py-4 rounded-xl transition-all border border-white/10 shadow-lg">
                    Solo?
                </button>
            </div>
        </div>
    );
};

export default MainEventCard;
