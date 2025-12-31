import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Profile, Message } from '../types';

interface ChatProps { profile: Profile | null; partnerId: string; onBack: () => void; }

const Chat: React.FC<ChatProps> = ({ profile, partnerId, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [partner, setPartner] = useState<Profile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const isSupport = partnerId === 'support';

  useEffect(() => {
    if (isSupport) {
      setPartner({
        id: 'support',
        full_name: 'Velgo Support Team',
        avatar_url: 'https://ui-avatars.com/api/?name=Support&background=000000&color=fff',
        role: 'worker',
        subscription_tier: 'enterprise',
        is_verified: true,
        phone_number: '',
        task_count: 999,
        last_reset_date: ''
      } as Profile);
      
      // Load previous support messages
      if (profile) {
        supabase.from('support_messages').select('*').eq('user_id', profile.id).order('created_at', { ascending: true })
          .then(({data}) => {
             const formattedMsgs = (data || []).map((m: any) => ({
                 id: m.id,
                 sender_id: m.admin_reply ? 'support' : profile.id, // Simplification: showing user msg. (In real app, split admin reply into separate bubbles if structure differs)
                 receiver_id: 'support',
                 content: m.content,
                 created_at: m.created_at
             }));
             // Add initial welcome only if empty
             if (formattedMsgs.length === 0) {
                 setMessages([{
                    id: 'welcome',
                    sender_id: 'support',
                    receiver_id: profile?.id || '',
                    content: 'Hello! How can we help you today? Please leave a message and an agent will respond shortly.',
                    created_at: new Date().toISOString()
                  }]);
             } else {
                 setMessages(formattedMsgs);
             }
          });
      }
    } else {
      supabase.from('profiles').select('*').eq('id', partnerId).single().then(({data}) => setPartner(data));
      supabase.from('messages').select('*').or(`and(sender_id.eq.${profile?.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${profile?.id})`).order('created_at', { ascending: true }).then(({data}) => setMessages(data || []));
      const channel = supabase.channel('chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message;
        if ((msg.sender_id === partnerId && msg.receiver_id === profile?.id) || (msg.sender_id === profile?.id && msg.receiver_id === partnerId)) setMessages(prev => [...prev, msg]);
      }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [profile?.id, partnerId, isSupport]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newMessage.trim()) return;
    
    // Optimistic UI update
    const tempMsg: Message = {
        id: Date.now().toString(),
        sender_id: profile.id,
        receiver_id: partnerId,
        content: newMessage.trim(),
        created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');

    if (!isSupport) {
       await supabase.from('messages').insert([{ sender_id: profile.id, receiver_id: partnerId, content: tempMsg.content }]);
    } else {
        // Send to Support Table
        await supabase.from('support_messages').insert([{
            user_id: profile.id,
            content: tempMsg.content,
            status: 'open'
        }]);

        // Mock Auto-Reply only for first interaction in session
        if (messages.length === 1) {
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: Date.now().toString() + 'r',
                    sender_id: 'support',
                    receiver_id: profile.id,
                    content: "Thanks! We've received your message. An admin will check the 'Support Inbox' and contact you via email/phone if needed.",
                    created_at: new Date().toISOString()
                }]);
            }, 1000);
        }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 pb-0 transition-colors duration-200">
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
          <button onClick={onBack} className="text-gray-900 dark:text-white"><i className="fa-solid fa-chevron-left"></i></button>
          <div className="flex items-center gap-3">
              <img src={partner?.avatar_url} className="w-8 h-8 rounded-full bg-gray-200" />
              <div>
                  <h3 className="font-bold text-sm text-gray-800 dark:text-white leading-none">{partner?.full_name || 'Chat'}</h3>
                  {isSupport && <span className="text-[9px] text-green-500 font-black uppercase tracking-widest">Online</span>}
              </div>
          </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (<div key={m.id} className={`flex ${m.sender_id === profile?.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm ${m.sender_id === profile?.id ? 'bg-brand text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 dark:text-gray-200 text-gray-800 border dark:border-gray-700 rounded-tl-none'}`}>{m.content}</div></div>))}
        <div ref={scrollRef} />
      </div>
      
      <div className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 safe-bottom">
        <form onSubmit={handleSend} className="flex gap-2">
            <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Message..." className="flex-1 bg-gray-100 dark:bg-gray-700 dark:text-white border-none rounded-2xl p-4 text-sm outline-none" />
            <button type="submit" className="bg-brand text-white w-14 h-14 rounded-2xl shadow-lg active:scale-95 transition-transform"><i className="fa-solid fa-paper-plane"></i></button>
        </form>
      </div>
    </div>
  );
};
export default Chat;