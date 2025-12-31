
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserRole, ClientType } from '../types';
import { VelgoLogo } from '../components/Brand';

interface SignUpProps {
  onToggle: () => void;
  initialRole?: UserRole;
}

const SignUp: React.FC<SignUpProps> = ({ onToggle, initialRole = 'client' }) => {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [clientType, setClientType] = useState<ClientType>('personal');
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => { setRole(initialRole); }, [initialRole]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Frontend Validation
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (!phone.trim() || phone.length < 10) { setError("Please enter a valid phone number."); return; }

    setLoading(true);

    // 2. Prepare Minimal Metadata
    // We only send full_name to prevent database triggers from crashing on complex fields like 'client_type'
    // The rest of the data is saved manually below or via CompleteProfile page.
    const metaData = {
      full_name: fullName.trim(),
    };

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: metaData, 
          emailRedirectTo: window.location.origin
        }
      });

      if (authError) {
        if (authError.message.includes("unique constraint") || authError.message.includes("already registered")) {
            setError("This email address is already in use. Please log in.");
        } else if (authError.message.includes("Database error")) {
            // Friendly message for the specific trigger error
            setError("System is updating. Please try again or use the 'Complete Profile' screen after login.");
        } else {
            setError(authError.message);
        }
      } else {
        if (data.session) {
            // 3. Auto-logged in? Manually update the profile details now.
            // This ensures role/phone are saved even if the trigger skipped them.
            const { error: updateError } = await supabase.from('profiles').update({
                role: role,
                phone_number: phone.trim(),
                client_type: role === 'client' ? clientType : 'personal',
                avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName.trim())}&background=008000&color=fff`
            }).eq('id', data.session.user.id);
            
            if (updateError) {
               console.error("Manual profile update failed", updateError);
               // We don't block here; App.tsx will detect missing role and show CompleteProfile
            }
        } else if (data.user && !data.session) {
            alert("Account created successfully! Please check your email to confirm your account.");
            onToggle();
        }
      }
    } catch (err: any) {
      setError("Network error. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-white py-12 animate-fadeIn">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-between">
            <button onClick={onToggle} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors"><i className="fa-solid fa-chevron-left"></i></button>
            <VelgoLogo className="h-8" />
            <div className="w-10"></div>
        </div>

        <div className="text-center">
            <h1 className="text-2xl font-black text-gray-900">Create Account</h1>
            <p className="text-sm text-gray-500 font-medium mt-1">Join Nigeria's fastest gig marketplace.</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          {error && <div className="p-4 bg-red-50 text-red-500 text-xs font-bold rounded-2xl border border-red-100 flex items-start gap-2"><i className="fa-solid fa-circle-exclamation mt-0.5"></i> <span>{error}</span></div>}

          {/* Role Selection */}
          <div className="bg-gray-50 p-1.5 rounded-2xl border border-gray-100 grid grid-cols-2 gap-2">
             <button type="button" onClick={() => setRole('client')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${role === 'client' ? 'bg-white text-brand shadow-sm scale-[1.02]' : 'text-gray-400 hover:text-gray-600'}`}>Hire Help</button>
             <button type="button" onClick={() => setRole('worker')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${role === 'worker' ? 'bg-white text-brand shadow-sm scale-[1.02]' : 'text-gray-400 hover:text-gray-600'}`}>Earn Money</button>
          </div>

          {/* Client Type (Only for Clients) */}
          {role === 'client' && (
             <div className="flex justify-center gap-6 py-1 animate-fadeIn">
                 <label className="flex items-center gap-2 cursor-pointer opacity-80 hover:opacity-100">
                     <input type="radio" checked={clientType === 'personal'} onChange={() => setClientType('personal')} className="accent-brand" />
                     <span className="text-xs font-bold text-gray-700">Personal</span>
                 </label>
                 <label className="flex items-center gap-2 cursor-pointer opacity-80 hover:opacity-100">
                     <input type="radio" checked={clientType === 'enterprise'} onChange={() => setClientType('enterprise')} className="accent-brand" />
                     <span className="text-xs font-bold text-gray-700">Business</span>
                 </label>
             </div>
          )}

          {/* Inputs */}
          <input 
            type="text" 
            required
            value={fullName} 
            onChange={e => setFullName(e.target.value)} 
            placeholder={role === 'client' && clientType === 'enterprise' ? "Business Name" : "Full Name"}
            className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all"
          />
          
          <input 
            type="tel" 
            required
            value={phone} 
            onChange={e => setPhone(e.target.value)} 
            placeholder="Phone Number (e.g. 08012345678)"
            className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all"
          />

          <input 
            type="email" 
            required
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="Email Address"
            className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all"
          />

          <div className="relative">
             <input 
                type={showPassword ? "text" : "password"} 
                required
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Password (Min 6 chars)"
                className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all pr-12"
             />
             <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"><i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
          </div>

          <div className="relative">
             <input 
                type={showConfirmPassword ? "text" : "password"} 
                required
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                placeholder="Confirm Password"
                className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all pr-12"
             />
             <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"><i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-brand text-white py-5 rounded-[24px] font-black uppercase text-sm shadow-xl shadow-brand/20 active:scale-95 transition-transform disabled:opacity-70 disabled:scale-100"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-400 font-bold px-4">
            By signing up, you agree to our <button className="underline">Terms</button> & <button className="underline">Privacy Policy</button>.
        </p>
      </div>
    </div>
  );
};

export default SignUp;
