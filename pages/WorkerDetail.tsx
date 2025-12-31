
import React, { useState, useEffect } from 'react';
import { supabase, safeFetch } from '../lib/supabaseClient';
import { Profile } from '../types';
import { getTierLimit } from '../lib/constants';

interface WorkerDetailProps { profile: Profile | null; workerId: string; onBack: () => void; onBook: (workerId: string) => void; onRefreshProfile?: () => void; onUpgrade: () => void; }

const WorkerDetail: React.FC<WorkerDetailProps> = ({ profile, workerId, onBack, onBook, onRefreshProfile, onUpgrade }) => {
  const [worker, setWorker] = useState<Profile | null>(null);
  const [rating, setRating] = useState<number>(5.0);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]); // New state for reviews
  
  // New: Limit Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    // Fetch Profile
    safeFetch<Profile>(async () => await supabase.from('profiles').select('*').eq('id', workerId).single()).then(({data}) => setWorker(data));
    
    // Fetch Rating Stats & Written Reviews
    const fetchRating = async () => {
        // Get aggregated stats
        const { data: ratingData } = await supabase.from('bookings').select('rating').eq('worker_id', workerId).not('rating', 'is', null);
        if (ratingData && ratingData.length > 0) {
            const total = ratingData.reduce((sum, item) => sum + (item.rating || 0), 0);
            setRating(parseFloat((total / ratingData.length).toFixed(1)));
            setReviewCount(ratingData.length);
        }

        // Get detailed written reviews (Limit to latest 10)
        const { data: reviewsData } = await supabase
            .from('bookings')
            .select('rating, review, created_at, profiles:client_id(full_name, avatar_url)')
            .eq('worker_id', workerId)
            .not('review', 'is', null) // Only where text exists
            .neq('review', '') // Ensure not empty string
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (reviewsData) setReviews(reviewsData);
    };
    fetchRating();
  }, [workerId]);

  const handleBooking = async () => {
    if (!profile) return;

    // Client Limit Check
    if (profile.role === 'client') {
       const limit = getTierLimit(profile.subscription_tier);
       if (profile.task_count >= limit) {
         setShowUpgradeModal(true);
         return;
       }
    }

    const { error } = await safeFetch(async () => await supabase.from('bookings').insert([{ client_id: profile.id, worker_id: workerId, status: 'pending' }]));
    
    if (!error) { 
      // Database Trigger automatically increments client's 'task_count' on insert for Direct Hires.
      if (profile.role === 'client') {
        if (onRefreshProfile) onRefreshProfile();
      }
      alert("Request Sent!"); 
      onBook(workerId); 
    }
  };

  // Limit Modal Component
  const UpgradeModal = () => (
    <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-6 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
          <i className="fa-solid fa-lock text-2xl"></i>
        </div>
        <h3 className="text-xl font-black text-gray-900">Booking Limit Reached</h3>
        <p className="text-sm text-gray-500 font-medium leading-relaxed">
          You've reached the booking limit for your <b>{profile?.subscription_tier}</b> plan. Upgrade now to hire more workers.
        </p>
        <button onClick={onUpgrade} className="w-full bg-brand text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform">
          Upgrade Now
        </button>
        <button onClick={() => setShowUpgradeModal(false)} className="text-gray-400 text-xs font-bold uppercase">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="bg-white min-h-screen pb-24 relative">
      {showUpgradeModal && <UpgradeModal />}

      <div className="relative h-[45vh] bg-gray-900">
        <button onClick={onBack} className="absolute top-6 left-6 z-20 bg-white/20 backdrop-blur-xl text-white p-4 rounded-2xl"><i className="fa-solid fa-chevron-left"></i></button>
        <img src={worker?.avatar_url || `https://picsum.photos/seed/${workerId}/1200/1000`} className="w-full h-full object-cover opacity-80" />
      </div>
      <div className="px-6 -mt-24 relative z-10">
        <img src={worker?.avatar_url} className="w-32 h-32 rounded-[44px] border-[6px] border-white shadow-2xl object-cover" />
        <div className="mt-6 space-y-8">
          <div>
              <div className="flex items-center gap-2 mb-1">
                 <h1 className="text-3xl font-black text-gray-900">{worker?.full_name}</h1>
                 {worker?.is_verified && <i className="fa-solid fa-circle-check text-blue-500 text-xl" title="Verified ID"></i>}
              </div>
              <div className="flex flex-wrap gap-2">
                 <span className="bg-brand-light text-brand px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest">{worker?.category}</span>
                 {worker?.is_verified && <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><i className="fa-solid fa-shield"></i> ID Verified</span>}
              </div>
          </div>
          <div className="grid grid-cols-3 gap-1 py-8 border-y border-gray-100">
            <div className="text-center"><p className="text-[9px] text-gray-400 font-black uppercase">Starting</p><p className="font-black text-gray-900 text-xl">₦{worker?.starting_price}</p></div>
            <div className="text-center"><p className="text-[9px] text-gray-400 font-black uppercase">Rating</p><p className="font-black text-gray-900 text-xl flex items-center justify-center gap-1">{rating} <i className="fa-solid fa-star text-xs text-yellow-400"></i></p></div>
            <div className="text-center"><p className="text-[9px] text-gray-400 font-black uppercase">Jobs</p><p className="font-black text-green-500 text-xl">{reviewCount} Done</p></div>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed font-medium">{worker?.bio || `Professional ${worker?.subcategory} available in ${worker?.address}.`}</p>
          
          {/* Reviews Section */}
          <div className="space-y-4">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Recent Reviews</h3>
              {reviews.length === 0 ? (
                  <div className="bg-gray-50 p-4 rounded-2xl text-center text-xs text-gray-400 font-medium italic">No written reviews yet.</div>
              ) : (
                  reviews.map((r, i) => (
                      <div key={i} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                          <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">
                                      {r.profiles?.avatar_url ? <img src={r.profiles.avatar_url} className="w-full h-full object-cover"/> : <i className="fa-solid fa-user text-gray-400 text-xs p-1"></i>}
                                  </div>
                                  <span className="text-xs font-bold text-gray-800">{r.profiles?.full_name || 'Client'}</span>
                              </div>
                              <div className="flex text-yellow-400 text-[10px] gap-0.5">
                                  {Array(Math.round(r.rating || 5)).fill(0).map((_, idx) => <i key={idx} className="fa-solid fa-star"></i>)}
                              </div>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">"{r.review}"</p>
                          <p className="text-[9px] text-gray-400 font-bold mt-2 text-right">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                  ))
              )}
          </div>

          {profile?.role === 'client' && <button onClick={handleBooking} className="w-full bg-brand text-white py-5 rounded-[28px] font-black shadow-2xl uppercase tracking-widest">INITIATE BOOKING</button>}
        </div>
      </div>
    </div>
  );
};
export default WorkerDetail;
