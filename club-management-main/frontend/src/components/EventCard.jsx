import React from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';

const EventCard = ({
    image,
    eventName,
    clubLogo,
    clubName,
    date,
    time,
    venue,
    onViewDetails,
}) => {
    return (
        <div
            className="relative w-full h-[420px] rounded-[32px] overflow-hidden shadow-2xl shadow-black/40 group cursor-pointer transition-all duration-300 hover:shadow-3xl hover:shadow-black/50"
            style={{
                backgroundImage: `url(${image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            {/* Gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Glassmorphic Footer - Bottom 30% */}
            <div className="absolute bottom-0 left-0 right-0 h-[30%] min-h-[140px]">
                {/* Glass effect background */}
                <div
                    className="absolute inset-0 backdrop-blur-xl bg-white/10 border-t border-white/20"
                    style={{
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                    }}
                />

                {/* Content */}
                <div className="relative h-full flex flex-col justify-between p-5">
                    {/* Top Section */}
                    <div>
                        {/* Event Name */}
                        <h3 className="text-xl font-semibold text-white mb-3 line-clamp-1 group-hover:text-blue-300 transition-colors">
                            {eventName}
                        </h3>

                        {/* Club Badge */}
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-white/30 bg-gray-800 flex-shrink-0">
                                {clubLogo ? (
                                    <img
                                        src={clubLogo}
                                        alt={clubName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                                        {clubName?.charAt(0)?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <span className="text-sm text-gray-300 font-medium truncate">
                                {clubName}
                            </span>
                        </div>

                        {/* Details Row */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                            {date && (
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={14} className="text-blue-400" />
                                    <span>{date}</span>
                                </div>
                            )}
                            {time && (
                                <div className="flex items-center gap-1.5">
                                    <Clock size={14} className="text-emerald-400" />
                                    <span>{time}</span>
                                </div>
                            )}
                            {venue && (
                                <div className="flex items-center gap-1.5">
                                    <MapPin size={14} className="text-rose-400" />
                                    <span className="truncate max-w-[120px]">{venue}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* View Details Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewDetails?.();
                        }}
                        className="w-full py-2.5 mt-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40"
                    >
                        View Details
                    </button>
                </div>
            </div>

            {/* Hover shine effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
            </div>
        </div>
    );
};

export default EventCard;
