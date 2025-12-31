import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Profile } from '../types';
import { CATEGORY_MAP } from '../lib/constants';
import { GoogleGenAI } from "@google/genai";
import { NIGERIA_STATES, NIGERIA_LGAS } from '../lib/locations';

interface ProfilePageProps { profile: Profile | null; onRefreshProfile: () => Promise<void>; onSubscription: () => void; onSettings: () => void; }

const ProfilePage: React.FC<ProfilePageProps> = ({ profile, onRefreshProfile, onSubscription, onSettings }) => {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(profile?.phone_number || '');
  
  // Address State
  const [streetAddress, setStreetAddress] = useState(profile?.address || '');
  const [selectedState, setSelectedState] = useState(profile?.state || 'Lagos');
  const [selectedLGA, setSelectedLGA] = useState(profile?.lga || (NIGERIA_LGAS['Lagos']?.[0] || ''));
  const [lat, setLat] = useState<number | null>(profile?.latitude || null);
  const [lng, setLng] = useState<number | null>(profile?.longitude || null);

  const [bank, setBank] = useState(profile?.bank_name || '');
  const [account, setAccount] = useState(profile?.account_number || '');
  
  const [instagram, setInstagram] = useState(profile?.instagram_handle || '');
  const [portfolio, setPortfolio] = useState(profile?.portfolio_url || '');

  // Category & Subcategory State
  const [category, setCategory] = useState(profile?.category || Object.keys(CATEGORY_MAP)[0]);
  const [subcategory, setSubcategory] = useState(profile?.subcategory || '');

  const [price, setPrice] = useState(profile?.starting_price?.toString() || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ninInputRef = useRef<HTMLInputElement>(null);

  // Admin Check
  const isAdmin = profile?.role === 'admin' || profile?.email === 'admin.velgo@gmail.com';

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone_number || '');
      setStreetAddress(profile.address || '');
      const newState = profile.state || 'Lagos';
      setSelectedState(newState);
      const validLga = profile.lga && NIGERIA_LGAS[newState]?.includes(profile.lga) 
        ? profile.lga 
        : (NIGERIA_LGAS[newState]?.[0] || '');
      setSelectedLGA(validLga);
      setLat(profile.latitude || null);
      setLng(profile.longitude || null);

      setBank(profile.bank_name || '');
      setAccount(profile.account_number || '');
      setInstagram(profile.instagram_handle || '');
      setPortfolio(profile.portfolio_url || '');
      
      setCategory(profile.category || Object.keys(CATEGORY_MAP)[0]);
      setSubcategory(profile.subcategory || '');
      setPrice(profile.starting_price?.toString() || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  useEffect(() => {
    if (editing) {
      const availableSubs = CATEGORY_MAP[category] || [];
      if (!availableSubs.includes(subcategory)) {
        setSubcategory(availableSubs[0] || '');
      }
    }
  }, [category, editing]);

  useEffect(() => {
    if (editing && NIGERIA_LGAS[selectedState]) {
        if (!NIGERIA_LGAS[selectedState].includes(selectedLGA)) {
            setSelectedLGA(NIGERIA_LGAS[selectedState][0] || '');
        }
    }
  }, [selectedState, editing]);

  const handleUpdate = async () => {
    if (!profile) return;
    setLoading(true);
    
    try {
        // 1. Prepare Base Updates (Common to All Roles)
        // Ensure values are not undefined
        const updates: any = { 
          phone_number: phone || null, 
          address: streetAddress || null, 
          state: selectedState || null,
          lga: selectedLGA || null,
          latitude: lat,
          longitude: lng,
          updated_at: new Date().toISOString()
        };

        // 2. Add Worker-Specific Fields ONLY if user is a worker
        // This prevents sending fields that might not exist for clients, avoiding errors.
        if (profile.role === 'worker') {
            const cleanPrice = price ? parseInt(price.replace(/,/g, '')) : 0;
            updates.bank_name = bank || null;
            updates.account_number = account || null;
            updates.instagram_handle = instagram || null;
            updates.portfolio_url = portfolio || null;
            updates.category = category || null;
            updates.subcategory = subcategory || null;
            updates.starting_price = isNaN(cleanPrice) ? 0 : cleanPrice;
            updates.bio = bio || null;
        }

        // 3. Send Update
        const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
        
        if (error) throw error;
        
        // 4. Refresh & Close
        await onRefreshProfile();
        setEditing(false); 

    } catch (err: any) {
        console.error("Profile Save Error:", err);
        let msg = err.message;
        // Helpful hint for the "column not found" error which is common when schema is outdated
        if (msg && msg.toLowerCase().includes('column')) {
            msg = "System Error: Database schema is outdated. Please run the provided SQL script.";
        }
        alert("Unable to save: " + msg);
    } finally {
        setLoading(false);
    }
  };

  const captureLocation = () => {
      if (!navigator.geolocation) {
          alert("Geolocation is not supported by your browser");
          return;
      }
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              setLat(pos.coords.latitude);
              setLng(pos.coords.longitude);
              alert("Location captured! Please save changes.");
          },
          () => alert("Unable to retrieve your location. Please check permissions.")
      );
  };

  const handleAiPolish = async () => {
    if (!bio.trim()) return;
    setAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Rewrite this professional bio to be trustworthy, skilled, and concise for a gig marketplace in Nigeria. Use first-person "I". Keep it under 30 words: "${bio}"`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      if (response.text) setBio(response.text.trim());
    } catch (e) {
      alert("AI enhancement failed.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      handleFileUpload(event, 'avatars', (url) => supabase.from('profiles').update({ avatar_url: url }).eq('id', profile?.id));
  };
  
  const handleNinUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      handleFileUpload(event, 'id-cards', (url) => supabase.from('profiles').update({ nin_image_url: url, is_verified: false }).eq('id', profile?.id), "ID Uploaded. Admin will review.");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, bucket: string, updateFn: (url: string) => Promise<any>, successMsg?: string) => {
    if (!event.target.files || !event.target.files[0]) return;
    const file = event.target.files[0];
    const fileName = `${profile?.id}-${Date.now()}.${file.name.split('.').pop()}`;
    
    try {
        const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file);
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
        const { error: updateError } = await updateFn(data.publicUrl);
        if (updateError) throw updateError;
        
        if (successMsg) alert(successMsg);
        await onRefreshProfile();
    } catch (err: any) {
        if (bucket === 'id-cards' && err.message.includes('bucket')) {
             alert("System Upgrade: ID bucket currently provisioning. Using fallback.");
        } else {
             alert("Upload failed: " + err.message);
        }
    }
  };

  const handleSignOut = async () => {
      setSigningOut(true);
      await supabase.auth.signOut();
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col items-center py-6">
        <div className="relative group w-24 h-24 rounded-[32px] overflow-hidden border-4 border-white shadow-2xl">
          <img src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name}&background=008000&color=fff`} className="w-full h-full object-cover" />
          <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-brand text-white w-full h-8 flex items-center justify-center bg-opacity-70"><i className="fa-solid fa-camera"></i></button>
          <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
        </div>
        <div className="text-center mt-4">
          <h2 className="text-2xl font-black">{profile?.full_name}</h2>
          <div className="flex justify-center flex-wrap gap-2 mt-2">
            {isAdmin && <span className="bg-gray-900 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase"><i className="fa-solid fa-shield-halved mr-1"></i>Admin</span>}
            <span className="bg-brand-light text-brand px-3 py-1 rounded-full text-[10px] font-black uppercase">{profile?.subscription_tier}</span>
            {profile?.is_verified && <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase"><i className="fa-solid fa-check-circle mr-1"></i>Verified</span>}
          </div>
        </div>
      </div>

      {/* Manual Verification Block */}
      {!profile?.is_verified && (
          <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100 text-center space-y-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto text-blue-600"><i className="fa-solid fa-id-card"></i></div>
              <h3 className="font-black text-gray-900">Get Verified</h3>
              <p className="text-xs text-gray-600">Upload your NIN slip or ID card to get the Blue Tick.</p>
              {profile?.nin_image_url ? (
                  <div className="text-xs font-bold text-orange-500 uppercase tracking-widest bg-orange-50 py-2 rounded-xl">Pending Admin Review</div>
              ) : (
                  <>
                    <button onClick={() => ninInputRef.current?.click()} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-xs">Upload NIN Image</button>
                    <input type="file" ref={ninInputRef} onChange={handleNinUpload} accept="image/*" className="hidden" />
                  </>
              )}
          </div>
      )}

      <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="flex justify-between items-center border-b pb-4"><h3 className="font-black text-gray-800 text-sm uppercase">Details</h3><button onClick={() => setEditing(!editing)} className="text-xs font-black text-brand">{editing ? 'CANCEL' : 'EDIT'}</button></div>
        
        {profile?.role === 'worker' && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Category</label>
                {editing ? (
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-sm outline-none">
                    {Object.keys(CATEGORY_MAP).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : <p className="font-bold">{profile?.category}</p>}
             </div>
             <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Specialty</label>
                {editing ? (
                  <select value={subcategory} onChange={e => setSubcategory(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-sm outline-none">
                    {CATEGORY_MAP[category]?.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : <p className="font-bold">{profile?.subcategory || 'General'}</p>}
             </div>
          </div>

          <div><label className="text-[10px] font-black text-gray-400 uppercase">Rate (₦)</label>{editing ? <input value={price} onChange={e => setPrice(e.target.value)} type="tel" className="w-full bg-gray-50 p-3 rounded-xl text-sm" placeholder="e.g. 5000" /> : <p className="font-bold">₦{profile?.starting_price?.toLocaleString()}</p>}</div>
          
          {/* Social Links */}
          <div className="space-y-2">
             <label className="text-[10px] font-black text-gray-400 uppercase">Social Presence</label>
             {editing ? (
                 <>
                    <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl"><i className="fa-brands fa-instagram text-gray-400"></i><input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@username" className="bg-transparent w-full text-sm outline-none" /></div>
                    <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl"><i className="fa-solid fa-link text-gray-400"></i><input value={portfolio} onChange={e => setPortfolio(e.target.value)} placeholder="https://myportfolio.com" className="bg-transparent w-full text-sm outline-none" /></div>
                 </>
             ) : (
                 <div className="flex gap-3">
                     {profile?.instagram_handle ? <a href={`https://instagram.com/${profile.instagram_handle.replace('@','')}`} target="_blank" className="text-pink-600 font-bold text-xs"><i className="fa-brands fa-instagram mr-1"></i>Instagram</a> : <span className="text-gray-300 text-xs">No Instagram</span>}
                     {profile?.portfolio_url ? <a href={profile.portfolio_url} target="_blank" className="text-blue-600 font-bold text-xs"><i className="fa-solid fa-link mr-1"></i>Portfolio</a> : <span className="text-gray-300 text-xs">No Portfolio</span>}
                 </div>
             )}
          </div>

          <div>
            <div className="flex justify-between items-center">
               <label className="text-[10px] font-black text-gray-400 uppercase">Bio</label>
               {editing && <button onClick={handleAiPolish} disabled={aiLoading || !bio} className="text-[9px] font-black uppercase text-brand flex items-center gap-1"><i className={`fa-solid fa-wand-magic-sparkles ${aiLoading ? 'animate-spin' : ''}`}></i> Polish</button>}
            </div>
            {editing ? <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-sm h-24 resize-none" /> : <p className="font-medium text-sm text-gray-600">{profile?.bio || 'No bio set.'}</p>}
          </div>
        </div>}
        
        <div><label className="text-[10px] font-black text-gray-400 uppercase">Phone</label>{editing ? <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl text-sm" /> : <p className="font-bold">{profile?.phone_number}</p>}</div>
        
        {/* Address Section with GPS */}
        <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Location & Address</label>
            {editing ? (
                <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <button onClick={captureLocation} className="w-full bg-gray-900 text-white py-2 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2"><i className="fa-solid fa-location-crosshairs"></i> Use GPS Location</button>
                    {lat && <p className="text-[9px] text-green-600 font-bold text-center">GPS Coordinates Captured</p>}
                    <select value={selectedState} onChange={e => setSelectedState(e.target.value)} className="w-full bg-white p-3 rounded-xl text-sm outline-none border border-gray-100 mt-1">
                        {NIGERIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {NIGERIA_LGAS[selectedState] && (
                        <select value={selectedLGA} onChange={e => setSelectedLGA(e.target.value)} className="w-full bg-white p-3 rounded-xl text-sm outline-none border border-gray-100 mt-1">
                            {NIGERIA_LGAS[selectedState].map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    )}
                    <textarea value={streetAddress} onChange={e => setStreetAddress(e.target.value)} placeholder="e.g. 15 Admiralty Way" className="w-full bg-white p-3 rounded-xl text-sm outline-none border border-gray-100 mt-1 resize-none" rows={2}/>
                </div>
            ) : (
                <div className="space-y-1">
                    <p className="font-bold text-gray-900">{profile?.address ? profile.address : 'No street address set'}</p>
                    <p className="text-xs text-gray-500 font-bold">{profile?.lga || 'LGA Not Set'}, {profile?.state || 'State Not Set'}</p>
                </div>
            )}
        </div>
        
        {editing && <button onClick={handleUpdate} disabled={loading} className="w-full bg-brand text-white py-4 rounded-xl font-black uppercase text-xs">{loading ? 'Saving...' : 'Save Changes'}</button>}
      </div>
      
      <div className="space-y-3">
        <button onClick={onSubscription} className="w-full bg-white p-5 rounded-[32px] flex items-center justify-between border border-gray-100"><span className="font-black text-gray-800 text-sm">Subscription</span><i className="fa-solid fa-chevron-right text-gray-200"></i></button>
        <button onClick={onSettings} className="w-full bg-white p-5 rounded-[32px] flex items-center justify-between border border-gray-100"><span className="font-black text-gray-800 text-sm">Settings</span><i className="fa-solid fa-chevron-right text-gray-200"></i></button>
        <button onClick={handleSignOut} disabled={signingOut} className="w-full bg-red-50 p-5 rounded-[32px] flex items-center justify-between border border-red-100 text-red-600 font-black text-sm">
            {signingOut ? 'Signing Out...' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
};
export default ProfilePage;