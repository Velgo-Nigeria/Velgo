import React, { useState, useEffect } from 'react';
import { supabase, safeFetch } from '../lib/supabaseClient';
import { Profile, PostedTask } from '../types';
import { getTierLimit } from '../lib/constants';
import { GoogleGenAI } from "@google/genai";

interface TaskDetailProps { 
  profile: Profile | null; 
  taskId: string; 
  onBack: () => void; 
  onUpgrade: () => void;
}

const TaskDetail: React.FC<TaskDetailProps> = ({ profile, taskId, onBack, onUpgrade }) => {
  const [task, setTask] = useState<PostedTask | null>(null);
  const [client, setClient] = useState<Profile | null>(null);
  const [clientRating, setClientRating] = useState<{avg: number, count: number} | null>(null);
  const [clientReviews, setClientReviews] = useState<any[]>([]); // New state for reviews
  
  const [hasApplied, setHasApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Translation State
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  
  // Modals
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);

  useEffect(() => {
    const fetchTaskDetails = async () => {
      setLoading(true);
      
      const { data: taskData } = await safeFetch<PostedTask>(async () => 
        await supabase.from('posted_tasks').select('*').eq('id', taskId).single() as any
      );

      if (taskData) {
        setTask(taskData);
        
        if (taskData.client_id) {
            const { data: clientData } = await safeFetch<Profile>(async () => 
                await supabase.from('profiles').select('*').eq('id', taskData.client_id).single() as any
            );
            setClient(clientData);

            // Fetch Client Ratings (Worker rating Client -> 'client_rating' column)
            const { data: ratingData } = await supabase.from('bookings')
                .select('client_rating')
                .eq('client_id', taskData.client_id)
                .not('client_rating', 'is', null);
            
            if (ratingData && ratingData.length > 0) {
                const total = ratingData.reduce((acc, curr) => acc + (curr.client_rating || 0), 0);
                setClientRating({
                    avg: parseFloat((total / ratingData.length).toFixed(1)),
                    count: ratingData.length
                });
            }

            // Fetch Written Reviews about Client (from Workers)
            const { data: reviewsData } = await supabase.from('bookings')
                .select('client_review, client_rating, created_at, profiles:worker_id(full_name, avatar_url)')
                .eq('client_id', taskData.client_id)
                .not('client_review', 'is', null)
                .neq('client_review', '') // Ensure not empty
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (reviewsData) setClientReviews(reviewsData);
        }

        if (profile) {
            const { data: booking } = await supabase.from('bookings')
                .select('id')
                .eq('task_id', taskId)
                .eq('worker_id', profile.id)
                .single();
            if (booking) setHasApplied(true);
        }
      }
      setLoading(false);
    };

    fetchTaskDetails();
  }, [taskId, profile]);

  const handleApply = async () => {
      if (!profile || !task) return;
      
      // Check Worker Limit
      if (profile.role === 'worker') {
         const limit = getTierLimit(profile.subscription_tier);
         if (profile.task_count >= limit) {
             setShowUpgradeModal(true);
             return;
         }
      }
      
      setApplying(true);
      
      const { error } = await supabase.from('bookings').insert({
          task_id: task.id,
          client_id: task.client_id,
          worker_id: profile.id,
          status: 'pending'
      });

      if (error) {
          alert("Failed to apply: " + error.message);
          setApplying(false);
      } else {
          setHasApplied(true);
          setApplying(false);
          alert("Application Sent! The client will review your profile.");
      }
  };

  const handleDelete = async () => {
    if (!task) return;
    const confirmDelete = window.confirm("Are you sure you want to delete this job? This action cannot be undone.");
    if (!confirmDelete) return;

    setDeleting(true);

    const { error } = await supabase.from('posted_tasks').delete().eq('id', task.id);

    if (error) {
        alert("Failed to delete: " + error.message);
        setDeleting(false);
    } else {
        alert("Job deleted successfully.");
        onBack();
    }
  };
  
  const handleTranslate = async () => {
      if (!task?.description) return;
      setTranslating(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `Translate this English text to Nigerian Pidgin English clearly. Keep it short: "${task.description}"`;
          const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
          if (response.text) setTranslation(response.text.trim());
      } catch (err) {
          console.error(err);
          alert("Translation failed. Please check API Key.");
      } finally {
          setTranslating(false);
      }
  };
  
  const UpgradeModal = () => (
    <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-6 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
          <i className="fa-solid fa-lock text-2xl"></i>
        </div>
        <h3 className="text-xl font-black text-gray-900">Job Limit Reached</h3>
        <p className="text-sm text-gray-500 font-medium leading-relaxed">
          You've reached the application limit for your <b>{profile?.subscription_tier}</b> plan. Upgrade now to apply for more jobs.
        </p>
        <button onClick={onUpgrade} className="w-full bg-brand text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform">
          Upgrade Now
        </button>
        <button onClick={() => setShowUpgradeModal(false)} className="text-gray-400 text-xs font-bold uppercase">Cancel</button>
      </div>
    </div>
  );

  const ReviewsModal = () => (
      <div className="fixed inset-0 bg-black/80 z-[120] flex items-end sm:items-center justify-center sm:p-6 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white rounded-t-[32px] sm:rounded-[32px] p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-black text-gray-900">Reviews on {client?.full_name}</h3>
                <button onClick={() => setShowReviewsModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
            </div>
            
            {clientReviews.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-xs italic">No reviews yet.</div>
            ) : (
                clientReviews.map((r, i) => (
                    <div key={i} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-2">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">
                                    {r.profiles?.avatar_url ? <img src={r.profiles.avatar_url} className="w-full h-full object-cover"/> : <i className="fa-solid fa-user text-gray-400 text-xs p-1"></i>}
                                </div>
                                <span className="text-xs font-bold text-gray-800">{r.profiles?.full_name || 'Worker'}</span>
                            </div>
                            <div className="flex text-yellow-400 text-[10px] gap-0.5">
                                {Array(Math.round(r.client_rating || 5)).fill(0).map((_, idx) => <i key={idx} className="fa-solid fa-star"></i>)}
                            </div>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">"{r.client_review}"</p>
                        <p className="text-[9px] text-gray-400 font-bold mt-2 text-right">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                ))
            )}
        </div>
      </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 w-12 bg-gray-200 rounded-full mb-4"></div>
            <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
    </div>
  );

  if (!task) return <div className="p-10 text-center">Task not found.</div>;

  const isOwner = profile?.id === task.client_id;

  return (
    <div className="bg-white min-h-screen pb-24 relative">
      {showUpgradeModal && <UpgradeModal />}
      {showReviewsModal && <ReviewsModal />}
      
      {/* Header / Map Placeholder */}
      <div className="relative h-[35vh] bg-gray-900 overflow-hidden">
        <div className="absolute inset-0 opacity-40">
            {/* Abstract Pattern or Map Placeholder */}
            <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        </div>
        <button onClick={onBack} className="absolute top-6 left-6 z-20 bg-white/20 backdrop-blur-xl text-white p-4 rounded-2xl active:scale-95 transition-transform">
            <i className="fa-solid fa-chevron-left"></i>
        </button>
        
        <div className="absolute bottom-6 left-6 right-6 text-white">
            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${task.urgency === 'emergency' ? 'bg-red-500' : 'bg-brand'}`}>
                {task.urgency}
            </span>
            <h1 className="text-3xl font-black mt-3 leading-tight shadow-sm">{task.title}</h1>
            <div className="flex items-center gap-2 mt-2 opacity-90 text-sm font-bold">
                <i className="fa-solid fa-location-dot text-brand-light"></i> {task.location}
            </div>
        </div>
      </div>

      <div className="px-6 -mt-6 relative z-10">
        <div className="bg-white rounded-t-[32px] p-6 shadow-xl border-t border-gray-100 min-h-[60vh] space-y-8">
            
            {/* Budget & Category */}
            <div className="flex justify-between items-center border-b border-gray-100 pb-6">
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Budget</p>
                    <p className="text-2xl font-black text-brand">₦{task.budget.toLocaleString()}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</p>
                    <p className="text-sm font-bold text-gray-800">{task.category}</p>
                </div>
            </div>

            {/* Client Info */}
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <img src={client?.avatar_url || `https://ui-avatars.com/api/?name=${client?.full_name || 'User'}`} className="w-12 h-12 rounded-xl border border-white shadow-sm" />
                <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Posted By</p>
                    <h3 className="font-bold text-gray-900 leading-tight">{client?.full_name || 'Valued Client'}</h3>
                    {clientRating ? (
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                                <i className="fa-solid fa-star text-yellow-400 text-[10px]"></i>
                                <span className="text-[10px] font-black text-gray-700">{clientRating.avg}</span>
                                <span className="text-[9px] text-gray-400 font-bold">({clientRating.count})</span>
                            </div>
                            <button onClick={() => setShowReviewsModal(true)} className="text-[9px] font-bold text-blue-600 underline decoration-blue-200">See Reviews</button>
                        </div>
                    ) : (
                        <span className="text-[9px] text-gray-400 font-bold">No ratings yet</span>
                    )}
                </div>
                {client?.is_verified && <i className="fa-solid fa-circle-check text-blue-500 ml-auto"></i>}
            </div>

            {/* Description */}
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Task Details</h3>
                    {!translation && (
                        <button onClick={handleTranslate} disabled={translating} className="text-[9px] font-black text-brand uppercase flex items-center gap-1">
                            <i className={`fa-solid fa-language ${translating ? 'animate-spin' : ''}`}></i> {translating ? 'Translating...' : 'Pidgin Translation'}
                        </button>
                    )}
                </div>
                <p className="text-sm text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">
                    {translation || task.description}
                </p>
                {translation && <p className="text-[9px] text-gray-400 font-bold uppercase mt-2 italic text-right">Translated by AI</p>}
            </div>

            {/* Action Area */}
            {profile?.role === 'worker' ? (
                <div className="pt-4">
                    <button 
                        onClick={handleApply} 
                        disabled={hasApplied || applying}
                        className={`w-full py-5 rounded-[28px] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${
                            hasApplied 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-brand text-white'
                        }`}
                    >
                        {hasApplied ? 'Application Sent' : (applying ? 'Sending...' : 'Apply Now')}
                    </button>
                    {hasApplied && <p className="text-center text-[10px] text-gray-400 font-bold mt-3 uppercase">Check 'Gigs' tab for status updates.</p>}
                </div>
            ) : isOwner ? (
                <div className="pt-4">
                     <button 
                        onClick={handleDelete} 
                        disabled={deleting}
                        className="w-full py-5 rounded-[28px] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 bg-red-50 text-red-600 border border-red-100"
                    >
                        {deleting ? 'Deleting...' : 'Delete Job'}
                    </button>
                </div>
            ) : (
                <div className="pt-4 text-center">
                    <p className="text-xs text-gray-400 font-bold bg-gray-50 p-4 rounded-xl">Clients cannot apply to tasks.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;