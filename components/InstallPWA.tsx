import React, { useEffect, useState } from 'react';

export const InstallPWA: React.FC = () => {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const onClick = (evt: React.MouseEvent) => {
    evt.preventDefault();
    if (!promptInstall) return;
    promptInstall.prompt();
  };

  if (!supportsPWA) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[60] animate-fadeIn">
        <div className="bg-gray-900 dark:bg-gray-800 text-white p-4 rounded-[24px] shadow-2xl flex items-center justify-between border border-gray-700/50 backdrop-blur-md">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                    <i className="fa-solid fa-download"></i>
                </div>
                <div>
                    <p className="text-sm font-black">Install Velgo</p>
                    <p className="text-[10px] text-gray-400">Add to Home Screen</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setSupportsPWA(false)} className="w-8 h-8 rounded-full bg-transparent text-gray-500 hover:text-white transition-colors"><i className="fa-solid fa-xmark"></i></button>
                <button onClick={onClick} className="bg-brand text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform">Install</button>
            </div>
        </div>
    </div>
  );
};