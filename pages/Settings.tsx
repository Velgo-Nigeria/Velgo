import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Profile, NotificationPreferences } from '../types';

interface SettingsProps { 
  profile: Profile | null; 
  onBack: () => void; 
  onNavigate: (view: string, data?: any) => void;
  onRefreshProfile: () => Promise<void> | void;
}

type ReAuthMode = 'bank' | null;

const Settings: React.FC<SettingsProps> = ({ profile, onBack, onNavigate, onRefreshProfile }) => {
  // UI State
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>(profile?.theme_mode || 'auto');
  
  // Detailed Notifications
  const defaultNotifs = {
    jobAlerts: true,
    renewals: true,
    reviews: true,
    security: true,
    promotions: false
  };
  const [notifications, setNotifications] = useState<NotificationPreferences>(profile?.notification_preferences || defaultNotifs);
  
  // Re-Authentication Modal State
  const [reAuthMode, setReAuthMode] = useState<ReAuthMode>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // Editable Fields
  const [newBankName, setNewBankName] = useState(profile?.bank_name || '');
  const [newAccountNum, setNewAccountNum] = useState(profile?.account_number || '');
  const [newAccountName, setNewAccountName] = useState(profile?.account_name || '');
  const [bankSaving, setBankSaving] = useState(false);
  
  const [emergencyName, setEmergencyName] = useState(profile?.emergency_contact_name || '');
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergency_contact_phone || '');
  const [emergencySaving, setEmergencySaving] = useState(false);
  
  const [signingOut, setSigningOut] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.email === 'admin.velgo@gmail.com'; 

  // Handlers
  const handleClearCache = async () => {
    if(window.confirm("This will reset the app and log you out. Continue?")) {
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear Cache API
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }
        
        // Unregister Service Worker
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for(let registration of registrations) {
                registration.unregister();
            }
        }
        
        // Sign out from Supabase and reload
        await supabase.auth.signOut();
        window.location.reload();
    }
  };

  const handleSignOut = async () => {
      setSigningOut(true);
      await supabase.auth.signOut();
  };

  const updatePreference = async (updates: Partial<Profile>) => {
      if(!profile) return;
      await supabase.from('profiles').update(updates).eq('id', profile.id);
      await onRefreshProfile();
  };

  const handleThemeChange = (mode: 'light' | 'dark' | 'auto') => {
      setThemeMode(mode);
      updatePreference({ theme_mode: mode });
      const isDark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  };

  const toggleNotif = (key: keyof NotificationPreferences) => {
      const updated = { ...notifications, [key]: !notifications[key] };
      setNotifications(updated);
      updatePreference({ notification_preferences: updated });
  };

  const handleReAuth = async () => {
    if (!profile?.id) return;
    setAuthLoading(true);
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email) {
            alert("Could not verify user identity. Please relogin.");
            setAuthLoading(false);
            return;
        }

        const { error } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: password
        });

        if (error) {
            alert("Incorrect password. Please try again.");
            setAuthLoading(false);
        } else {
            setIsVerified(true);
            setAuthLoading(false);
        }
    } catch (e) {
        alert("Verification failed due to network error.");
        setAuthLoading(false);
    }
  };

  const saveBankDetails = async () => {
    if (!profile?.id) return;
    if (!newAccountName || !newAccountNum || !newBankName) {
        alert("Please fill in all bank details.");
        return;
    }
    setBankSaving(true);
    const { error } = await supabase.from('profiles').update({
        bank_name: newBankName,
        account_number: newAccountNum,
        account_name: newAccountName
    }).eq('id', profile.id);
    setBankSaving(false);
    
    if (!error) {
        alert("Bank details updated securely.");
        await onRefreshProfile();
        setReAuthMode(null);
        setPassword('');
        setIsVerified(false);
    } else {
        if (error.code === '42703') alert("Database Error: Missing bank columns. Please run the SQL script.");
        else alert("Failed: " + error.message);
    }
  };

  const saveEmergencyContact = async () => {
      if (!profile?.id) return;
      setEmergencySaving(true);
      const { error } = await supabase.from('profiles').update({
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone
      }).eq('id', profile.id);
      setEmergencySaving(false);
      
      if (!error) {
          alert("Emergency contact updated.");
          await onRefreshProfile();
      } else {
          if (error.code === '42703') alert("Database Error: Missing emergency columns. Please run the SQL script.");
          else alert("Error saving contact: " + error.message);
      }
  };

  const ThemeIcon = () => {
      if (themeMode === 'auto') return <i className="fa-solid fa-circle-half-stroke text-gray-400"></i>;
      if (themeMode === 'dark') return <i className="fa-solid fa-moon text-purple-500"></i>;
      return <i className="fa-solid fa-sun text-orange-400"></i>;
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-40 transition-colors duration-200">
      <div className="bg-white dark:bg-gray-900 px-6 pt-10 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 sticky top-0 z-20 shadow-sm transition-colors duration-200">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
            <i className="fa-solid fa-chevron-left text-gray-500"></i>
        </button>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Settings</h1>
      </div>

      <div className="p-6 space-y-8 relative z-10">
        
        {isAdmin && (
            <button onClick={() => onNavigate('admin')} className="w-full bg-gray-900 text-white p-5 rounded-[24px] shadow-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><i className="fa-solid fa-shield-halved text-xs"></i></div>
                    <span className="text-sm font-black uppercase">Admin Dashboard</span>
                </div>
                <i className="fa-solid fa-arrow-right"></i>
            </button>
        )}

        {/* Account Management */}
        <section>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-2">Account Security</h3>
            <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <button onClick={() => onNavigate('change-password')} className="w-full p-5 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><i className="fa-solid fa-lock text-xs"></i></div>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Change Password</span>
                    </div>
                    <i className="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                </button>
                
                {profile?.role === 'worker' && (
                    <button onClick={() => { setReAuthMode('bank'); setIsVerified(false); setPassword(''); }} className="w-full p-5 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center"><i className="fa-solid fa-building-columns text-xs"></i></div>
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Bank Details</span>
                        </div>
                        <i className="fa-solid fa-pen text-gray-300 text-xs"></i>
                    </button>
                )}
            </div>
        </section>

        {/* Emergency Contact */}
        <section>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-2">Safety Protocols</h3>
            <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
                <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0"><i className="fa-solid fa-kit-medical text-xs"></i></div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">Emergency Contact</h4>
                        <p className="text-[10px] text-gray-400 font-medium">We'll contact this person if you flag an emergency during a gig.</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <input 
                        value={emergencyName} 
                        onChange={e => setEmergencyName(e.target.value)} 
                        placeholder="Contact Name" 
                        className="w-full bg-gray-50 dark:bg-gray-700 px-4 py-3 rounded-xl text-xs font-bold outline-none border border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-red-100 transition-all dark:text-white"
                    />
                    <input 
                        value={emergencyPhone} 
                        onChange={e => setEmergencyPhone(e.target.value)} 
                        placeholder="Contact Phone Number" 
                        type="tel"
                        className="w-full bg-gray-50 dark:bg-gray-700 px-4 py-3 rounded-xl text-xs font-bold outline-none border border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-red-100 transition-all dark:text-white"
                    />
                    <button 
                        onClick={saveEmergencyContact} 
                        disabled={emergencySaving}
                        className="w-full bg-gray-900 dark:bg-white dark:text-gray-900 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest"
                    >
                        {emergencySaving ? 'Saving...' : 'Update Safety Contact'}
                    </button>
                </div>
            </div>
        </section>

        {/* User Experience */}
        <section>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-2">App Experience</h3>
            <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden p-5 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ThemeIcon />
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Appearance</span>
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                        <button onClick={() => handleThemeChange('light')} className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${themeMode === 'light' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400'}`}>Light</button>
                        <button onClick={() => handleThemeChange('dark')} className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${themeMode === 'dark' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400'}`}>Dark</button>
                        <button onClick={() => handleThemeChange('auto')} className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${themeMode === 'auto' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400'}`}>Auto</button>
                    </div>
                </div>

                {/* Job Alerts Toggle */}
                <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <i className="fa-solid fa-bell text-gray-400"></i>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Job Alerts</span>
                     </div>
                     <button onClick={() => toggleNotif('jobAlerts')} className={`w-10 h-6 rounded-full transition-colors relative ${notifications.jobAlerts ? 'bg-brand' : 'bg-gray-200 dark:bg-gray-700'}`}>
                         <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${notifications.jobAlerts ? 'left-5' : 'left-1'}`} />
                     </button>
                </div>

                 <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <i className="fa-solid fa-broom text-gray-400"></i>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Reset App</span>
                     </div>
                     <button onClick={handleClearCache} className="text-[10px] font-black uppercase text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg">Clear Data</button>
                </div>
            </div>
        </section>

        {/* Legal & Compliance */}
        <section>
             <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-2">Legal</h3>
             <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                {['Terms of Service', 'Privacy Policy', 'Worker Guidelines'].map((item, i) => (
                    <button key={i} onClick={() => onNavigate('legal', item === 'Terms of Service' ? 'tos' : item === 'Privacy Policy' ? 'privacy' : 'guidelines')} className="w-full p-5 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 last:border-0 active:bg-gray-50 dark:active:bg-gray-700">
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{item}</span>
                        <i className="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </button>
                ))}
                <button onClick={() => onNavigate('safety')} className="w-full p-5 flex items-center justify-between active:bg-gray-50 dark:active:bg-gray-700">
                        <span className="text-sm font-bold text-red-500">Safety Center</span>
                        <i className="fa-solid fa-chevron-right text-red-300 text-xs"></i>
                </button>
             </div>
        </section>

        {/* RESTORED: Sign Out Button */}
        <button 
            onClick={handleSignOut} 
            disabled={signingOut} 
            className="w-full bg-red-50 dark:bg-red-900/20 p-5 rounded-[32px] flex items-center justify-between border border-red-100 dark:border-red-800 group active:scale-95 transition-all mt-4"
        >
            <span className="font-black text-red-600 dark:text-red-400 text-sm group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors">
                {signingOut ? 'Signing Out...' : 'Log Out'}
            </span>
            <i className="fa-solid fa-right-from-bracket text-red-400 dark:text-red-500 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors"></i>
        </button>

        <div className="pt-4 text-center">
            <p className="text-[10px] text-gray-300 font-mono uppercase">Version 1.0.3 (Edo Build)</p>
        </div>

      </div>

      {/* Re-Auth / Bank Modal */}
      {reAuthMode === 'bank' && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white dark:bg-gray-800 rounded-[32px] p-6 w-full max-w-sm space-y-4">
                  <div className="flex justify-between items-center">
                      <h3 className="text-lg font-black text-gray-900 dark:text-white">Bank Details</h3>
                      <button onClick={() => { setReAuthMode(null); setPassword(''); }} className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-300"><i className="fa-solid fa-xmark"></i></button>
                  </div>

                  {!isVerified ? (
                      <div className="space-y-4">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 p-3 rounded-xl">
                              <i className="fa-solid fa-lock mr-2"></i>Security Check Required
                          </p>
                          <input 
                              type={showPassword ? "text" : "password"} 
                              value={password} 
                              onChange={e => setPassword(e.target.value)} 
                              placeholder="Enter Password to Edit" 
                              className="w-full bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl text-sm font-bold outline-none dark:text-white" 
                          />
                           <button onClick={() => setShowPassword(!showPassword)} className="text-[10px] font-black uppercase text-gray-400">{showPassword ? 'Hide' : 'Show'} Password</button>
                          <button 
                              onClick={handleReAuth} 
                              disabled={authLoading || !password} 
                              className="w-full bg-gray-900 dark:bg-white dark:text-gray-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-50"
                          >
                              {authLoading ? 'Verifying...' : 'Unlock'}
                          </button>
                      </div>
                  ) : (
                      <div className="space-y-3">
                          <p className="text-[10px] font-black text-green-500 uppercase tracking-widest text-center mb-2">Identity Verified</p>
                          <input value={newBankName} onChange={e => setNewBankName(e.target.value)} placeholder="Bank Name (e.g. GTBank)" className="w-full bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl text-sm font-bold outline-none dark:text-white" />
                          <input value={newAccountNum} onChange={e => setNewAccountNum(e.target.value)} placeholder="Account Number" type="tel" className="w-full bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl text-sm font-bold outline-none dark:text-white" />
                          <input value={newAccountName} onChange={e => setNewAccountName(e.target.value)} placeholder="Account Name" className="w-full bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl text-sm font-bold outline-none dark:text-white" />
                          <button 
                              onClick={saveBankDetails} 
                              disabled={bankSaving} 
                              className="w-full bg-brand text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-50"
                          >
                              {bankSaving ? 'Saving...' : 'Save Details'}
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;