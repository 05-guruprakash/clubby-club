import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Share2, MoreVertical, Plus, Image as ImageIcon, Send, Clock, User as UserIcon } from 'lucide-react';
import { subscribeToPosts, toggleLike, createPost } from '../services/postService';
import { useAuthStore, useModalStore } from '../store';
import toast from 'react-hot-toast';

const FeedPage = () => {
    const [posts, setPosts] = useState([]);
    const [activeFilter, setActiveFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuthStore();
    const { openModal } = useModalStore();

    useEffect(() => {
        // Collect club IDs the user is interested in (joined + followed)
        const clubIds = [...(user?.joinedClubs || []), ...(user?.followedClubs || [])];

        const unsubscribe = subscribeToPosts(clubIds, (data) => {
            setPosts(data);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const filteredPosts = posts.filter(post => {
        if (activeFilter === 'all') return true;
        return post.type === activeFilter;
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-gray-500 uppercase tracking-widest text-xs font-bold">Fetching Latest Campus Buzz...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div className="space-y-2">
                    <h2 className="text-4xl font-black italic tracking-tight uppercase">Campus <span className="text-primary">Feed</span></h2>
                    <p className="text-gray-500 font-medium">Updates from your favorite clubs & events</p>
                </div>
            </div>

            <div className="flex glass rounded-2xl p-1 overflow-x-auto no-scrollbar gap-2 sticky top-20 z-10 mx-2">
                {['all', 'announcement', 'event', 'general'].map((filter) => (
                    <button
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        className={`flex-1 py-2.5 px-6 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${activeFilter === filter ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            {/* Post Creation (Admins only) */}
            {user?.role === 'admin' && (
                <CreatePostCTA />
            )}

            {/* Feed List */}
            <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                    {filteredPosts.map(post => (
                        <PostCard key={post.id} post={post} userId={user?.uid} />
                    ))}
                </AnimatePresence>

                {filteredPosts.length === 0 && (
                    <div className="text-center py-20 glass rounded-[32px] border-white/5 mx-2">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Clock size={24} className="text-gray-600" />
                        </div>
                        <h4 className="text-xl font-black italic text-gray-500">NO RECENT UPDATES</h4>
                        <p className="text-xs text-gray-700 uppercase tracking-widest mt-2">Check back after following some clubs</p>
                    </div>
                )}
            </div>

            {/* FAB for creation (Admin) */}
            {user?.role === 'admin' && (
                <button
                    className="fixed bottom-24 right-6 md:right-12 w-16 h-16 bg-primary text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
                    onClick={() => openModal('createPost')}
                >
                    <Plus size={32} />
                </button>
            )}
        </div>
    );
};

const PostCard = ({ post, userId }) => {
    const isLiked = post.likes?.includes(userId);

    const handleLike = async () => {
        try {
            await toggleLike(post.id, userId, isLiked);
        } catch (err) {
            toast.error('Failed to update like');
        }
    };

    return (
        <motion.article
            layout
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass rounded-[32px] border-white/5 overflow-hidden transition-all hover:bg-white/[0.03]"
        >
            <div className="p-6">
                {/* Author Header */}
                <div className="flex items-center gap-3 mb-6">
                    <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`}
                        className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10"
                    />
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black italic uppercase tracking-tight text-white">{post.authorName}</h4>
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                {post.authorRole || 'Chairman'}
                            </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                            {post.clubName} <span className="text-white/10">•</span> {new Date(post.timestamp?.seconds * 1000).toLocaleDateString()}
                        </p>
                    </div>
                    <button className="text-gray-600 hover:text-white transition-colors">
                        <MoreVertical size={20} />
                    </button>
                </div>

                {/* Post Content */}
                <div className="space-y-4">
                    <p className="text-gray-300 leading-relaxed font-medium">
                        {post.content}
                    </p>

                    {post.images && post.images.length > 0 && (
                        <div className="rounded-2xl overflow-hidden border border-white/5 bg-black/40">
                            <img src={post.images[0]} className="w-full object-cover max-h-[400px]" alt="Post" />
                        </div>
                    )}
                </div>

                {/* Engagement Footer */}
                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={handleLike}
                            className={`flex items-center gap-2 transition-all ${isLiked ? 'text-red-500 scale-110' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Heart size={20} fill={isLiked ? "currentColor" : "none"} strokeWidth={2.5} />
                            <span className="text-xs font-black tracking-tighter">{post.likes?.length || 0}</span>
                        </button>
                        <button className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors">
                            <MessageCircle size={20} strokeWidth={2.5} />
                            <span className="text-xs font-black tracking-tighter">{post.comments?.length || 0}</span>
                        </button>
                    </div>
                    <button className="text-gray-500 hover:text-white transition-colors">
                        <Share2 size={18} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        </motion.article>
    );
};

const CreatePostCTA = () => (
    <div className="glass rounded-[32px] border-white/5 p-6 mx-2 mb-10 flex gap-4 items-center group cursor-pointer hover:bg-white/[0.03] transition-all">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-600 transition-colors group-hover:text-primary border border-white/5 group-hover:border-primary/20">
            <UserIcon size={24} />
        </div>
        <div className="flex-1">
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Announce something new...</p>
            <div className="h-0.5 w-0 group-hover:w-full bg-primary transition-all duration-500 mt-1"></div>
        </div>
        <div className="flex gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-600 group-hover:text-white transition-all">
                <ImageIcon size={18} />
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-all opacity-0 group-hover:opacity-100 shadow-lg shadow-primary/20">
                <Send size={16} />
            </div>
        </div>
    </div>
);

export default FeedPage;
