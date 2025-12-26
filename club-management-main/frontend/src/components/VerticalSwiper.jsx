import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import EventCard from './EventCard';

const VerticalSwiper = ({ events, onInterest, onSkip, onRefresh, onViewDetails }) => {
    const [cards, setCards] = useState(events.slice(0, 5));
    const [exitDirection, setExitDirection] = useState(null);

    const handleDragEnd = (event, info, cardIndex) => {
        const offsetY = info.offset.y;
        const velocityY = info.velocity.y;

        // Only allow top card to be swiped
        if (cardIndex !== 0) return;

        // Threshold for swipe
        const threshold = 150;
        const velocityThreshold = 500;

        if (offsetY < -threshold || velocityY < -velocityThreshold) {
            // Swiped UP - Interest
            setExitDirection('up');
            removeTopCard('interest');
        } else if (offsetY > threshold || velocityY > velocityThreshold) {
            // Swiped DOWN - Skip
            setExitDirection('down');
            removeTopCard('skip');
        }
    };

    const removeTopCard = (action) => {
        const removedCard = cards[0];

        setTimeout(() => {
            setCards((prev) => prev.slice(1));
            setExitDirection(null);

            if (action === 'interest') {
                onInterest?.(removedCard);
            } else {
                onSkip?.(removedCard);
            }
        }, 200);
    };

    const handleRefresh = () => {
        setCards(events.slice(0, 5));
        onRefresh?.();
    };

    // Empty state
    if (cards.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-[500px] text-center"
            >
                <div className="w-20 h-20 mb-6 rounded-full bg-gray-800/50 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">No more events for today</h3>
                <p className="text-gray-400 mb-8 max-w-xs">
                    You've seen all the events. Check back later for new ones!
                </p>
                <motion.button
                    onClick={handleRefresh}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-600/30"
                >
                    <RefreshCw size={18} />
                    Refresh
                </motion.button>
            </motion.div>
        );
    }

    return (
        <div className="relative h-[480px] w-full max-w-[380px] mx-auto">
            {/* Swipe indicators */}
            <div className="absolute -top-12 left-0 right-0 flex justify-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                    <span className="text-emerald-400">↑</span> Interest
                </span>
                <span className="flex items-center gap-1">
                    <span className="text-rose-400">↓</span> Skip
                </span>
            </div>

            <AnimatePresence mode="popLayout">
                {cards.map((card, index) => {
                    const isTop = index === 0;
                    const scale = 1 - index * 0.05;
                    const yOffset = index * 12;
                    const opacity = 1 - index * 0.15;
                    const zIndex = cards.length - index;

                    return (
                        <motion.div
                            key={card.id}
                            className="absolute inset-0"
                            style={{ zIndex }}
                            initial={{
                                scale: scale - 0.05,
                                y: yOffset + 12,
                                opacity: 0
                            }}
                            animate={{
                                scale,
                                y: yOffset,
                                opacity: Math.max(0.4, opacity),
                                transition: {
                                    type: 'spring',
                                    stiffness: 300,
                                    damping: 25
                                }
                            }}
                            exit={{
                                y: exitDirection === 'up' ? -600 : 600,
                                opacity: 0,
                                scale: 0.8,
                                rotate: exitDirection === 'up' ? -10 : 10,
                                transition: {
                                    duration: 0.3,
                                    ease: 'easeOut'
                                }
                            }}
                            drag={isTop ? 'y' : false}
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={0.9}
                            onDragEnd={(e, info) => handleDragEnd(e, info, index)}
                            whileDrag={isTop ? { scale: 1.02, cursor: 'grabbing' } : {}}
                        >
                            <motion.div
                                className={`h-full ${isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                                style={{
                                    filter: isTop ? 'none' : `blur(${index * 0.5}px)`,
                                }}
                            >
                                <EventCard
                                    image={card.image}
                                    eventName={card.eventName}
                                    clubName={card.clubName}
                                    clubLogo={card.clubLogo}
                                    date={card.date}
                                    time={card.time}
                                    venue={card.venue}
                                    onViewDetails={() => onViewDetails?.(card)}
                                />
                            </motion.div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            {/* Progress indicator */}
            <div className="absolute -bottom-10 left-0 right-0 flex justify-center gap-1.5">
                {events.slice(0, 5).map((_, index) => (
                    <div
                        key={index}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${index < cards.length
                            ? 'bg-blue-500'
                            : 'bg-gray-700'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
};

export default VerticalSwiper;
