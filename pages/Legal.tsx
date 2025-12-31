import React, { useState } from 'react';
import { TERMS_OF_SERVICE, PRIVACY_POLICY, WORKER_GUIDELINES, DISCLAIMERS } from '../lib/legalContent';

interface LegalProps {
  initialTab?: string;
  onBack: () => void;
}

const Legal: React.FC<LegalProps> = ({ initialTab = 'tos', onBack }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  const getContent = () => {
    switch (activeTab) {
      case 'tos': return TERMS_OF_SERVICE;
      case 'privacy': return PRIVACY_POLICY;
      case 'guidelines': return WORKER_GUIDELINES;
      case 'disclaimer': return DISCLAIMERS;
      default: return TERMS_OF_SERVICE;
    }
  };

  return (
    <div className="bg-white min-h-screen flex flex-col">
      <div className="px-6 pt-10 pb-4 border-b border-gray-100 flex items-center gap-4 sticky top-0 bg-white z-10">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
          <i className="fa-solid fa-chevron-left text-gray-500"></i>
        </button>
        <h1 className="text-2xl font-black text-gray-900">Legal</h1>
      </div>

      <div className="flex overflow-x-auto px-6 py-4 gap-3 scrollbar-hide bg-gray-50/50">
        {[
          { id: 'tos', label: 'Terms' },
          { id: 'privacy', label: 'Privacy' },
          { id: 'guidelines', label: 'Guidelines' },
          { id: 'disclaimer', label: 'Disclaimers' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-gray-900 text-white shadow-lg' 
                : 'bg-white text-gray-400 border border-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 flex-1 overflow-y-auto pb-24">
        <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100">
          <pre className="whitespace-pre-wrap font-sans text-xs text-gray-600 leading-relaxed text-justify">
            {getContent()}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default Legal;