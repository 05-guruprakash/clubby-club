import React from 'react';

const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[999]">
            <div className="relative w-24 h-24">
                {/* Spinner rings */}
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin"></div>

                {/* Pulsing core */}
                <div className="absolute inset-4 bg-primary/10 rounded-full animate-pulse flex items-center justify-center">
                    <span className="text-primary font-black italic text-xl">M</span>
                </div>
            </div>

            <div className="mt-8 text-center">
                <h2 className="text-xl font-bold tracking-widest animate-pulse">
                    NEXUS <span className="text-primary italic">HUB</span>
                </h2>
                <p className="text-gray-500 text-xs mt-2 uppercase tracking-tight">
                    Connecting Campus Life...
                </p>
            </div>
        </div>
    );
};

export default LoadingScreen;
