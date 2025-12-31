import React, { useState } from 'react';
import { VelgoLogo } from './Brand';

interface UserGuideProps {
  onClose: () => void;
}

export const UserGuide: React.FC<UserGuideProps> = ({ onClose }) => {
  const [role, setRole] = useState<'client' | 'worker' | null>(null);
  const [step, setStep] = useState(0);

  const clientSlides = [
    {
      title: "Hire Directly",
      text: "Found a worker you like? Tap their profile in the Market tab and hit 'INITIATE BOOKING' to send a request directly.",
      icon: "fa-hand-pointer",
      color: "bg-brand"
    },
    {
      title: "Post a Job",
      text: "Want people to come to you? Tap 'Post a Job' on the Home screen. Describe the task, set a budget, and workers will apply.",
      icon: "fa-bullhorn",
      color: "bg-purple-600"
    },
    {
      title: "Get Verified (NIN)",
      text: "Build trust! Go to your Profile page. If you aren't verified, tap the Blue Box to upload your NIN or ID card securely.",
      icon: "fa-id-card",
      color: "bg-blue-600"
    },
    {
      title: "Subscriptions",
      text: "Hit your booking limit? Go to Profile > Subscription. Upgrading lets you hire more workers and access premium support.",
      icon: "fa-crown",
      color: "bg-yellow-600"
    },
    {
      title: "Rate & Secure",
      text: "After a job is marked 'Completed' in the Activity tab, rate the worker. To change your password, go to Profile > Settings.",
      icon: "fa-lock",
      color: "bg-gray-900"
    }
  ];

  const workerSlides = [
    {
      title: "Apply for Jobs",
      text: "Go to the 'Market' tab. Tap on a Job Post to see details. Check the budget and location, then hit 'Apply Now'.",
      icon: "fa-briefcase",
      color: "bg-brand"
    },
    {
      title: "Accepting Gigs",
      text: "Check the 'Activity' tab. Look for 'Requests' (Direct Hires). You can Accept or Decline them here.",
      icon: "fa-circle-check",
      color: "bg-green-600"
    },
    {
      title: "Get Verified",
      text: "Essential for trust! Go to Profile, tap the ID upload section. Submit your NIN to get the Blue Tick and more jobs.",
      icon: "fa-address-card",
      color: "bg-blue-600"
    },
    {
      title: "Boost Your Tier",
      text: "Can't apply to more jobs? Go to Profile > Subscription. Higher tiers mean more applications and better visibility.",
      icon: "fa-layer-group",
      color: "bg-orange-600"
    },
    {
      title: "Rate Clients",
      text: "Safety goes both ways. After a job is completed, go to your Activity history to rate your experience with the client.",
      icon: "fa-star",
      color: "bg-gray-900"
    }
  ];

  const activeSlides = role === 'client' ? clientSlides : workerSlides;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
      <div className="bg-white rounded-[40px] w-full max-w-sm overflow-hidden shadow-2xl relative min-h-[400px] flex flex-col">
        
        {/* Header / Close */}
        <div className="absolute top-4 right-4 z-20">
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/20 text-white flex items-center justify-center hover:bg-black/40"><i className="fa-solid fa-xmark"></i></button>
        </div>

        {!role ? (
            // ROLE SELECTION SCREEN
            <div className="p-8 flex flex-col items-center justify-center flex-1 space-y-6 text-center">
                <VelgoLogo className="h-10 mb-2" />
                <h2 className="text-2xl font-black text-gray-900">How can we help?</h2>
                <p className="text-sm text-gray-500 font-medium">Select your role to see the guide.</p>
                
                <button onClick={() => setRole('client')} className="w-full bg-brand text-white p-5 rounded-[24px] shadow-xl flex items-center gap-4 active:scale-95 transition-transform text-left">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl"><i className="fa-solid fa-user-tie"></i></div>
                    <div>
                        <p className="text-xs font-black uppercase opacity-80">I am a</p>
                        <p className="text-lg font-black">Client</p>
                    </div>
                </button>

                <button onClick={() => setRole('worker')} className="w-full bg-gray-900 text-white p-5 rounded-[24px] shadow-xl flex items-center gap-4 active:scale-95 transition-transform text-left">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl"><i className="fa-solid fa-helmet-safety"></i></div>
                    <div>
                        <p className="text-xs font-black uppercase opacity-80">I am a</p>
                        <p className="text-lg font-black">Worker</p>
                    </div>
                </button>
            </div>
        ) : (
            // TUTORIAL SLIDER
            <>
                <div className={`h-48 ${activeSlides[step].color} flex items-center justify-center relative transition-colors duration-300`}>
                    <i className={`fa-solid ${activeSlides[step].icon} text-8xl text-white opacity-20 absolute scale-150`}></i>
                    <i className={`fa-solid ${activeSlides[step].icon} text-5xl text-white relative z-10 animate-bounce`}></i>
                    <div className="absolute top-4 left-4">
                        <button onClick={() => { setRole(null); setStep(0); }} className="px-3 py-1 bg-black/20 text-white rounded-full text-[10px] font-bold uppercase"><i className="fa-solid fa-arrow-left mr-1"></i> Back</button>
                    </div>
                </div>
                
                <div className="p-8 text-center space-y-4 flex-1 flex flex-col">
                    <h2 className="text-2xl font-black text-gray-900">{activeSlides[step].title}</h2>
                    <p className="text-sm text-gray-500 font-medium leading-relaxed">
                        {activeSlides[step].text}
                    </p>
                    
                    <div className="flex justify-center gap-2 pt-4 mt-auto">
                        {activeSlides.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 ' + activeSlides[step].color : 'w-2 bg-gray-200'}`} />
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                    <button 
                        onClick={() => {
                            if (step > 0) setStep(step - 1);
                        }} 
                        className={`text-gray-400 font-bold text-xs uppercase p-2 ${step === 0 ? 'opacity-0 pointer-events-none' : ''}`}
                    >
                        Previous
                    </button>
                    
                    <button 
                        onClick={() => {
                            if (step < activeSlides.length - 1) setStep(step + 1);
                            else onClose();
                        }}
                        className={`px-8 py-3 rounded-xl text-white font-black uppercase text-xs shadow-lg transition-colors duration-300 ${activeSlides[step].color}`}
                    >
                        {step === activeSlides.length - 1 ? "Finish" : "Next"}
                    </button>
                </div>
            </>
        )}
      </div>
    </div>
  );
};