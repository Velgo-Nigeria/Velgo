import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { VelgoLogo } from '../components/Brand';

interface LoginProps {
  onToggle: () => void;
}

const Login: React.FC<LoginProps> = ({ onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [isResetting, setIsResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          setError('Please verify your email address before logging in.');
        } else if (error.message.includes('Invalid login credentials')) {
          setError('Incorrect email or password.');
        } else {
          setError(error.message);
        }
      }
      // Success is handled by App.tsx subscription
    } catch (err: any) {
      setError('Network connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset Password View
  if (isResetting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-white animate-fadeIn">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <VelgoLogo className="h-10 mx-auto mb-4" />
            <h2 className="text-xl font-black text-gray-900">Reset Password</h2>
          </div>

          {resetSent ? (
            <div className="bg-green-50 p-6 rounded-[24px] text-center">
              <i className="fa-solid fa-check-circle text-3xl text-green-600 mb-2"></i>
              <p className="text-sm text-gray-700 font-bold">Recovery link sent to {email}</p>
              <button onClick={() => { setIsResetting(false); setResetSent(false); }} className="mt-4 text-xs font-black text-brand uppercase">Back to Login</button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-500 text-xs rounded-xl font-bold">{error}</div>}
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl text-sm font-bold outline-none border border-gray-100" placeholder="Enter your email" />
              <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white py-5 rounded-[24px] font-black uppercase text-xs tracking-widest">{loading ? 'Sending...' : 'Send Link'}</button>
              <button type="button" onClick={() => setIsResetting(false)} className="w-full py-4 text-xs font-bold text-gray-400 uppercase">Cancel</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-white animate-fadeIn">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <VelgoLogo className="h-12 mx-auto mb-6" />
          <h1 className="text-2xl font-black text-gray-900">Welcome Back</h1>
          <p className="text-sm text-gray-500 font-medium mt-2">Sign in to your account.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && <div className="p-4 bg-red-50 text-red-500 text-xs font-bold rounded-2xl border border-red-100 flex items-start gap-2"><i className="fa-solid fa-circle-exclamation mt-0.5"></i> <span>{error}</span></div>}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all"
              placeholder="e.g. name@example.com"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Password</label>
              <button type="button" onClick={() => setIsResetting(true)} className="text-[10px] font-black text-brand uppercase tracking-widest">Forgot?</button>
            </div>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-brand text-white py-5 rounded-[24px] font-black uppercase text-sm shadow-xl shadow-brand/20 active:scale-95 transition-transform disabled:opacity-70 disabled:scale-100"
          >
            {loading ? 'Verifying...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center pt-4">
          <p className="text-xs text-gray-500 font-medium">
            New to Velgo? <button onClick={onToggle} className="text-brand font-black uppercase ml-1">Create Account</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;