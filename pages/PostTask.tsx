import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Profile } from '../types';
import { CATEGORY_MAP, getTierLimit } from '../lib/constants';
import { GoogleGenAI, Type } from "@google/genai";
import { NIGERIA_STATES, NIGERIA_LGAS } from '../lib/locations';

interface PostTaskProps { profile: Profile | null; onBack: () => void; onUpgrade: () => void; onRefreshProfile: () => void; }

const PostTask: React.FC<PostTaskProps> = ({ profile, onBack, onUpgrade, onRefreshProfile }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [category, setCategory] = useState(Object.keys(CATEGORY_MAP)[0]);
  const [subcategory, setSubcategory] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [loading, setLoading] = useState(false);
  
  // Location Logic
  const [selectedState, setSelectedState] = useState('Lagos');
  const [selectedLGA, setSelectedLGA] = useState(NIGERIA_LGAS['Lagos']?.[0] || '');
  
  // Limit Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // AI States
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Reset LGA when State changes
    if (NIGERIA_LGAS[selectedState]) {
        if (!NIGERIA_LGAS[selectedState].includes(selectedLGA)) {
             setSelectedLGA(NIGERIA_LGAS[selectedState][0] || '');
        }
    } else {
        setSelectedLGA('');
    }
  }, [selectedState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    // Check Client Limit
    const limit = getTierLimit(profile.subscription_tier);
    if (profile.task_count >= limit) {
      setShowUpgradeModal(true);
      return;
    }

    setLoading(true);

    const fullLocation = `${selectedLGA}, ${selectedState}`;

    const { error } = await supabase.from('posted_tasks').insert([{
      client_id: profile.id,
      title,
      description,
      budget: parseInt(budget) || 0,
      location: fullLocation,
      category,
      subcategory,
      urgency
    }]);

    if (!error) {
      // Database Trigger automatically increments 'task_count' on insert.
      onRefreshProfile();
      alert("Job Posted Successfully!");
      onBack();
    } else {
      alert(error.message);
    }
    setLoading(false);
  };

  const handleAiEnhance = async () => {
    if (!description.trim()) return;
    setIsEnhancing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Rewrite this task description to be clear, engaging, and professional for a gig marketplace in Nigeria. Keep the tone urgent but polite if needed. Limit to 60 words: "${description}"`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      if (response.text) {
        setDescription(response.text.trim());
      }
    } catch (e) {
      console.error(e);
      alert("AI enhancement failed. Please try again.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleVoiceInput = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        chunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          await processAudioWithGemini(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
      } catch (e) {
        alert("Microphone access denied. Please allow permissions.");
      }
    }
  };

  const processAudioWithGemini = async (audioBlob: Blob) => {
      setProcessingAudio(true);
      try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
              const base64data = reader.result?.toString().split(',')[1];
              if (!base64data) return;

              const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
              
              // Correct Model: gemini-3-flash-preview supports audio in generateContent
              const response = await ai.models.generateContent({
                  model: "gemini-3-flash-preview",
                  contents: {
                      parts: [
                          { inlineData: { mimeType: 'audio/webm', data: base64data } },
                          { text: "Extract job details into JSON: title, description (detailed), budget (number), urgency (normal/urgent/emergency), state (Nigeria), lga (Nigeria), category. Map vague inputs to the nearest valid Nigerian State/LGA and Category." }
                      ]
                  },
                  config: {
                      responseMimeType: "application/json",
                      responseSchema: {
                          type: Type.OBJECT,
                          properties: {
                              title: { type: Type.STRING },
                              description: { type: Type.STRING },
                              budget: { type: Type.INTEGER },
                              urgency: { type: Type.STRING },
                              state: { type: Type.STRING },
                              lga: { type: Type.STRING },
                              category: { type: Type.STRING }
                          }
                      }
                  }
              });

              if (response.text) {
                  const data = JSON.parse(response.text);
                  if (data.title) setTitle(data.title);
                  if (data.description) setDescription(data.description);
                  if (data.budget) setBudget(data.budget.toString());
                  if (data.urgency && ['normal', 'urgent', 'emergency'].includes(data.urgency.toLowerCase())) setUrgency(data.urgency.toLowerCase());
                  
                  // Intelligent Mapping
                  if (data.category && CATEGORY_MAP[data.category]) {
                      setCategory(data.category);
                  }
                  if (data.state && NIGERIA_STATES.includes(data.state)) {
                      setSelectedState(data.state);
                      if (data.lga) {
                           setTimeout(() => {
                               if (NIGERIA_LGAS[data.state]?.includes(data.lga)) setSelectedLGA(data.lga);
                           }, 100);
                      }
                  }
              }
              setProcessingAudio(false);
          };
      } catch (e) {
          console.error(e);
          alert("Could not process audio. Please try again.");
          setProcessingAudio(false);
      }
  };

  // Limit Modal Component
  const UpgradeModal = () => (
    <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-6 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
          <i className="fa-solid fa-lock text-2xl"></i>
        </div>
        <h3 className="text-xl font-black text-gray-900">Posting Limit Reached</h3>
        <p className="text-sm text-gray-500 font-medium leading-relaxed">
          You've reached the post limit for your <b>{profile?.subscription_tier}</b> plan. Upgrade now to post more jobs.
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
      
      <div className="px-6 pt-10 pb-4 border-b border-gray-50 flex items-center gap-4 sticky top-0 bg-white z-10">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center"><i className="fa-solid fa-chevron-left text-gray-500"></i></button>
        <h1 className="text-2xl font-black">Post a Job</h1>
      </div>

      <div className="px-6 pt-4">
          <button 
            type="button" 
            onClick={handleVoiceInput} 
            disabled={processingAudio}
            className={`w-full py-6 rounded-[28px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                isRecording 
                ? 'bg-red-50 text-red-600 animate-pulse border border-red-200' 
                : (processingAudio ? 'bg-gray-100 text-gray-400' : 'bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10')
            }`}
          >
            {processingAudio ? (
                <>
                    <i className="fa-solid fa-circle-notch animate-spin"></i> Processing Audio...
                </>
            ) : isRecording ? (
                <>
                    <i className="fa-solid fa-stop"></i> Stop Recording
                </>
            ) : (
                <>
                    <i className="fa-solid fa-microphone"></i> Tap to Speak Job Details
                </>
            )}
          </button>
          <p className="text-center text-[9px] text-gray-400 font-bold mt-2 uppercase">"I need a carpenter in Yaba to fix my door, budget 5k"</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Job Title</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fix my kitchen sink" className="w-full bg-gray-50 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20" />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1 ml-1">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Description</label>
             <button type="button" onClick={handleAiEnhance} disabled={isEnhancing || !description} className="text-[10px] font-black uppercase tracking-widest text-brand flex items-center gap-1 disabled:opacity-50">
               <i className={`fa-solid fa-wand-magic-sparkles ${isEnhancing ? 'animate-spin' : ''}`}></i> {isEnhancing ? 'Enhancing...' : 'AI Enhance'}
             </button>
          </div>
          <textarea required rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what you need..." className="w-full bg-gray-50 p-4 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-brand/20 resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl text-sm font-bold outline-none appearance-none">
              {Object.keys(CATEGORY_MAP).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Subcategory</label>
            <select value={subcategory} onChange={e => setSubcategory(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl text-sm font-bold outline-none appearance-none">
              <option value="">General</option>
              {CATEGORY_MAP[category]?.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Budget (₦)</label>
          <input required type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="5000" className="w-full bg-gray-50 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20" />
        </div>

        <div>
           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Urgency</label>
           <div className="flex gap-2">
             {['normal', 'urgent', 'emergency'].map(u => (
               <button key={u} type="button" onClick={() => setUrgency(u)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${urgency === u ? 'bg-brand text-white' : 'bg-gray-50 text-gray-400'}`}>
                 {u}
               </button>
             ))}
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">State</label>
            <select value={selectedState} onChange={e => setSelectedState(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl text-sm font-bold outline-none appearance-none">
                {NIGERIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">LGA</label>
            <select value={selectedLGA} onChange={e => setSelectedLGA(e.target.value)} className="w-full bg-gray-50 p-4 rounded-2xl text-sm font-bold outline-none appearance-none" disabled={!NIGERIA_LGAS[selectedState]}>
                {NIGERIA_LGAS[selectedState]?.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white py-5 rounded-[28px] font-black uppercase tracking-widest shadow-xl mt-4">
          {loading ? 'Posting...' : 'Post Job'}
        </button>
      </form>
    </div>
  );
};

export default PostTask;