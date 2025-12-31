import React, { useCallback } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { supabase } from '../lib/supabaseClient';
import { Profile, SubscriptionTier } from '../types';
import { TIERS } from '../lib/constants';

interface SubscriptionProps { profile: Profile | null; sessionEmail?: string; onRefreshProfile: () => void; onBack: () => void; }

const Subscription: React.FC<SubscriptionProps> = ({ profile, sessionEmail, onRefreshProfile, onBack }) => {
  const onSuccess = useCallback(async (tier: SubscriptionTier) => {
    if (!profile) return;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30 Days

    await supabase.from('profiles').update({ 
      subscription_tier: tier, 
      is_verified: true,
      task_count: 0, // Reset counter
      subscription_end_date: endDate.toISOString()
    }).eq('id', profile.id);
    
    onRefreshProfile(); 
    onBack();
  }, [profile, onRefreshProfile, onBack]);

  // Use Env Var or Fallback to the Live Key provided
  // Note: We ONLY use the Public Key on the frontend. The Secret Key must never be exposed here.
  const publicKey = (typeof process !== 'undefined' && process.env.VITE_PAYSTACK_PUBLIC_KEY) 
    ? process.env.VITE_PAYSTACK_PUBLIC_KEY 
    : 'pk_live_4a7ebac9ce2a757e1209a5e52df541161b509981';

  const config = (tier: any) => ({ 
    reference: (new Date()).getTime().toString(), 
    email: sessionEmail || (profile?.id + "@velgo.ng"), 
    amount: tier.price * 100, 
    publicKey: publicKey
  });
  
  return (
    <div className="p-4 space-y-6 pb-24 bg-white min-h-screen">
      <div className="flex items-center gap-4 py-4"><button onClick={onBack}><i className="fa-solid fa-chevron-left"></i></button><h1 className="text-2xl font-black">Choose Plan</h1></div>
      
      {TIERS.map(t => {
        const initializePayment = usePaystackPayment(config(t));
        const isActive = profile?.subscription_tier === t.id;
        
        return (
          <div key={t.id} className={`p-6 rounded-[32px] border ${isActive ? 'border-brand bg-brand/5' : 'border-gray-100 bg-white'} shadow-sm space-y-4 relative overflow-hidden`}>
            {isActive && <div className="absolute top-0 right-0 bg-brand text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl">Current Plan</div>}
            
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t.name}</span>
                <h3 className="text-2xl font-black pt-1">₦{t.price.toLocaleString()} <span className="text-sm font-medium text-gray-400">/mo</span></h3>
              </div>
            </div>

            <ul className="space-y-2">
              {t.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs font-bold text-gray-600">
                  <i className="fa-solid fa-check text-brand text-[10px]"></i> {f}
                </li>
              ))}
            </ul>

            <button 
              onClick={() => { 
                if (isActive) return;
                if (t.price === 0) onSuccess('basic'); 
                else initializePayment({ onSuccess: () => onSuccess(t.id), onClose: () => {} }) 
              }} 
              className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] transition-all ${isActive ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-brand text-white shadow-lg active:scale-95'}`}
            >
              {isActive ? 'Active Plan' : (t.price === 0 ? 'Downgrade to Basic' : 'Upgrade Now')}
            </button>
          </div>
        );
      })}
    </div>
  );
};
export default Subscription;