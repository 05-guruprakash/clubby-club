import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Construction } from 'lucide-react';

const ComingSoon = ({ title }) => {
    const navigate = useNavigate();
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-8 animate-fade-in">
            <div className="w-24 h-24 bg-primary/10 rounded-[32px] flex items-center justify-center mb-6 border border-primary/20">
                <Construction size={44} className="text-primary" />
            </div>
            <h2 className="text-4xl font-black italic mb-2 uppercase tracking-tight">{title || 'Under Construction'}</h2>
            <p className="text-gray-500 max-w-sm mx-auto mb-8 font-medium">We're building the most advanced club management features for you. Stay tuned!</p>
            <button
                onClick={() => navigate(-1)}
                className="glass hover:bg-white/5 px-8 py-4 rounded-2xl font-black text-white transition-all active:scale-95 flex items-center gap-2"
            >
                <ChevronLeft size={20} /> GO BACK
            </button>
        </div>
    );
};

export const ClubDetailsPage = () => <ComingSoon title="Club Hub" />;
export const EventDetailsPage = () => <ComingSoon title="Event Intel" />;
export const AdminDashboard = () => <ComingSoon title="Aegis Admin" />;

export default ComingSoon;
