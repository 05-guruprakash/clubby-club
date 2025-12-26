import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, Phone, User as UserIcon, Loader2 } from 'lucide-react';
import { loginWithEmail } from '../../services/authService';
import toast from 'react-hot-toast';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loginMethod, setLoginMethod] = useState('email'); // 'email', 'phone', 'username'
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (loginMethod === 'email') {
                await loginWithEmail(email, password);
                toast.success('Successfully logged in!');
                navigate('/');
            } else {
                toast.error('This login method is coming soon!');
            }
        } catch (error) {
            toast.error(error.message || 'Failed to login');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            {/* Background decoration */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[120px]"></div>
            </div>

            <div className="w-full max-w-md relative animate-fade-in">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 border border-primary/20">
                        <span className="text-3xl font-black italic text-primary">M</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white italic">
                        MIT <span className="text-primary">CLUB HUB</span>
                    </h1>
                    <p className="text-gray-500 text-sm mt-2 uppercase tracking-widest">Welcome Back, Nexus</p>
                </div>

                {/* Login Method Tabs */}
                <div className="flex glass rounded-t-2xl p-1 mb-0 border-b-0">
                    {[
                        { id: 'email', icon: Mail, label: 'Email' },
                        { id: 'username', icon: UserIcon, label: 'Username' },
                        { id: 'phone', icon: Phone, label: 'OTP' }
                    ].map((method) => (
                        <button
                            key={method.id}
                            onClick={() => setLoginMethod(method.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${loginMethod === method.id ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <method.icon size={14} />
                            {method.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleLogin} className="glass p-8 rounded-b-2xl space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">
                                {loginMethod === 'email' ? 'Email Address' : loginMethod === 'username' ? 'Username' : 'Phone Number'}
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors">
                                    {loginMethod === 'email' ? <Mail size={18} /> : loginMethod === 'username' ? <UserIcon size={18} /> : <Phone size={18} />}
                                </div>
                                <input
                                    type={loginMethod === 'email' ? 'email' : 'text'}
                                    required
                                    placeholder={loginMethod === 'email' ? 'you@mitindia.edu' : loginMethod === 'username' ? 'Nexus_User' : '+91 XXXXX XXXXX'}
                                    className="w-full bg-black/40 border border-white/5 focus:border-primary rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-700 outline-none transition-all"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        {loginMethod !== 'phone' && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        className="w-full bg-black/40 border border-white/5 focus:border-primary rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-700 outline-none transition-all"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                        <label className="flex items-center gap-2 text-gray-500 cursor-pointer">
                            <input type="checkbox" className="rounded border-white/10 bg-black/40" />
                            Remember me
                        </label>
                        <Link to="/forgot-password" title="Coming soon!" className="text-primary hover:underline font-bold">Forgot password?</Link>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-blue-600 active:scale-95 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-primary/20"
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                <LogIn size={20} />
                                <span>SIGN IN</span>
                            </>
                        )}
                    </button>

                    <p className="text-center text-sm text-gray-500">
                        Don't have an account? {' '}
                        <Link to="/register" className="text-primary font-bold hover:underline">Register Now</Link>
                    </p>
                </form>
            </div>

            {/* ReCAPTCHA container for phone login */}
            <div id="recaptcha-container"></div>
        </div>
    );
};

export default LoginPage;
