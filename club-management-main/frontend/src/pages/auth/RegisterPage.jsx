import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Phone, GraduationCap, Building2, UserPlus, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { registerUser } from '../../services/authService';
import { DEPARTMENTS, YEARS } from '../../utils/constants';
import toast from 'react-hot-toast';

const RegisterPage = () => {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        username: '',
        name: '',
        registerNumber: '',
        year: YEARS[0],
        department: DEPARTMENTS[0],
        collegeEmail: '',
        personalEmail: '',
        phoneNumber: '',
        password: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (step < 3) {
            setStep(prev => prev + 1);
            return;
        }

        setIsLoading(true);
        try {
            await registerUser({
                ...formData,
                email: formData.collegeEmail || formData.personalEmail,
            });
            toast.success('Account created successfully!');
            navigate('/');
        } catch (error) {
            toast.error(error.message || 'Failed to register');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[120px]"></div>
            </div>

            <div className="w-full max-w-xl relative animate-fade-in">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 border border-primary/20">
                        <span className="text-3xl font-black italic text-primary">M</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white italic">
                        MIT <span className="text-primary">CLUB HUB</span>
                    </h1>
                    <p className="text-gray-500 text-sm mt-2 uppercase tracking-widest">Join the Student Nexus</p>
                </div>

                {/* Multi-step progress bar */}
                <div className="flex gap-2 mb-6 px-4">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s <= step ? 'bg-primary' : 'bg-white/5'
                                }`}
                        ></div>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="glass p-8 md:p-10 rounded-3xl space-y-6">
                    {step === 1 && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <User size={20} className="text-primary" />
                                Personal Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputGroup label="Full Name" name="name" icon={<User size={18} />} placeholder="Akash R" value={formData.name} onChange={handleChange} />
                                <InputGroup label="Username" name="username" icon={<UserIcon size={18} />} placeholder="akash_nexus" value={formData.username} onChange={handleChange} />
                                <InputGroup label="Register Number" name="registerNumber" icon={<GraduationCap size={18} />} placeholder="2021XXXXXX" value={formData.registerNumber} onChange={handleChange} />
                                <InputGroup label="Phone Number" name="phoneNumber" icon={<Phone size={18} />} placeholder="+91 XXXXX XXXXX" value={formData.phoneNumber} onChange={handleChange} />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Building2 size={20} className="text-primary" />
                                Academic Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Department</label>
                                    <select
                                        name="department"
                                        className="w-full bg-black/40 border border-white/5 focus:border-primary rounded-xl py-3.5 px-4 text-white outline-none transition-all appearance-none"
                                        value={formData.department}
                                        onChange={handleChange}
                                    >
                                        {DEPARTMENTS.map(dept => <option key={dept} value={dept} className="bg-[#111]">{dept}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2 col-span-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Year of Study</label>
                                    <select
                                        name="year"
                                        className="w-full bg-black/40 border border-white/5 focus:border-primary rounded-xl py-3.5 px-4 text-white outline-none transition-all appearance-none"
                                        value={formData.year}
                                        onChange={handleChange}
                                    >
                                        {YEARS.map(yr => <option key={yr} value={yr} className="bg-[#111]">{yr}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-full">
                                    <InputGroup label="College (Default: MIT)" value="Madras Institute of Technology" disabled={true} icon={<Building2 size={18} />} />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Lock size={20} className="text-primary" />
                                Account Security
                            </h3>
                            <div className="space-y-4">
                                <InputGroup label="College Email ID" name="collegeEmail" icon={<Mail size={18} />} placeholder="xxxx@mitindia.edu" value={formData.collegeEmail} onChange={handleChange} />
                                <InputGroup label="Personal Email ID" name="personalEmail" icon={<Mail size={18} />} placeholder="you@gmail.com" value={formData.personalEmail} onChange={handleChange} />
                                <InputGroup label="Password" name="password" type="password" icon={<Lock size={18} />} placeholder="••••••••" value={formData.password} onChange={handleChange} />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4 pt-4">
                        {step > 1 && (
                            <button
                                type="button"
                                onClick={() => setStep(prev => prev - 1)}
                                className="flex-1 border border-white/5 hover:bg-white/5 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all"
                            >
                                <ChevronLeft size={20} />
                                BACK
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-[2] bg-primary hover:bg-blue-600 active:scale-95 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-primary/20"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <span>{step === 3 ? 'CREATE ACCOUNT' : 'CONTINUE'}</span>
                                    <ChevronRight size={20} />
                                </>
                            )}
                        </button>
                    </div>

                    <p className="text-center text-sm text-gray-500">
                        Already have an account? {' '}
                        <Link to="/login" className="text-primary font-bold hover:underline">Sign In</Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

const InputGroup = ({ label, name, icon, type = 'text', placeholder, value, onChange, disabled }) => (
    <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">{label}</label>
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors">
                {icon}
            </div>
            <input
                name={name}
                type={type}
                required={!disabled}
                disabled={disabled}
                placeholder={placeholder}
                className={`w-full bg-black/40 border border-white/5 focus:border-primary rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-700 outline-none transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                value={value}
                onChange={onChange}
            />
        </div>
    </div>
);

const UserIcon = ({ size }) => <User size={size} />;

export default RegisterPage;
