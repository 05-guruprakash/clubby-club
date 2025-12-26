import React from 'react';

const liveUpdates = [
    "registrations open",
    "Study group forming for Finals",
    "Art Club exhibition this Friday",
    "Intramural soccer signups",
    "Battle of the Bands next week",
    "Career Fair: 50+ companies attending",
    "Sustainability Week starts Monday",
    "Hackathon 2024: Register Now",
];

const Header = () => {
    // Duplicate for seamless loop
    const scrollText = [...liveUpdates, ...liveUpdates];

    return (
        <div className="fixed top-0 left-0 right-0 z-50">
            {/* Top Header */}
            <header className="bg-black h-14 flex items-center justify-between px-4 border-b border-white/5">
                <h1 className="text-xl font-bold text-white tracking-tight">NEXUS</h1>
                <div className="flex items-center gap-4">
                    <button className="text-gray-400 hover:text-white p-1.5 rounded-lg border border-white/10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Horizontal Marquee */}
            <div className="bg-[#0a192f] h-10 flex items-center overflow-hidden border-b border-white/5">
                <div className="animate-marquee whitespace-nowrap flex items-center">
                    {scrollText.map((item, index) => (
                        <React.Fragment key={index}>
                            <span className="text-sm text-gray-300 font-medium flex items-center gap-3">
                                {item.startsWith('registrations') && '🎓 '}
                                {item.includes('Study group') && '📚 '}
                                {item.includes('Art Club') && '🎨 '}
                                {item.includes('soccer') && '⚽ '}
                                {item.includes('Bands') && '🎸 '}
                                {item.includes('Career Fair') && '💼 '}
                                {item.includes('Sustainability') && '🌱 '}
                                {item.includes('Hackathon') && '🚀 '}
                                {item}
                            </span>
                            <span className="mx-8 text-gray-600">
                                <svg width="6" height="6" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="3" cy="3" r="3" fill="currentColor" />
                                </svg>
                            </span>
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Header;
