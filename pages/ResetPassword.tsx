import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { VelgoLogo } from '../components/Brand';

const ResetPassword: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) onSuccess();
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-white">
      <VelgoLogo className="h-12 mb-4" /><h2 className="text-xl font-black">New Password</h2>
      <form className="mt-8 space-y-4 w-full max-w-sm" onSubmit={handleUpdate}>
        <div className="relative">
             <input 
                type={showPassword ? "text" : "password"} 
                required 
                className="block w-full px-4 py-4 bg-white border rounded-2xl pr-12 outline-none focus:border-brand" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="New Password" 
             />
             <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"><i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
        </div>
        <button type="submit" disabled={loading} className="w-full py-5 rounded-[24px] bg-brand text-white font-black">{loading ? 'Saving...' : 'Update'}</button>
      </form>
    </div>
  );
};
export default ResetPassword;