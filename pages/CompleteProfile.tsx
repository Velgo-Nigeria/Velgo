
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserRole, ClientType } from '../types';
import { VelgoLogo } from '../components/Brand';

interface CompleteProfileProps {
  session: any;
  onComplete: () => void;
}

const CompleteProfile: React.FC<CompleteProfileProps> = ({ session, onComplete }) => {
  const [role, setRole] = useState<UserRole>('client');
  const [clientType, setClientType] = useState<ClientType>('personal');
  const [fullName, setFullName] = useState(session.user.user_metadata.full_name || '');
  const [phone, setPhone] = useState(session.user.user_metadata.phone_number || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // UPSERT ensures that if the profile is missing (trigger failed), we create it.
    // If it exists (trigger worked but data missing), we update it.
    const updates = {
      id: session.user.id,
      email: session.user.email,
      full_name: fullName.trim(),
      phone_number: phone.trim(),
      role: role,
      client_type: role === 'client' ? clientType : 'personal',
      subscription_tier: 'basic',
      is_verified: false,
      task_count: 0,
      avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName.trim())}&background=008000&color=fff`,
      updated_at: new Date().toISOString(),
    };

    // Note: We ignore "duplicate key" errors if they happen on non-primary keys, 
    // but here ID is primary key, so Upsert handles it gracefully.
    const { error } = await supabase.from('profiles').upsert(updates);

    if (error) {
      console.error("Complete Profile Error:", error);
      setError("Failed to save profile. Please try again.");
      setLoading(false);
    } else {
      // Force refresh of the profile in App.tsx
      onComplete();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-white animate-fadeIn">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <VelgoLogo className="h-10 mx-auto mb-4" />
          <h2 className="text-xl font-black text-gray-900">Finish Setup</h2>
          <p className="text-sm text-gray-500 mt-2">We just need a few details to complete your registration.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-4 bg-red-50 text-red-500 text-xs rounded-2xl font-bold flex items-center gap-2"><i className="fa-solid fa-circle-exclamation"></i>{error}</div>}

          <div className="bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRole('client')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${role === 'client' ? 'bg-white text-brand shadow-sm' : 'text-gray-400'}`}>Hire Help</button>
              <button type="button" onClick={() => setRole('worker')} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${role === 'worker' ? 'bg-white text-brand shadow-sm' : 'text-gray-400'}`}>Earn Money</button>
            </div>
          </div>

          {role === 'client' && (
            <div className="flex gap-4 px-2 animate-fadeIn">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${clientType === 'personal' ? 'border-brand' : 'border-gray-300'}`}>
                  {clientType === 'personal' && <div className="w-2 h-2 rounded-full bg-brand" />}
                </div>
                <input type="radio" className="hidden" checked={clientType === 'personal'} onChange={() => setClientType('personal')} />
                <span className={`text-xs font-bold transition-colors ${clientType === 'personal' ? 'text-gray-900' : 'text-gray-400'}`}>Personal</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${clientType === 'enterprise' ? 'border-brand' : 'border-gray-300'}`}>
                  {clientType === 'enterprise' && <div className="w-2 h-2 rounded-full bg-brand" />}
                </div>
                <input type="radio" className="hidden" checked={clientType === 'enterprise'} onChange={() => setClientType('enterprise')} />
                <span className={`text-xs font-bold transition-colors ${clientType === 'enterprise' ? 'text-gray-900' : 'text-gray-400'}`}>Enterprise / Business</span>
              </label>
            </div>
          )}

          <input type="text" required className="block w-full px-4 py-4 bg-white border rounded-2xl outline-none text-sm font-bold focus:border-brand transition-all" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={clientType === 'enterprise' && role === 'client' ? "Business Name" : "Full Name"} />
          <input type="tel" required className="block w-full px-4 py-4 bg-white border rounded-2xl outline-none text-sm font-bold focus:border-brand transition-all" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone Number" />

          <button type="submit" disabled={loading} className="w-full py-5 rounded-[24px] bg-brand text-white font-black uppercase text-sm shadow-xl">{loading ? 'Saving...' : 'Enter App'}</button>
          
          <button type="button" onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }} className="w-full text-center text-gray-400 font-bold text-xs uppercase mt-4">Cancel / Sign Out</button>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfile;
