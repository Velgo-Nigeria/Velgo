
import React, { useCallback, useState } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { supabase } from '../lib/supabaseClient';
import { Profile, SubscriptionTier } from '../lib/types';
import { TIERS } from '../lib/constants';
import { openWhatsAppHelper } from '../lib/whatsapp';

interface SubscriptionProps { profile: Profile | null; sessionEmail?: string; onRefreshProfile: () => void; onBack: () => void; }

const VELGO_BANK = {
    bankName: "Moniepoint MFB",
    accountNumber: "9167799600",
    accountName: "Velgo Nigeria Operations",
    supportPhone: "2349167799600"
};

const SubscriptionCard: React.FC<{ 
  tier: typeof TIERS[0]; 
  isActive: boolean; 
  email: string; 
  publicKey: string; 
  onSuccess: (tier: SubscriptionTier, reference?: string) => void;
  onManualPay: (tier: typeof TIERS[0]) => void;
  discountPercent?: number;
  isVerifying?: boolean;
}> = ({ tier, isActive, email, publicKey, onSuccess, onManualPay, discountPercent = 0, isVerifying = false }) => {
  
  const originalPrice = tier.price || 0;
  const finalPrice = discountPercent > 0 
    ? Math.max(0, Math.round(originalPrice * (1 - discountPercent / 100)))
    : originalPrice;

  const config = {
    reference: `VELGO_${tier.id.toUpperCase()}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    email: email,
    amount: finalPrice * 100,
    publicKey: publicKey.trim(),
  };

  const initializePayment = usePaystackPayment(config);

  const handlePaystack = () => {
    if (finalPrice === 0) {
      onSuccess(tier.id);
    } else {
      try {
        (initializePayment as any)(
          (paystackResponse: any) => {
            const ref = paystackResponse?.reference || paystackResponse?.trxref || config.reference;
            onSuccess(tier.id, ref);
          },
          () => console.log("Payment closed")
        );
      } catch (err) {
        alert("Payment initialization error. Please try the 'Bank Transfer' option.");
      }
    }
  };

  return (
    <div className={`p-6 rounded-[32px] border ${isActive ? 'border-brand bg-brand/5 dark:bg-brand/10' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'} shadow-sm space-y-4 relative overflow-hidden transition-all duration-300 flex flex-col group`}>
      
      {/* Holographic Watermark */}
      <img 
          src="https://mrnypajnlltkuitfzgkh.supabase.co/storage/v1/object/public/branding/velgo-app-icon.png"
          className="absolute -right-6 -bottom-6 w-32 h-32 opacity-[0.08] -rotate-12 pointer-events-none group-hover:scale-110 transition-transform duration-500"
          alt=""
      />
      
      <div className="flex justify-between items-start relative z-10">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-400">{tier.name}</span>
          {discountPercent > 0 ? (
            <div className="pt-1">
              <div className="flex items-center gap-1.5">
                <span className="line-through text-xs text-red-500 font-bold">₦{originalPrice.toLocaleString()}</span>
                <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wider">-{discountPercent}% OFF</span>
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white">₦{finalPrice.toLocaleString()}</h3>
            </div>
          ) : (
            <h3 className="text-2xl font-black pt-1 text-gray-900 dark:text-white">₦{originalPrice.toLocaleString()}</h3>
          )}
        </div>
      </div>

      <ul className="space-y-2 flex-1 relative z-10">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
            <i className="fa-solid fa-check text-brand text-[10px]"></i> {f}
          </li>
        ))}
      </ul>

      <div className="space-y-2 mt-4 relative z-10">
          <button 
            type="button"
            disabled={isVerifying}
            onClick={handlePaystack}
            className="w-full py-4 rounded-2xl font-black uppercase text-[10px] transition-all bg-brand text-white shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <i className="fa-solid fa-spinner animate-spin"></i> Verifying Payment...
              </>
            ) : (
              'Pay with Card'
            )}
          </button>
          
          {tier.price > 0 && (
             <button 
                type="button"
                disabled={isVerifying}
                onClick={() => onManualPay(tier)}
                className="w-full py-3 rounded-2xl font-black uppercase text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all disabled:opacity-50"
             >
                Pay via Transfer
             </button>
          )}
      </div>
    </div>
  );
};

const Subscription: React.FC<SubscriptionProps> = ({ profile, sessionEmail, onRefreshProfile, onBack }) => {
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [selectedTier, setSelectedTier] = useState<typeof TIERS[0] | null>(null);

  // Promo Code entry and state
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [appliedPromo, setAppliedPromo] = useState<any | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [validatingPromo, setValidatingPromo] = useState<boolean>(false);
  const [verifyingPayment, setVerifyingPayment] = useState<boolean>(false);

  const handleApplyPromo = async () => {
    if (!profile?.id) return;
    if (!promoCodeInput.trim()) {
      setPromoError("Please enter a promo code.");
      return;
    }

    try {
      setPromoError(null);
      setValidatingPromo(true);
      
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', promoCodeInput.trim().toUpperCase())
        .eq('user_id', profile.id)
        .eq('is_used', false)
        .single();
      
      if (error || !data) {
        setPromoError("Invalid, already used, or expired promo code.");
        setAppliedPromo(null);
      } else {
        setAppliedPromo(data);
        setPromoCodeInput('');
      }
    } catch (err: any) {
      setPromoError("Unable to validate code: " + err.message);
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoError(null);
  };

  const onSuccess = useCallback(async (tier: SubscriptionTier, reference?: string) => {
    if (!profile) return;

    // 1. If a payment reference exists, verify with serverless Paystack API
    if (reference) {
      try {
        setVerifyingPayment(true);
        const res = await fetch('/api/verify-paystack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: reference,
            tier: tier,
            promoCode: appliedPromo?.code || null,
            userId: profile.id
          })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Payment verification could not be confirmed.');
        }

        onRefreshProfile();
        onBack();
        return;
      } catch (err: any) {
        console.error('Server verification notice:', err);
        alert(`Payment notice: ${err.message || 'Payment confirmed by gateway, but account update is syncing. Please refresh in a moment.'}`);
        onRefreshProfile();
        onBack();
        return;
      } finally {
        setVerifyingPayment(false);
      }
    }

    // 2. Free tier / Zero amount fallback
    const addedTokens = TIERS.find(t => t.id === tier)?.limit || 0;

    await supabase.from('profiles').update({ 
      subscription_tier: tier, 
      is_verified: true
    }).eq('id', profile.id);

    if (appliedPromo) {
      await supabase
        .from('promo_codes')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('code', appliedPromo.code);
    }

    onRefreshProfile(); 
    onBack();
  }, [profile, onRefreshProfile, onBack, appliedPromo]);

  const handleManualPayClick = (tier: typeof TIERS[0]) => {
      setSelectedTier(tier);
      setShowManualModal(true);
  };

  const handleWhatsAppConfirmation = () => {
      if (!selectedTier || !profile) return;
      
      const discountPercent = appliedPromo ? appliedPromo.discount_percent : 0;
      const originalPrice = selectedTier.price || 0;
      const finalPrice = discountPercent > 0 
        ? Math.max(0, Math.round(originalPrice * (1 - discountPercent / 100)))
        : originalPrice;

      const promoText = appliedPromo ? ` (applied Promo Code ${appliedPromo.code} for ${appliedPromo.discount_percent}% off)` : '';
      const message = `Hello Velgo Admin, I have just transferred ₦${finalPrice.toLocaleString()} for the ${selectedTier.name} Plan${promoText}.\n\nMy Email: ${profile.email}\nMy Name: ${profile.full_name}`;
      
      // 1. WhatsApp redirection synchronously
      openWhatsAppHelper(message, VELGO_BANK.supportPhone);
      
      // 2. Log manual payment request in support_messages
      const richLog = `💳 Requested Manual Payment Confirmation via WhatsApp.\nPlan: ${selectedTier.name} Plan\nAmount: ₦${finalPrice.toLocaleString()}${promoText}\nUser Name: ${profile.full_name}\nEmail: ${profile.email}`;
      supabase.from('support_messages').insert([{
          user_id: profile.id,
          content: richLog,
          message: richLog,
          status: 'open',
          admin_reply: false
      }]).then(async ({ error }) => {
          if (error) {
            console.error("Database log of manual payment failed:", error.message);
          } else {
            if (appliedPromo) {
              await supabase
                .from('promo_codes')
                .update({ is_used: true, used_at: new Date().toISOString() })
                .eq('code', appliedPromo.code);
            }
          }
      });
  };

  const publicKey = (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || 'pk_live_4a7ebac9ce2a757e1209a5e52df541161b509981';
  const userEmail = sessionEmail || (profile?.email) || (profile?.id ? `${profile.id}@velgo.ng` : 'guest@velgo.ng');

  return (
    <div className="p-4 space-y-6 pb-24 bg-white dark:bg-gray-900 min-h-screen transition-colors duration-200">
      
      {showManualModal && selectedTier && (() => {
          const manualOriginalPrice = selectedTier.price || 0;
          const manualFinalPrice = appliedPromo 
            ? Math.max(0, Math.round(manualOriginalPrice * (1 - appliedPromo.discount_percent / 100)))
            : manualOriginalPrice;
          
          return (
            <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 backdrop-blur-md animate-fadeIn">
                <div className="bg-white dark:bg-gray-800 rounded-[32px] p-6 w-full max-w-sm space-y-6 text-center border border-gray-100 dark:border-gray-700">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto text-gray-900 dark:text-white text-2xl">
                        <i className="fa-solid fa-building-columns"></i>
                    </div>
                    
                    <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase">Bank Transfer</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            Transfer <span className="text-brand font-black">₦{manualFinalPrice.toLocaleString()}</span> to the account below.
                        </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl space-y-1 border border-dashed border-gray-300 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{VELGO_BANK.bankName}</p>
                        <div className="flex items-center justify-center gap-2">
                          <p className="text-2xl font-black text-gray-900 dark:text-white tracking-widest">{VELGO_BANK.accountNumber}</p>
                          <button onClick={() => navigator.clipboard.writeText(VELGO_BANK.accountNumber)} className="text-brand"><i className="fa-regular fa-copy"></i></button>
                        </div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white uppercase">{VELGO_BANK.accountName}</p>
                    </div>

                    <div className="space-y-3">
                        <button 
                            onClick={handleWhatsAppConfirmation}
                            className="w-full bg-green-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 active:scale-95 transition-transform"
                        >
                            <i className="fa-brands fa-whatsapp text-lg"></i> Confirm Payment
                        </button>
                        <button onClick={() => setShowManualModal(false)} className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase">Cancel</button>
                    </div>
                </div>
            </div>
          );
      })()}

      <div className="flex items-center gap-4 py-4">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-chevron-left text-gray-500 dark:text-gray-400"></i>
        </button>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Choose Plan</h1>
      </div>

      {/* Promo Code Redemption Entry Form */}
      <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-[30px] border border-gray-150 dark:border-gray-800 space-y-4">
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5 leading-none">
            <i className="fa-solid fa-ticket text-indigo-500"></i> Got a milestone Promo Code?
          </h3>
          <p className="text-[9px] text-gray-450 dark:text-gray-500 uppercase font-black tracking-wider mt-1.5">
            Input copy-pasted discount code from your My Hub referral chest below
          </p>
        </div>

        {appliedPromo ? (
          <div className="flex items-center justify-between bg-emerald-500/5 dark:bg-emerald-950/10 p-4 rounded-2xl border border-emerald-500/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <i className="fa-solid fa-circle-check text-emerald-500 text-sm"></i>
              <div className="min-w-0">
                <p className="text-xs font-black text-gray-900 dark:text-white truncate">Promo Applied: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-extrabold">{appliedPromo.code}</span></p>
                <p className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-bold uppercase mt-0.5">{appliedPromo.discount_percent}% Subscription Discount Locked!</p>
              </div>
            </div>
            <button
              onClick={handleRemovePromo}
              className="text-[9px] uppercase font-black tracking-widest text-red-500 hover:opacity-85"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={promoCodeInput}
                onChange={(e) => { setPromoCodeInput(e.target.value); setPromoError(null); }}
                placeholder="VELGO-REF3-XXXX"
                className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none text-xs font-bold tracking-wider font-mono dark:text-white uppercase"
              />
              <button
                type="button"
                disabled={validatingPromo}
                onClick={handleApplyPromo}
                className="bg-brand text-white text-[9.5px] font-black uppercase tracking-wider px-5 rounded-xl transition-all shadow active:scale-95 disabled:opacity-50"
              >
                {validatingPromo ? "Checking..." : "Apply"}
              </button>
            </div>
            {promoError && (
              <p className="text-[9.5px] text-red-500 font-bold uppercase flex items-center gap-1">
                <i className="fa-solid fa-triangle-exclamation"></i> {promoError}
              </p>
            )}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TIERS.map(t => (
            <SubscriptionCard 
                key={t.id}
                tier={t}
                isActive={profile?.subscription_tier === t.id}
                email={userEmail}
                publicKey={publicKey}
                onSuccess={onSuccess}
                onManualPay={handleManualPayClick}
                discountPercent={appliedPromo ? appliedPromo.discount_percent : 0}
                isVerifying={verifyingPayment}
            />
        ))}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-center transition-colors">
          <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Secure Payment</p>
          <div className="flex justify-center gap-2 text-gray-300 dark:text-gray-600 text-xl">
              <i className="fa-brands fa-cc-visa"></i>
              <i className="fa-brands fa-cc-mastercard"></i>
              <i className="fa-solid fa-lock"></i>
          </div>
      </div>
    </div>
  );
};

export default Subscription;
