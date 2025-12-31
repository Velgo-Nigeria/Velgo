import React, { useState, useEffect, useRef } from 'react';
import { supabase, safeFetch } from '../lib/supabaseClient';
import { Profile } from '../types';

const AdminDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'safety' | 'support' | 'verify'>('verify');
  const [safetyReports, setSafetyReports] = useState<any[]>([]);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Action States
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Support Chat State
  const [selectedTicketUser, setSelectedTicketUser] = useState<any>(null);
  const [adminReply, setAdminReply] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchData(); }, [activeTab]);

  useEffect(() => {
    if (selectedTicketUser && chatScrollRef.current) {
        chatScrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [supportMessages, selectedTicketUser]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    
    try {
        let result: { data: any, error: any } = { data: null, error: null };

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            setErrorMsg("Session expired. Please re-login.");
            setLoading(false);
            return;
        }

        if (activeTab === 'users' || activeTab === 'verify') {
            result = await safeFetch(() => supabase.from('profiles').select('*').order('created_at', { ascending: false }));
        } else if (activeTab === 'safety') {
            result = await safeFetch(() => supabase
                .from('safety_reports')
                .select('*, profiles(full_name, phone_number, id)')
                .order('created_at', { ascending: false }));
        } else {
            result = await safeFetch(() => supabase
                .from('support_messages')
                .select('*, profiles(full_name, email, avatar_url, id)')
                .order('created_at', { ascending: true }));
        }

        if (result.error) {
            console.error("Admin Fetch Error:", result.error);
            // Handle missing tables/columns gracefully
            if (result.error.code === '42P01' || result.error.message?.includes('relation')) {
               setErrorMsg("Database Setup Required: Missing tables. Please run the provided SQL script.");
            } else if (result.error.code === '42501') {
               setErrorMsg("Permission Denied: You may not be an admin, or RLS policies need updating via SQL.");
            } else {
               setErrorMsg(`Data Error: ${result.error.message}`);
            }
        }

        if (activeTab === 'users' || activeTab === 'verify') setUsers(result.data || []);
        else if (activeTab === 'safety') setSafetyReports(result.data || []);
        else setSupportMessages(result.data || []);

    } catch (err: any) {
        setErrorMsg(err.message || "Unknown system error occurred.");
    } finally {
        setLoading(false);
    }
  };

  const handleVerify = async (e: React.MouseEvent, id: string, approve: boolean) => {
      e.preventDefault();
      e.stopPropagation(); 
      
      if (processingId) return;
      
      const confirmMsg = approve ? "Approve this user?" : "Reject verification?";
      if(!window.confirm(confirmMsg)) return;
      
      setProcessingId(id);
      
      try {
          const updates = approve ? { is_verified: true, nin_image_url: null } : { nin_image_url: null };
          
          const { error } = await supabase.from('profiles').update(updates).eq('id', id); 
          
          if (error) throw error;
          
          setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
          alert(approve ? "User Approved!" : "User Rejected.");
      } catch (err: any) {
          if (err.code === '42501') alert("Error: Admin policies not set. Run the SQL script.");
          else alert("Action failed: " + err.message);
      } finally {
          setProcessingId(null);
      }
  };

  const handleSafetyAction = async (reportId: string, action: 'resolve' | 'dismiss') => {
      const status = action === 'resolve' ? 'resolved' : 'dismissed';
      const { error } = await supabase.from('safety_reports').update({ status }).eq('id', reportId);
      if (error) {
           if (error.code === '42501') alert("Error: Admin policies not set. Run the SQL script.");
           else alert("Failed: " + error.message);
      } else {
          fetchData();
      }
  };

  const openSupportChatFromSafety = (user: any) => {
      setActiveTab('support');
      setSelectedTicketUser(user);
  };

  const sendAdminReply = async () => {
      if (!selectedTicketUser || !adminReply.trim()) return;
      
      const { error } = await supabase.from('support_messages').insert({
          user_id: selectedTicketUser.id,
          content: adminReply,
          admin_reply: true, 
          status: 'open'
      });

      if (!error) {
          setAdminReply('');
          fetchData();
      } else {
          alert("Failed to send: " + error.message);
      }
  };

  const pendingVerifications = users.filter(u => u.nin_image_url && !u.is_verified);
  const filteredUsers = users.filter(u => u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()));

  const groupedSupport = supportMessages.reduce((acc: any, msg) => {
      if (!msg.profiles) return acc;
      const uid = msg.profiles.id;
      if (!acc[uid]) {
          acc[uid] = { 
              user: msg.profiles, 
              messages: [], 
              lastMsg: msg 
          };
      }
      acc[uid].messages.push(msg);
      if (new Date(msg.created_at) > new Date(acc[uid].lastMsg.created_at)) {
          acc[uid].lastMsg = msg;
      }
      return acc;
  }, {});

  const sortedSupportTickets = Object.values(groupedSupport).sort((a: any, b: any) => 
      new Date(b.lastMsg.created_at).getTime() - new Date(a.lastMsg.created_at).getTime()
  );

  return (
    <div className="bg-gray-50 min-h-screen pb-24 flex flex-col">
      <div className="px-6 pt-10 pb-4 bg-gray-900 sticky top-0 z-20 text-white shadow-lg">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
                <button onClick={onBack}><i className="fa-solid fa-chevron-left"></i></button>
                <h1 className="text-2xl font-black">Admin Panel</h1>
            </div>
            <button onClick={fetchData} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                <i className={`fa-solid fa-rotate-right ${loading ? 'animate-spin' : ''}`}></i>
            </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['verify', 'users', 'safety', 'support'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab as any); setSelectedTicketUser(null); }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${activeTab === tab ? 'bg-brand text-white' : 'bg-white/10 text-gray-400'}`}>{tab}</button>
          ))}
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {loading ? <div className="text-center py-20 text-gray-400">Loading data...</div> : 
         errorMsg ? <div className="p-6 bg-red-50 text-red-600 rounded-2xl text-center border border-red-100 animate-fadeIn"><i className="fa-solid fa-triangle-exclamation text-3xl mb-3"></i><p className="text-xs font-bold break-words">{errorMsg}</p></div> :

         activeTab === 'verify' ? (
             pendingVerifications.length === 0 ? <div className="text-center py-20 text-gray-400 text-sm font-bold">No pending verifications.</div> :
             pendingVerifications.map(u => (
                 <div key={u.id} className="bg-white p-5 rounded-2xl shadow-sm space-y-4 mb-4 relative z-0">
                     <h3 className="font-bold">{u.full_name}</h3>
                     {u.nin_image_url ? (
                        <div className="relative z-0">
                            <a href={u.nin_image_url} target="_blank" rel="noopener noreferrer">
                                <img src={u.nin_image_url} className="w-full h-48 object-contain bg-gray-100 rounded-xl border" />
                            </a>
                        </div>
                     ) : <div className="h-48 bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-400">Image failed to load</div>}
                     
                     <div className="flex gap-2 relative z-20">
                         <button 
                            onClick={(e) => handleVerify(e, u.id, false)} 
                            disabled={processingId === u.id}
                            className="flex-1 bg-red-100 text-red-600 py-4 rounded-xl font-black text-xs uppercase hover:bg-red-200 active:scale-95 transition-all shadow-sm"
                         >
                            {processingId === u.id ? 'Wait...' : 'REJECT'}
                         </button>
                         <button 
                            onClick={(e) => handleVerify(e, u.id, true)} 
                            disabled={processingId === u.id}
                            className="flex-1 bg-green-600 text-white py-4 rounded-xl font-black text-xs uppercase hover:bg-green-700 active:scale-95 transition-all shadow-lg shadow-green-200"
                         >
                            {processingId === u.id ? 'Wait...' : 'APPROVE'}
                         </button>
                     </div>
                 </div>
             ))
         ) : 
         
         activeTab === 'users' ? (
            <div className="space-y-4">
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search users by name or email..." className="w-full p-3 rounded-xl border outline-none focus:border-brand" />
                <div className="space-y-3">
                    {filteredUsers.map(user => (
                        <div key={user.id} className="bg-white p-4 rounded-xl shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="min-w-0">
                                    <p className="font-bold text-sm text-gray-900 truncate">{user.full_name}</p>
                                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                </div>
                                {user.is_verified && <i className="fa-solid fa-check-circle text-blue-500 text-lg"></i>}
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                <i className="fa-solid fa-phone w-4"></i>
                                {user.phone_number ? (
                                    <a href={`tel:${user.phone_number}`} className="font-bold text-blue-600 underline decoration-blue-200 decoration-2 underline-offset-2">
                                        {user.phone_number}
                                    </a>
                                ) : <span className="text-gray-400">No phone</span>}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                                <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${user.role === 'worker' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {user.role}
                                </span>
                                <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${user.subscription_tier === 'basic' ? 'bg-gray-100 text-gray-500' : 'bg-brand/10 text-brand'}`}>
                                    {user.subscription_tier} Plan
                                </span>
                                <span className="text-[9px] text-gray-400 font-bold ml-auto">
                                    {new Date(user.last_reset_date || Date.now()).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
         ) : 
         
         activeTab === 'safety' ? (
            <div className="space-y-4">
                {safetyReports.length === 0 ? <div className="text-center py-20 text-gray-400 text-sm font-bold">No safety reports found.</div> : 
                 safetyReports.map(report => (
                    <div key={report.id} className="bg-white p-5 rounded-2xl shadow-sm border border-red-50">
                        <div className="flex justify-between items-start mb-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${report.status === 'resolved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{report.status || 'pending'}</span>
                            <span className="text-[10px] text-gray-400">{new Date(report.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="mb-3">
                            <p className="text-sm font-bold text-gray-900">Reporter: {report.profiles?.full_name || 'Unknown'}</p>
                            <a href={`tel:${report.profiles?.phone_number}`} className="text-xs text-blue-600 font-bold underline">{report.profiles?.phone_number}</a>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl mb-4">
                             <p className="text-xs text-gray-700 leading-relaxed font-medium">{report.details}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => openSupportChatFromSafety(report.profiles)} className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-black text-[10px] uppercase">Message</button>
                            {report.status !== 'resolved' && (
                                <button onClick={() => handleSafetyAction(report.id, 'resolve')} className="flex-1 bg-green-500 text-white py-3 rounded-xl font-black text-[10px] uppercase">Resolve</button>
                            )}
                        </div>
                    </div>
                 ))
                }
            </div>
         ) : 
         
         activeTab === 'support' ? (
             selectedTicketUser ? (
                 <div className="flex flex-col h-[70vh]">
                     <div className="flex items-center gap-3 bg-white p-4 rounded-t-2xl border-b mb-2">
                         <button onClick={() => setSelectedTicketUser(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"><i className="fa-solid fa-arrow-left"></i></button>
                         <h3 className="font-bold text-gray-900">{selectedTicketUser.full_name}</h3>
                         <span className="text-xs text-gray-500">{selectedTicketUser.email}</span>
                     </div>
                     <div className="flex-1 overflow-y-auto space-y-3 p-2">
                         {groupedSupport[selectedTicketUser.id]?.messages.map((msg: any) => (
                             <div key={msg.id} className={`flex ${msg.admin_reply ? 'justify-end' : 'justify-start'}`}>
                                 <div className={`max-w-[80%] p-3 rounded-2xl text-xs ${msg.admin_reply ? 'bg-gray-900 text-white rounded-br-none' : 'bg-white border text-gray-700 rounded-bl-none'}`}>
                                     {msg.content}
                                 </div>
                             </div>
                         ))}
                         <div ref={chatScrollRef} />
                     </div>
                     <div className="mt-2 flex gap-2 pt-2 border-t">
                         <input value={adminReply} onChange={e => setAdminReply(e.target.value)} className="flex-1 bg-white border p-3 rounded-xl text-sm outline-none" placeholder="Type reply..." />
                         <button onClick={sendAdminReply} className="bg-brand text-white px-6 rounded-xl font-black text-xs uppercase">Send</button>
                     </div>
                 </div>
             ) : (
                 <div className="space-y-3">
                     {sortedSupportTickets.length === 0 ? <div className="text-center py-20 text-gray-400 text-sm font-bold">No active tickets.</div> :
                      sortedSupportTickets.map((ticket: any) => (
                         <div key={ticket.user.id} onClick={() => setSelectedTicketUser(ticket.user)} className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform">
                             <div className="w-10 h-10 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">{ticket.user.full_name[0]}</div>
                             <div className="flex-1 min-w-0">
                                 <div className="flex justify-between">
                                     <h4 className="font-bold text-sm text-gray-900 truncate">{ticket.user.full_name}</h4>
                                     <span className="text-[9px] text-gray-400 font-bold">{new Date(ticket.lastMsg.created_at).toLocaleDateString()}</span>
                                 </div>
                                 <p className="text-xs text-gray-500 truncate mt-1">
                                     {ticket.lastMsg.admin_reply ? <span className="text-brand font-bold">You: </span> : ''} {ticket.lastMsg.content}
                                 </p>
                             </div>
                         </div>
                      ))
                     }
                 </div>
             )
         ) : null
        }
      </div>
    </div>
  );
};
export default AdminDashboard;