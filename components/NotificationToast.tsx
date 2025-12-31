import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'alert';
  onClose: () => void;
}

export const NotificationToast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    info: 'bg-gray-900 text-white',
    success: 'bg-brand text-white',
    alert: 'bg-red-600 text-white'
  };

  const icons = {
    info: 'fa-bell',
    success: 'fa-check-circle',
    alert: 'fa-circle-exclamation'
  };

  return (
    <div className={`fixed top-4 left-4 right-4 z-[70] p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-fadeIn ${colors[type]}`}>
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
        <i className={`fa-solid ${icons[type]}`}></i>
      </div>
      <div className="flex-1">
        <p className="text-xs font-black uppercase tracking-widest opacity-80">Notification</p>
        <p className="text-sm font-bold">{message}</p>
      </div>
      <button onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
    </div>
  );
};