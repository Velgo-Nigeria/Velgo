
import React, { useState, useEffect, useCallback } from 'react';
import { supabase, safeFetch } from '../lib/supabaseClient';
import { Profile } from '../types';
import { getTierLimit } from '../lib/constants';
import { jsPDF } from 'jspdf';

interface ActivityProps { profile: Profile | null; onOpenChat: (partnerId: string) => void; onUpgrade: () => void; onRefreshProfile: () => void; }

type ActivityTab = 'requests' | 'ongoing' | 'history';

const Activity: React.FC<ActivityProps> = ({ profile, onOpenChat, onUpgrade, onRefreshProfile }) => {
  const [activeTab, setActiveTab] = useState<ActivityTab>('requests');
  const [bookings, setBookings] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [ratingBooking, setRatingBooking] = useState<any>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const partnerColumn = profile.role === 'client' ? 'worker_id' : 'client_id';
    const { data: bookingsData } = await safeFetch<any[]>(async () => 
      await supabase.from('bookings')
        .select(`*, profiles:${partnerColumn}(*, subscription_tier, task_count), posted_tasks:task_id(title)`)
        .eq(profile.role === 'client' ? 'client_id' : 'worker_id', profile.id)
        .order('created_at', { ascending: false })
    );
    setBookings(bookingsData || []);

    let taskQuery = supabase.from('posted_tasks').select('*, profiles:assigned_worker_id(*)').order('created_at', { ascending: false });
    if (profile.role === 'client') taskQuery = taskQuery.eq('client_id', profile.id);
    else taskQuery = taskQuery.eq('assigned_worker_id', profile.id);

    const { data: tasksData } = await safeFetch<any[]>(async () => await taskQuery);
    setTasks(tasksData || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const updateBookingStatus = async (booking: any, newStatus: string) => {
    if (!profile) return;
    try {
        if (newStatus === 'accepted' && profile.role === 'worker') {
          const limit = getTierLimit(profile.subscription_tier);
          if (profile.task_count >= limit) { setShowUpgradeModal(true); return; }
        }
        if (newStatus === 'accepted' && profile.role === 'client') {
             const workerProfile = booking.profiles;
             if (workerProfile) {
                 const workerLimit = getTierLimit(workerProfile.subscription_tier || 'basic');
                 const workerCount = workerProfile.task_count || 0;
                 if (workerCount >= workerLimit) {
                     alert(`Cannot Accept: ${workerProfile.full_name} has reached their job limit.`);
                     return;
                 }
             }
             if (booking.task_id) {
                const { data: task } = await supabase.from('posted_tasks').select('status').eq('id', booking.task_id).single();
                if (task?.status === 'assigned' || task?.status === 'completed') { alert("Task already assigned."); return; }
                await supabase.from('posted_tasks').update({ status: 'assigned', assigned_worker_id: booking.worker_id }).eq('id', booking.task_id);
                await supabase.from('bookings').update({ status: 'cancelled' }).eq('task_id', booking.task_id).neq('id', booking.id).eq('status', 'pending');
             }
        }

        const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', booking.id);
        if (error) throw error;
        
        if (newStatus === 'accepted') onRefreshProfile();
        fetchActivity();
        if (newStatus === 'completed' && profile.role === 'client') setSelectedPayout(booking);

    } catch (err: any) { alert("Action failed: " + err.message); }
  };

  const handleRatingSubmit = async (stars: number, review: string, punctuality?: boolean) => {
      if (!ratingBooking || !profile) return;
      const updates: any = profile.role === 'client' ? { rating: stars, review: review } : { client_rating: stars, client_review: review };
      if (punctuality !== undefined) updates.is_punctual = punctuality;

      await supabase.from('bookings').update(updates).eq('id', ratingBooking.id);
      setRatingBooking(null);
      fetchActivity();
  };

  const generateInvoice = () => {
    if (!profile) return;
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(22); doc.setTextColor(0, 128, 0); doc.text("Velgo Nigeria", 20, 20);
      doc.setFontSize(12); doc.setTextColor(0); doc.text(`Invoice For: ${profile.full_name}`, 20, 40);
      doc.save(`Velgo_Invoice_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) { alert("Error creating PDF."); } finally { setGeneratingPdf(false); }
  };

  const showInvoiceGenerator = profile && ['standard', 'pro', 'enterprise'].includes(profile.subscription_tier || '');

  const RatingModal = () => {
    const [stars, setStars] = useState(0);
    const [text, setText] = useState('');
    const [punctual, setPunctual] = useState<boolean | null>(null);
    const targetName = ratingBooking?.profiles?.full_name || 'User';

    return (
        <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="bg-white rounded-[32px] p-6 w-full max-w-sm text-center space-y-6 animate-fadeIn">
                <h3 className="text-xl font-black uppercase">Rate {targetName}</h3>
                
                {profile?.role === 'client' && (
                    <div className="bg-gray-50 p-4 rounded-xl">
                        <p className="text-xs font-bold text-gray-500 mb-2">Was {targetName} on time?</p>
                        <div className="flex gap-2">
                            <button onClick={() => setPunctual(true)} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase ${punctual === true ? 'bg-green-500 text-white' : 'bg-white border text-gray-400'}`}>Yes</button>
                            <button onClick={() => setPunctual(false)} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase ${punctual === false ? 'bg-red-500 text-white' : 'bg-white border text-gray-400'}`}>No</button>
                        </div>
                    </div>
                )}

                <div className="flex justify-center gap-2">
                    {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setStars(s)} className={`text-4xl transition-all active:scale-125 ${s <= stars ? 'text-yellow-400' : 'text-gray-200'}`}>
                            <i className="fa-solid fa-star"></i>
                        </button>
                    ))}
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write a review..." className="w-full bg-gray-50 p-4 rounded-2xl text-sm font-bold outline-none resize-none h-24" />
                
                <button 
                    onClick={() => handleRatingSubmit(stars, text, punctual === null ? undefined : punctual)} 
                    disabled={stars === 0} 
                    className="w-full bg-brand text-white py-4 rounded-2xl font-black uppercase tracking-widest disabled:opacity-50"
                >
                    Submit Review
                </button>
                <button onClick={() => setRatingBooking(null)} className="text-gray-400 text-xs font-bold uppercase">Skip</button>
            </div>
        </div>
    );
  };

  const currentItems = activeTab === 'requests' ? bookings.filter(b => b.status === 'pending').concat(tasks.filter(t => t.status === 'open')) 
                     : activeTab === 'ongoing' ? bookings.filter(b => b.status === 'accepted').concat(tasks.filter(t => t.status === 'assigned'))
                     : bookings.filter(b => ['completed', 'cancelled', 'declined'].includes(b.status)).concat(tasks.filter(t => t.status === 'completed'));

  return (
    <div className="p-4 space-y-6 pb-24">
      {selectedPayout && (
          <div className="fixed inset-0 bg-white z-[100] p-6 flex flex-col safe-bottom overflow-y-auto animate-fadeIn">
              <h2 className="text-3xl font-black text-gray-900 uppercase text-center mt-10">Payment Required</h2>
              
              <div className="bg-gray-50 rounded-[40px] p-6 border-2 border-dashed border-gray-200 space-y-6 mt-6">
                  {/* Breakdown */}
                  <div className="space-y-2 border-b border-gray-200 pb-4">
                      <div className="flex justify-between text-sm font-bold text-gray-600">
                          <span>Agreed Fee</span>
                          <span>₦{(selectedPayout.quote_price || selectedPayout.profiles?.starting_price || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-brand">
                          <span>Velgo Commission (0%)</span>
                          <span>₦0.00</span>
                      </div>
                      <div className="flex justify-between text-xl font-black text-gray-900 pt-2">
                          <span>Total to Worker</span>
                          <span>₦{(selectedPayout.quote_price || selectedPayout.profiles?.starting_price || 0).toLocaleString()}</span>
                      </div>
                  </div>

                  {/* Bank Details */}
                  <div className="space-y-1 text-center">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[3px]">Pay Directly To</p>
                      <p className="text-lg font-bold text-gray-800">{selectedPayout.profiles?.bank_name || 'Bank Not Set'}</p>
                      <div className="flex items-center justify-center gap-2 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                           <p className="text-2xl font-black text-gray-900 tracking-widest">{selectedPayout.profiles?.account_number || '0000000000'}</p>
                           <button onClick={() => navigator.clipboard.writeText(selectedPayout.profiles?.account_number || '')} className="text-gray-400 hover:text-gray-600 active:scale-90 transition-transform"><i className="fa-regular fa-copy"></i></button>
                      </div>
                      <p className="text-xs font-bold text-gray-600 mt-1 uppercase">{selectedPayout.profiles?.account_name || selectedPayout.profiles?.full_name}</p>
                  </div>
              </div>

              {/* Safety Tip */}
              <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 items-start mt-2">
                  <i className="fa-solid fa-shield-halved text-blue-600 mt-1"></i>
                  <p className="text-xs text-blue-700 font-medium leading-tight">
                      <strong>Safety Tip:</strong> Verify the account name matches <em>{selectedPayout.profiles?.full_name}</em>. Do not transfer if the worker asks for payment to a "Company" account.
                  </p>
              </div>

              <button onClick={() => { setSelectedPayout(null); setRatingBooking(selectedPayout); }} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black shadow-2xl mt-auto uppercase tracking-widest">I Have Paid</button>
          </div>
      )}

      {ratingBooking && <RatingModal />}
      {showUpgradeModal && <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-6 backdrop-blur-sm animate-fadeIn"><div className="bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl space-y-4"><h3 className="text-xl font-black text-gray-900">Limit Reached</h3><button onClick={onUpgrade} className="w-full bg-brand text-white py-4 rounded-2xl font-black uppercase">Upgrade</button><button onClick={() => setShowUpgradeModal(false)} className="text-gray-400 text-xs font-bold uppercase">Cancel</button></div></div>}
      
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-black text-gray-900">Gigs</h1>
        {showInvoiceGenerator && <button onClick={generateInvoice} disabled={generatingPdf} className="bg-gray-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><i className="fa-solid fa-file-invoice"></i> Invoice</button>}
      </div>

      <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
        {['requests', 'ongoing', 'history'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-white text-brand shadow-md' : 'text-gray-400'}`}>{tab}</button>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? <div className="text-center py-20 animate-pulse">Syncing...</div> :
          currentItems.length > 0 ? currentItems.map(item => {
            const isTaskObject = !!item.title && !item.task_id; 
            const isApplication = !!item.task_id;
            const partnerName = isTaskObject ? (item.profiles?.full_name || 'Unassigned') : (item.profiles?.full_name || 'User');
            let price = isTaskObject ? item.budget : (item.quote_price || item.profiles?.starting_price || 0);

            return (
              <div key={item.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4 relative overflow-hidden animate-fadeIn">
                <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[9px] font-black uppercase ${isTaskObject ? 'bg-gray-900 text-white' : 'bg-brand/10 text-brand'}`}>{isTaskObject ? 'Your Post' : (isApplication ? 'Application' : 'Direct Request')}</div>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl border bg-gray-50 flex items-center justify-center text-gray-300 font-bold text-xl">{partnerName[0]}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-gray-800 truncate">{isTaskObject ? item.title : (item.posted_tasks?.title || 'Direct Hire')}</h3>
                    <div className="flex flex-col"><span className="text-xs font-bold text-gray-500">{partnerName}</span>{price > 0 && <span className="text-xs font-black text-brand">₦{price.toLocaleString()}</span>}</div>
                  </div>
                </div>

                {!isTaskObject && item.status === 'pending' && (
                    <div className="flex gap-2 w-full">
                        <button onClick={() => updateBookingStatus(item, 'cancelled')} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-black text-xs">DECLINE</button>
                        {profile?.role === 'worker' && !isApplication && <button onClick={() => updateBookingStatus(item, 'accepted')} className="flex-1 bg-brand text-white py-3 rounded-xl font-black text-xs">ACCEPT</button>}
                        {profile?.role === 'client' && <button onClick={() => updateBookingStatus(item, 'accepted')} className="flex-1 bg-brand text-white py-3 rounded-xl font-black text-xs">ACCEPT</button>}
                        {profile?.role === 'worker' && isApplication && <div className="flex-1 bg-gray-50 py-3 rounded-xl text-center text-[10px] text-gray-400 font-bold uppercase">Pending...</div>}
                    </div>
                )}
                {!isTaskObject && ['accepted'].includes(item.status) && (
                    <div className="flex gap-2">
                         <button onClick={() => onOpenChat(profile?.role === 'client' ? item.worker_id : item.client_id)} className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-black text-xs">CHAT</button>
                         {profile?.role === 'client' && <button onClick={() => updateBookingStatus(item, 'completed')} className="flex-1 border-2 border-brand text-brand py-3 rounded-xl font-black text-xs uppercase">COMPLETE</button>}
                    </div>
                )}
                {activeTab === 'history' && !isTaskObject && item.status === 'completed' && (!item.rating && !item.client_rating) && (
                     <button onClick={() => setRatingBooking(item)} className="w-full bg-brand text-white py-3 rounded-xl font-black text-xs uppercase shadow-md animate-pulse">Rate User</button>
                )}
              </div>
            );
          }) : <div className="text-center py-20 flex flex-col items-center"><i className="fa-solid fa-folder-open text-4xl text-gray-200 mb-4"></i><p className="text-gray-400 text-sm font-bold">No {activeTab} found.</p></div>
        }
      </div>
    </div>
  );
};
export default Activity;
