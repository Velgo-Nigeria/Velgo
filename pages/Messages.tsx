import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Profile } from '../types';

interface MessagesProps {
  profile: Profile | null;
  onOpenChat: (id: string) => void;
}

const Messages: React.FC<MessagesProps> = ({ profile, onOpenChat }) => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    
    const fetchConversations = async () => {
        setLoading(true);
        // Fetch all messages where user is sender OR receiver
        const { data: sent } = await supabase.from('messages').select('receiver_id, created_at, content').eq('sender_id', profile.id);
        const { data: received } = await supabase.from('messages').select('sender_id, created_at, content').eq('receiver_id', profile.id);
        
        // Combine and find unique partners
        const all = [...(sent || []).map(m => ({ ...m, partner: m.receiver_id })), ...(received || []).map(m => ({ ...m, partner: m.sender_id }))];
        
        // Group by partner, keeping latest message
        const partnersMap = new Map();
        all.forEach(msg => {
            if (!partnersMap.has(msg.partner) || new Date(msg.created_at) > new Date(partnersMap.get(msg.partner).created_at)) {
                partnersMap.set(msg.partner, msg);
            }
        });

        const uniquePartnerIds = Array.from(partnersMap.keys());
        let list: any[] = [];
        
        if (uniquePartnerIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url, role').in('id', uniquePartnerIds);
            
            list = uniquePartnerIds.map(id => {
                const userProfile = profiles?.find(p => p.id === id);
                const lastMsg = partnersMap.get(id);
                return {
                    id,
                    profile: userProfile,
                    lastMessage: lastMsg.content,
                    time: lastMsg.created_at,
                    isSupport: false
                };
            }).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        }

        // Always add Support Chat at the top
        const supportChat = {
            id: 'support',
            profile: { 
                full_name: 'Velgo Support', 
                avatar_url: 'https://ui-avatars.com/api/?name=Velgo+Support&background=000000&color=fff', 
                role: 'admin' 
            },
            lastMessage: 'Tap here to contact support.',
            time: new Date().toISOString(),
            isSupport: true
        };

        // Combine (Support first)
        setConversations([supportChat, ...list]);
        setLoading(false);
    };

    fetchConversations();
  }, [profile]);

  return (
    <div className="bg-white min-h-screen pb-24">
        <div className="px-6 pt-10 pb-4 border-b border-gray-50 flex items-center justify-between sticky top-0 bg-white z-10">
            <h1 className="text-2xl font-black">Messages</h1>
            <div className="w-8 h-8 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-comment-dots"></i>
            </div>
        </div>
        
        <div className="p-4 space-y-2">
            {loading ? <div className="text-center py-10 text-gray-400">Loading chats...</div> : 
             conversations.map(conv => (
                 <div 
                    key={conv.id} 
                    onClick={() => onOpenChat(conv.id)} 
                    className={`flex items-center gap-4 p-4 rounded-2xl border shadow-sm active:scale-[0.98] transition-all cursor-pointer ${conv.isSupport ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-50'}`}
                 >
                     <div className="relative">
                         <img src={conv.profile?.avatar_url || `https://ui-avatars.com/api/?name=${conv.profile?.full_name || 'User'}`} className="w-12 h-12 rounded-full object-cover border border-gray-100" />
                         {conv.profile?.role === 'admin' && <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-[8px] px-1 rounded-full border border-white">SUP</div>}
                     </div>
                     <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-baseline mb-1">
                             <h3 className={`font-bold text-sm truncate ${conv.isSupport ? 'text-white' : 'text-gray-900'}`}>{conv.profile?.full_name || 'Unknown User'}</h3>
                             {!conv.isSupport && <span className="text-[9px] text-gray-400 font-bold">{new Date(conv.time).toLocaleDateString()}</span>}
                         </div>
                         <p className={`text-xs truncate ${conv.isSupport ? 'text-gray-400' : 'text-gray-500'}`}>{conv.lastMessage}</p>
                     </div>
                     {conv.isSupport && <i className="fa-solid fa-chevron-right text-gray-600 text-xs"></i>}
                 </div>
             ))
            }
        </div>
    </div>
  );
};

export default Messages;