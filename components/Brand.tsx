import React from 'react';

export const ShieldIcon: React.FC<{ className?: string }> = ({ className = "h-12 w-auto" }) => (
  <svg className={className} viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 0L10 15V45C10 70 50 95 50 95C50 95 90 70 90 45V15L50 0Z" fill="#E5E7EB" />
    <path d="M50 5L15 20V45C15 65 50 85 50 85C50 85 85 65 85 45V20L50 5Z" fill="white" />
    <path d="M30 45L45 60L75 30" stroke="#008000" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const VelgoLogo: React.FC<{ variant?: 'light' | 'dark', className?: string }> = ({ variant = 'dark', className = "h-12 w-auto" }) => {
  const textColor = variant === 'dark' ? '#000000' : '#FFFFFF';
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <ShieldIcon className="h-full w-auto" />
      <div className="flex flex-col">
        <span style={{ color: textColor }} className="text-2xl font-black italic tracking-tighter leading-none">VELGO</span>
        <span className="text-[#008000] text-[10px] font-black uppercase tracking-[3px] leading-none mt-1">NIGERIA</span>
      </div>
    </div>
  );
};