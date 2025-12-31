import React, { useState, useEffect, useCallback } from 'react';
import { supabase, safeFetch } from '../lib/supabaseClient';
import { Profile, PostedTask } from '../types';
import { GoogleGenAI } from "@google/genai";
import { VelgoLogo } from '../components/Brand';
import { CATEGORY_MAP, getTierLimit } from '../lib/constants';
import { NIGERIA_STATES, NIGERIA_LGAS } from '../lib/locations';

const Home: React.FC<{ profile: Profile | null, onViewWorker: (id: string) => void, onViewTask: (id: string) => void, onRefreshProfile: () => void, onUpgrade: () => void, onPostTask: () => void, onShowGuide: () => void }> = ({ profile, onViewWorker, onViewTask, onRefreshProfile, onUpgrade, onPostTask, onShowGuide }) => {
  const [items, setItems] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  
  // Location States
  const [selectedState, setSelectedState] = useState('All Nigeria');
  const [selectedLGA, setSelectedLGA] = useState('');
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  
  // Worker View Mode
  const [workerViewMode, setWorkerViewMode] = useState<'jobs' | 'market'>('jobs');
  
  // Application & Bidding State
  const [myApplications, setMyApplications] = useState<Set<string>>(new Set());
  const [applyingTask, setApplyingTask] = useState<any | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  
  // Modals
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  
  const [clientRatings, setClientRatings] = useState<Record<string, number>>({});
  const [workerRatings, setWorkerRatings] = useState<Record<string, {avg: number, count: number}>>({});

  useEffect(() => {
      // Try to get GPS for distance sorting
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
              (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
              () => {} // Fail silently
          );
      }
  }, []);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setItems([]);

    const isFetchingWorkers = profile.role === 'client' || (profile.role === 'worker' && workerViewMode === 'market');

    if (isFetchingWorkers) {
        let query = supabase.from('profiles').select('*').eq('role', 'worker');
        if (profile.role === 'worker') query = query.neq('id', profile.id);
        if (category !== 'All') query = query.eq('category', category);
        const { data } = await safeFetch<Profile[]>(async () => await query.limit(50));
        
        let workers = data || [];
        // Sort by distance if GPS available
        if (userLat && userLng) {
            workers = workers.sort((a, b) => {
                const distA = a.latitude ? Math.hypot(a.latitude - userLat, a.longitude! - userLng) : 999;
                const distB = b.latitude ? Math.hypot(b.latitude - userLat, b.longitude! - userLng) : 999;
                return distA - distB;
            });
        }
        setItems(workers);

        // Ratings Logic
        const workerIds = workers.map(w => w.id);
        if (workerIds.length > 0) {
            const { data: ratingData } = await supabase.from('bookings').select('worker_id, rating').in('worker_id', workerIds).not('rating', 'is', null);
            const wMap: Record<string, {total: number, count: number}> = {};
            ratingData?.forEach((r: any) => {
                if (!wMap[r.worker_id]) wMap[r.worker_id] = { total: 0, count: 0 };
                wMap[r.worker_id].total += r.rating;
                wMap[r.worker_id].count += 1;
            });
            const finalWMap: Record<string, {avg: number, count: number}> = {};
            workerIds.forEach(id => {
                if (wMap[id]) finalWMap[id] = { avg: parseFloat((wMap[id].total / wMap[id].count).toFixed(1)), count: wMap[id].count };
            });
            setWorkerRatings(finalWMap);
        }

    } else {
        let query = supabase.from('posted_tasks').select('*, profiles:client_id(full_name, avatar_url, is_verified)').eq('status', 'open').order('created_at', { ascending: false });
        if (category !== 'All') query = query.eq('category', category);
        const { data } = await safeFetch<PostedTask[]>(async () => await query);
        let tasks = data || [];
        
        // Distance Sort for Tasks (if tasks have coords, though currently tasks use text location)
        // Future enhancement: Tasks should inherit lat/long from client or input.
        
        setItems(tasks);

        if (profile.role === 'worker') {
            const { data: apps } = await supabase.from('bookings').select('task_id').eq('worker_id', profile.id).not('task_id', 'is', null);
            if (apps) setMyApplications(new Set(apps.map((a: any) => a.task_id)));
        }

        const clientIds = Array.from(new Set(tasks.map((t: any) => t.client_id)));
        if (clientIds.length > 0) {
            const { data: ratingsData } = await supabase.from('bookings').select('client_id, client_rating').in('client_id', clientIds).not('client_rating', 'is', null);
            const ratingsMap: Record<string, number> = {};
            const countsMap: Record<string, number> = {};
            ratingsData?.forEach((r: any) => {
                if (!ratingsMap[r.client_id]) { ratingsMap[r.client_id] = 0; countsMap[r.client_id] = 0; }
                ratingsMap[r.client_id] += r.client_rating;
                countsMap[r.client_id] += 1;
            });
            const finalRatings: Record<string, number> = {};
            clientIds.forEach((id: string) => {
                if (countsMap[id]) finalRatings[id] = parseFloat((ratingsMap[id] / countsMap[id]).toFixed(1));
            });
            setClientRatings(finalRatings);
        }
    }
    setLoading(false);
  }, [category, profile, workerViewMode, userLat, userLng]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const initiateApply = (e: React.MouseEvent, task: any) => {
      e.stopPropagation();
      if (!profile) return;
      
      if (profile.role === 'worker') {
         const limit = getTierLimit(profile.subscription_tier);
         if (profile.task_count >= limit) {
             setShowUpgradeModal(true);
             return;
         }
      }
      setApplyingTask(task);
      setBidPrice(task.budget.toString());
  };

  const confirmApply = async () => {
      if (!applyingTask || !profile) return;
      
      const { error } = await supabase.from('bookings').insert({
          task_id: applyingTask.id,
          client_id: applyingTask.client_id,
          worker_id: profile.id,
          status: 'pending',
          quote_price: parseInt(bidPrice)
      });

      if (error) {
          alert("Failed to apply: " + error.message);
      } else {
          setMyApplications(prev => new Set(prev).add(applyingTask.id));
          setShowSuccessModal(true);
      }
      setApplyingTask(null);
  };

  const translateToPidgin = async (e: React.MouseEvent, text: string, id: string) => {
      e.stopPropagation();
      setTranslatingId(id);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Translate this English text to Nigerian Pidgin English clearly. Keep it short: "${text}"`;
          const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
          if (response.text) setTranslations(prev => ({ ...prev, [id]: response.text.trim() }));
      } catch (err) { console.error(err); } 
      setTranslatingId(null);
  };

  const filteredItems = items.filter(item => {
    const isWorkerItem = 'full_name' in item;
    let locationString = isWorkerItem ? `${(item as Profile).address || ''} ${(item as Profile).lga || ''} ${(item as Profile).state || ''}` : (item as any).location || '';
    
    let matchesLocation = true;
    if (selectedState !== 'All Nigeria') {
        if (!locationString.toLowerCase().includes(selectedState.toLowerCase())) matchesLocation = false;
        if (matchesLocation && selectedLGA) {
             if (!locationString.toLowerCase().includes(selectedLGA.toLowerCase())) matchesLocation = false;
        }
    }

    if (isWorkerItem) {
        const w = item as Profile;
        const matchesSearch = w.full_name.toLowerCase().includes(search.toLowerCase()) || w.subcategory?.toLowerCase().includes(search.toLowerCase()) || w.category?.toLowerCase().includes(search.toLowerCase());
        return matchesSearch && matchesLocation;
    } else {
        const t = item as any;
        const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
        return matchesSearch && matchesLocation;
    }
  });

  const handleWorkerClick = (workerId: string) => onViewWorker(workerId);

  const BidModal = () => (
      <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-6 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl space-y-4">
              <h3 className="text-xl font-black text-gray-900">Your Price?</h3>
              <p className="text-sm text-gray-500">The client's budget is ₦{applyingTask?.budget?.toLocaleString()}. What is your best offer?</p>
              <input type="number" value={bidPrice} onChange={e => setBidPrice(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl text-xl font-black text-center outline-none border focus:border-brand" />
              <button onClick={confirmApply} className="w-full bg-brand text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg">Submit Application</button>
              <button onClick={() => setApplyingTask(null)} className="w-full text-gray-400 text-xs font-bold uppercase py-2">Cancel</button>
          </div>
      </div>
  );

  return (
    <div className="bg-white min-h-screen">
      {showSuccessModal && (
         <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl space-y-4">
               <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-500"><i className="fa-solid fa-paper-plane text-2xl"></i></div>
               <h3 className="text-xl font-black text-gray-900">Application Sent!</h3>
               <button onClick={() => setShowSuccessModal(false)} className="w-full bg-brand text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg">Okay, Got it</button>
            </div>
         </div>
      )}
      {applyingTask && <BidModal />}
      {showUpgradeModal && (
          <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-6 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl space-y-4">
               <h3 className="text-xl font-black text-gray-900">Limit Reached</h3>
               <p className="text-sm text-gray-500">Upgrade your plan to apply for more jobs.</p>
               <button onClick={onUpgrade} className="w-full bg-brand text-white py-4 rounded-2xl font-black uppercase">Upgrade Now</button>
               <button onClick={() => setShowUpgradeModal(false)} className="text-gray-400 text-xs font-bold uppercase">Cancel</button>
            </div>
          </div>
      )}
      
      <header className="px-6 pt-10 pb-4 sticky top-0 bg-white/90 backdrop-blur-md z-30 space-y-4 border-b border-gray-50">
        <div className="flex justify-between items-center">
            <VelgoLogo className="h-10" />
            <div className="flex items-center gap-3">
                <button onClick={onShowGuide} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><i className="fa-solid fa-question"></i></button>
                <div className="w-10 h-10 rounded-2xl bg-gray-100 overflow-hidden border border-gray-100 shadow-sm">
                   <img src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name}&background=008000&color=fff`} className="w-full h-full object-cover" />
                </div>
            </div>
        </div>

        {profile?.role === 'worker' && (
             <div className="bg-gray-100 p-1 rounded-xl flex text-[10px] font-black uppercase tracking-widest">
                 <button onClick={() => setWorkerViewMode('jobs')} className={`flex-1 py-2.5 rounded-lg transition-all ${workerViewMode === 'jobs' ? 'bg-white text-brand shadow-sm' : 'text-gray-400'}`}>View Jobs</button>
                 <button onClick={() => setWorkerViewMode('market')} className={`flex-1 py-2.5 rounded-lg transition-all ${workerViewMode === 'market' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>Competitors</button>
             </div>
        )}
      </header>

      <div className="px-6 space-y-6 mt-6 pb-24">
        <div className="bg-gray-50 p-4 rounded-[24px] border border-gray-100">
             <h2 className="text-lg font-black text-gray-800">Hello, {profile?.full_name.split(' ')[0]}</h2>
             <p className="text-sm text-gray-500 font-medium">
                {profile?.role === 'client' ? 'Find experts for your needs.' : 'Browse jobs in your area.'}
             </p>
        </div>

        {profile?.role === 'client' && (
          <div onClick={onPostTask} className="bg-gray-900 text-white p-5 rounded-[28px] shadow-xl flex items-center justify-between active:scale-95 transition-all cursor-pointer">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-brand">Action</p><h2 className="text-xl font-black">Post a Job</h2></div>
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"><i className="fa-solid fa-plus text-lg"></i></div>
          </div>
        )}

        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"></i>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={profile?.role === 'client' ? "Search experts..." : "Search jobs..."} className="w-full bg-gray-50 border border-gray-100 rounded-[22px] py-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-brand/20 outline-none" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Location {userLat ? '(Closest First)' : ''}</p>
            {selectedState !== 'All Nigeria' && <button onClick={() => { setSelectedState('All Nigeria'); setSelectedLGA(''); }} className="text-[9px] font-bold text-red-500 uppercase">Clear</button>}
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
            <button onClick={() => { setSelectedState('All Nigeria'); setSelectedLGA(''); }} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${selectedState === 'All Nigeria' ? 'bg-gray-900 text-white border-gray-900 shadow-lg' : 'bg-white text-gray-500 border-gray-100'}`}>All Nigeria</button>
            {NIGERIA_STATES.map(n => (
                <button key={n} onClick={() => { setSelectedState(n); setSelectedLGA(''); }} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${selectedState === n ? 'bg-gray-900 text-white border-gray-900 shadow-lg' : 'bg-white text-gray-500 border-gray-100'}`}>{n}</button>
            ))}
          </div>

          {selectedState !== 'All Nigeria' && NIGERIA_LGAS[selectedState] && (
               <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6 animate-fadeIn">
                   {NIGERIA_LGAS[selectedState].map(lga => (
                       <button key={lga} onClick={() => setSelectedLGA(lga === selectedLGA ? '' : lga)} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[9px] font-bold border transition-all ${selectedLGA === lga ? 'bg-brand text-white border-brand' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>{lga}</button>
                   ))}
               </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
            {['All', ...Object.keys(CATEGORY_MAP)].map(cat => (<button key={cat} onClick={() => setCategory(cat)} className={`whitespace-nowrap px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${category === cat ? 'bg-brand text-white shadow-xl shadow-brand/20' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{cat}</button>))}
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {loading ? [1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-50 rounded-[32px] animate-pulse" />) : 
            filteredItems.length === 0 ? <div className="text-center py-10 text-gray-400 font-medium text-sm">No results found in this area.</div> :
            (profile?.role === 'client' || workerViewMode === 'market') ? (
              filteredItems.map(item => {
                  const worker = item as Profile;
                  const stats = workerRatings[worker.id];
                  return (
                    <div key={worker.id} onClick={() => handleWorkerClick(worker.id)} className={`p-5 bg-white rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-5 transition-all group active:scale-[0.98] cursor-pointer relative overflow-hidden`}>
                        {worker.is_verified && <div className="absolute top-0 right-0 bg-blue-50 text-blue-600 px-3 py-1 rounded-bl-xl text-[9px] font-black uppercase"><i className="fa-solid fa-check-circle mr-1"></i>Verified</div>}
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border bg-gray-50 flex-shrink-0"><img src={worker.avatar_url || `https://ui-avatars.com/api/?name=${worker.full_name}&background=f3f4f6&color=008000`} className="w-full h-full object-cover" /></div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-black text-gray-800 text-[15px] truncate">{worker.full_name}</h4>
                            {stats && <div className="flex items-center gap-1 text-[10px]"><i className="fa-solid fa-star text-yellow-400"></i><span className="font-black text-gray-700">{stats.avg}</span><span className="text-gray-400">({stats.count})</span></div>}
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5 truncate">{worker.subcategory || worker.category}</p>
                            <div className="flex items-center gap-2 mt-1.5"><p className="text-brand font-black text-sm tracking-tight">₦{worker.starting_price?.toLocaleString() || '2,500'}+</p></div>
                        </div>
                    </div>
                  );
              })
            ) : (
               filteredItems.map(item => {
                   const task = item as any;
                   const rating = clientRatings[task.client_id];
                   const hasApplied = myApplications.has(task.id);
                   
                   return (
                     <div key={task.id} onClick={() => onViewTask(task.id)} className="p-6 bg-white rounded-[32px] border border-gray-100 shadow-sm space-y-4 active:scale-[0.98] transition-transform cursor-pointer">
                        <div className="flex justify-between items-start">
                            <div><span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${task.urgency === 'emergency' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}`}>{task.urgency}</span><h3 className="text-lg font-black text-gray-900 mt-2 leading-tight">{task.title}</h3></div>
                            <div className="text-right"><p className="text-brand font-black text-lg">₦{task.budget.toLocaleString()}</p><p className="text-[9px] text-gray-400 font-bold uppercase">{task.category}</p></div>
                        </div>
                        
                        <div className="relative">
                            <p className="text-sm text-gray-600 font-medium line-clamp-2">{translations[task.id] || task.description}</p>
                            {!translations[task.id] && (
                                <button onClick={(e) => translateToPidgin(e, task.description, task.id)} className="text-[9px] font-black text-brand uppercase mt-1 flex items-center gap-1">
                                    <i className={`fa-solid fa-language ${translatingId === task.id ? 'animate-spin' : ''}`}></i> Translate to Pidgin
                                </button>
                            )}
                        </div>

                        <p className="text-[10px] text-gray-400 font-bold uppercase"><i className="fa-solid fa-location-dot mr-1"></i> {task.location}</p>
                        
                        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                            <div className="flex items-center gap-2">
                                <img src={task.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${task.profiles?.full_name || 'Client'}`} className="w-8 h-8 rounded-full border border-white shadow-sm" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-600">{task.profiles?.full_name || 'Client'}</span>
                                    {rating ? <div className="flex items-center gap-0.5 text-yellow-400 text-[9px]"><span className="font-black text-gray-400 mr-1">{rating}</span><i className="fa-solid fa-star"></i></div> : <span className="text-[9px] text-gray-300 font-bold">New Client</span>}
                                </div>
                            </div>
                            
                            <button 
                                onClick={(e) => !hasApplied && initiateApply(e, task)} 
                                disabled={hasApplied}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${hasApplied ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-brand text-white shadow-lg active:scale-95'}`}
                            >
                                {hasApplied ? 'Applied' : 'Apply'}
                            </button>
                        </div>
                     </div>
                   );
               })
            )
          }
        </div>
      </div>
    </div>
  );
};
export default Home;