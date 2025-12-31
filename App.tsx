
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabaseClient';
import { Profile } from './types';
import Landing from './pages/Landing';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Home from './pages/Home';
import Activity from './pages/Activity';
import Messages from './pages/Messages';
import ProfilePage from './pages/Profile';
import Subscription from './pages/Subscription';
import Chat from './pages/Chat';
import WorkerDetail from './pages/WorkerDetail';
import TaskDetail from './pages/TaskDetail';
import Settings from './pages/Settings';
import ResetPassword from './pages/ResetPassword';
import PostTask from './pages/PostTask';
import CompleteProfile from './pages/CompleteProfile';
import Legal from './pages/Legal';
import Safety from './pages/Safety';
import AdminDashboard from './pages/AdminDashboard';
import { ShieldIcon } from './components/Brand';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InstallPWA } from './components/InstallPWA';
import { NotificationToast } from './components/NotificationToast';
import { UserGuide } from './components/UserGuide';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null); // New state for critical errors
  const [view, setView] = useState<any>('landing');
  const [viewData, setViewData] = useState<any>(null);
  
  // Notification State
  const [toast, setToast] = useState<{msg: string, type: 'info'|'success'|'alert'} | null>(null);
  
  // User Guide State
  const [showGuide, setShowGuide] = useState(false);

  const viewRef = useRef(view);
  const viewDataRef = useRef(viewData);

  useEffect(() => { 
    viewRef.current = view; 
    viewDataRef.current = viewData;
  }, [view, viewData]);

  // Apply Theme Effect
  useEffect(() => {
    const applyTheme = (mode: string) => {
      const isDark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    if (profile?.theme_mode) {
      applyTheme(profile.theme_mode);
    } else {
      applyTheme('auto'); // Default
    }
  }, [profile?.theme_mode]);

  const fetchProfile = useCallback(async (uid: string, retries = 3) => {
    // We request the profile. If it returns error or no data, we retry a few times.
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
    
    if (error) {
      // Check for critical RLS recursion or system errors
      if (error.message && (error.message.includes('recursion') || error.message.includes('policy'))) {
         console.error("Critical Policy Error:", error);
         setSystemError("Database Policy Error. Please run the provided SQL script in Supabase.");
         setLoading(false);
         return;
      }
    }

    if (data) {
      setProfile(data);
      setProfileError(false);
      setSystemError(null);
      
      // Show guide if new user (less than 5 mins old)
      const created = new Date(data.created_at || Date.now()).getTime();
      if (Date.now() - created < 5 * 60 * 1000) {
          if (!localStorage.getItem('guideShown')) {
              setShowGuide(true);
              localStorage.setItem('guideShown', 'true');
          }
      }
    } else {
      if (retries > 0) {
        // Linear backoff: 500ms, 1000ms, 1500ms...
        await new Promise(r => setTimeout(r, 500));
        fetchProfile(uid, retries - 1);
      } else {
        // Retries exhausted, profile likely missing (Ghost User)
        setProfileError(true);
      }
    }
  }, []);

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        const initialSession = data.session;
        setSession(initialSession);
        
        if (initialSession) {
          fetchProfile(initialSession.user.id);
          if (['landing', 'login', 'signup'].includes(viewRef.current)) {
              setView('home');
          }
        }
      } catch (err) {
        console.warn("Network error during session init:", err);
        // We do not set systemError here to allow user to try logging in manually
      } finally {
        setLoading(false);
      }
    };
    
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      
      if (event === 'PASSWORD_RECOVERY') {
         // CRITICAL: Handle the incoming link from email
         setView('reset-password');
      }
      else if (currentSession) {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
           // On Sign In, try strictly 3 times then fail to CompleteProfile
           fetchProfile(currentSession.user.id, 3);
           
           // CRITICAL FIX: Only redirect to home if currently on an auth page.
           // This prevents re-auth (Settings page) from kicking user back to home.
           if (viewRef.current === 'landing' || viewRef.current === 'login' || viewRef.current === 'signup') {
              setView('home');
           }
        }
      } else {
        setProfile(null);
        setProfileError(false);
        setSystemError(null);
        // If we are not in reset-password flow, go to landing
        if (viewRef.current !== 'reset-password') {
            setView('landing');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]); 

  // Real-time Notifications Listener
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase.channel('realtime_notifications')
        .on(
            'postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${session.user.id}` }, 
            (payload) => {
                if (viewRef.current === 'chat' && viewDataRef.current === payload.new.sender_id) return;
                setToast({ msg: 'New Message Received', type: 'info' });
            }
        )
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'bookings', filter: `worker_id=eq.${session.user.id}` },
            () => setToast({ msg: 'New Job Request!', type: 'success' })
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `client_id=eq.${session.user.id}` },
            (payload) => {
                if (payload.new.status === 'accepted') setToast({ msg: 'Worker Accepted Your Job!', type: 'success' });
            }
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  if (loading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900">
      <ShieldIcon className="h-20 animate-pulse text-brand" />
      <p className="mt-4 text-[10px] font-black text-gray-400 uppercase tracking-[4px]">Velgo Hub Edo</p>
    </div>
  );

  // Show System Error Screen if RLS fails
  if (systemError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-8 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-500 animate-pulse">
                <i className="fa-solid fa-server text-2xl"></i>
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">System Update Needed</h2>
            <p className="text-sm text-gray-500 max-w-xs mx-auto mb-6">{systemError}</p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
                <button onClick={() => window.location.reload()} className="w-full px-6 py-4 bg-gray-900 text-white rounded-2xl text-xs font-bold uppercase shadow-lg">
                    Retry Connection
                </button>
                <button 
                    onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }} 
                    className="w-full px-6 py-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl text-xs font-bold uppercase"
                >
                    Log Out
                </button>
            </div>
        </div>
      );
  }

  const navigate = (newView: string, data: any = null) => {
    setView(newView);
    setViewData(data);
    window.scrollTo(0, 0);
  };

  const renderContent = () => {
    if (!session) {
      switch (view) {
        case 'login': return <Login onToggle={() => setView('signup')} />;
        case 'signup': return <SignUp onToggle={() => setView('login')} initialRole={viewData || 'client'} />;
        case 'reset-password': return <ResetPassword onSuccess={() => setView('login')} />;
        case 'legal': return <Legal initialTab={viewData} onBack={() => setView('landing')} />;
        default: return <Landing onGetStarted={(role) => navigate('signup', role)} onLogin={() => setView('login')} onViewLegal={(tab) => navigate('legal', tab)} />;
      }
    }

    // Critical: If profile fetch failed, show CompleteProfile (Recovery Mode)
    if (profileError && !profile) {
      return <CompleteProfile session={session} onComplete={() => fetchProfile(session.user.id, 5)} />;
    }

    switch (view) {
      case 'home': return <Home profile={profile} onViewWorker={(id) => navigate('worker-detail', id)} onViewTask={(id) => navigate('task-detail', id)} onRefreshProfile={() => fetchProfile(session.user.id)} onUpgrade={() => setView('subscription')} onPostTask={() => navigate('post-task')} onShowGuide={() => setShowGuide(true)} />;
      case 'activity': return <Activity profile={profile} onOpenChat={(id) => navigate('chat', id)} onRefreshProfile={() => fetchProfile(session.user.id)} onUpgrade={() => setView('subscription')} />;
      case 'messages': return <Messages profile={profile} onOpenChat={(id) => navigate('chat', id)} />;
      case 'profile': return <ProfilePage profile={profile} onRefreshProfile={() => fetchProfile(session.user.id)} onSubscription={() => setView('subscription')} onSettings={() => setView('settings')} />;
      case 'subscription': return <Subscription profile={profile} sessionEmail={session?.user?.email} onRefreshProfile={() => fetchProfile(session.user.id)} onBack={() => setView('profile')} />;
      case 'chat': return <Chat profile={profile} partnerId={viewData} onBack={() => setView('messages')} />;
      case 'worker-detail': return <WorkerDetail profile={profile} workerId={viewData} onBack={() => setView('home')} onBook={(id) => navigate('chat', id)} onRefreshProfile={() => fetchProfile(session.user.id)} onUpgrade={() => setView('subscription')} />;
      case 'task-detail': return <TaskDetail profile={profile} taskId={viewData} onBack={() => setView('home')} onUpgrade={() => setView('subscription')} />;
      case 'settings': return <Settings profile={profile} onBack={() => setView('profile')} onNavigate={navigate} onRefreshProfile={() => fetchProfile(session.user.id)} />;
      case 'post-task': return <PostTask profile={profile} onRefreshProfile={() => fetchProfile(session.user.id)} onBack={() => setView('home')} onUpgrade={() => setView('subscription')} />;
      case 'legal': return <Legal initialTab={viewData} onBack={() => setView('settings')} />;
      case 'safety': return <Safety profile={profile} onBack={() => setView('settings')} />;
      case 'admin': return <AdminDashboard onBack={() => setView('settings')} />;
      case 'change-password': return <ResetPassword onSuccess={() => { alert('Password Updated'); setView('settings'); }} />;
      case 'reset-password': return <ResetPassword onSuccess={() => { alert('Password Updated. Please log in.'); setView('login'); }} />;
      default: return <Home profile={profile} onViewWorker={(id) => navigate('worker-detail', id)} onViewTask={(id) => navigate('task-detail', id)} onRefreshProfile={() => fetchProfile(session.user.id)} onUpgrade={() => setView('subscription')} onPostTask={() => navigate('post-task')} onShowGuide={() => setShowGuide(true)} />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-white dark:bg-gray-900 max-w-md mx-auto relative shadow-2xl flex flex-col transition-colors duration-200">
        <div className="flex-1">
          {renderContent()}
        </div>
        
        {toast && <NotificationToast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        {showGuide && <UserGuide onClose={() => setShowGuide(false)} />}
        <InstallPWA />

        {session && profile && view !== 'admin' && view !== 'chat' && view !== 'reset-password' && (
          <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 flex justify-around items-center h-20 safe-bottom z-50 transition-colors duration-200 shadow-lg">
            <button onClick={() => setView('home')} className={`flex flex-col items-center flex-1 transition-all active:scale-90 ${['home', 'worker-detail', 'task-detail', 'post-task'].includes(view) ? 'text-brand' : 'text-gray-300 dark:text-gray-600'}`}>
              <i className="fa-solid fa-house-chimney text-xl"></i>
              <span className="text-[9px] font-black uppercase mt-1">Market</span>
            </button>
            <button onClick={() => setView('activity')} className={`flex flex-col items-center flex-1 transition-all active:scale-90 ${['activity'].includes(view) ? 'text-brand' : 'text-gray-300 dark:text-gray-600'}`}>
              <i className="fa-solid fa-bolt-lightning text-xl"></i>
              <span className="text-[9px] font-black uppercase mt-1">Gigs</span>
            </button>
             <button onClick={() => setView('messages')} className={`flex flex-col items-center flex-1 transition-all active:scale-90 ${['messages', 'chat'].includes(view) ? 'text-brand' : 'text-gray-300 dark:text-gray-600'}`}>
              <i className="fa-solid fa-comments text-xl"></i>
              <span className="text-[9px] font-black uppercase mt-1">Chats</span>
            </button>
            <button onClick={() => setView('profile')} className={`flex flex-col items-center flex-1 transition-all active:scale-90 ${['profile', 'subscription', 'settings', 'legal', 'safety', 'change-password'].includes(view) ? 'text-brand' : 'text-gray-300 dark:text-gray-600'}`}>
              <i className="fa-solid fa-user-ninja text-xl"></i>
              <span className="text-[9px] font-black uppercase mt-1">Profile</span>
            </button>
          </nav>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
