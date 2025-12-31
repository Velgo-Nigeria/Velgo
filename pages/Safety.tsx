import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Profile } from '../types';

interface SafetyProps {
  profile: Profile | null;
  onBack: () => void;
}

const Safety: React.FC<SafetyProps> = ({ profile, onBack }) => {
  const [description, setDescription] = useState('');
  const [incidentType, setIncidentType] = useState('Harassment');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);

    // FIX: Combine the user's input with their profile data
    // This ensures Make.com receives the Name/Phone/Email in the 'details' text
    const richDetails = `
INCIDENT: ${incidentType.toUpperCase()}
DETAILS: ${description}

-- REPORTER INFO --
Name: ${profile.full_name}
Phone: ${profile.phone_number}
Email: ${profile.email || 'N/A'}
User ID: ${profile.id}
`.trim();

    const { error } = await supabase.from('safety_reports').insert([{
        reporter_id: profile.id,
        type: incidentType,
        details: richDetails, // Sending the enriched text
        status: 'pending'
    }]);

    setLoading(false);

    if (error) {
        alert("Error submitting report: " + error.message);
    } else {
        setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-8 text-center text-white space-y-6">
        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
            <i className="fa-solid fa-check text-4xl"></i>
        </div>
        <h2 className="text-3xl font-black">Report Received</h2>
        <p className="text-sm font-medium leading-relaxed opacity-90">
          Our safety team has been alerted. We will contact you at <b>{profile?.phone_number}</b> shortly.
        </p>
        <div className="w-full pt-8">
            <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-70">Emergency Numbers</p>
            <a href="tel:112" className="block w-full bg-white text-red-600 py-4 rounded-2xl font-black text-lg">Call 112 (Police)</a>
            <button onClick={onBack} className="mt-4 text-xs font-bold uppercase tracking-widest opacity-80">Return to App</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-24">
      <div className="px-6 pt-10 pb-4 flex items-center gap-4 sticky top-0 bg-white z-10 border-b border-red-50">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <h1 className="text-2xl font-black text-red-600">Safety Center</h1>
      </div>

      <div className="p-6 space-y-8">
        <div className="bg-red-50 p-6 rounded-[32px] border border-red-100">
            <h3 className="text-red-600 font-black text-lg mb-2"><i className="fa-solid fa-triangle-exclamation mr-2"></i>Report Incident</h3>
            <p className="text-xs text-red-400 font-medium leading-relaxed">
                Use this form to report harassment, fraud, physical threats, or suspicious behavior. This alert goes directly to our high-priority queue.
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Incident Type</label>
                <div className="grid grid-cols-2 gap-3">
                    {['Harassment', 'Fraud', 'Physical Threat', 'Other'].map(type => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setIncidentType(type)}
                            className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${incidentType === type ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-gray-100 text-gray-500'}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">What Happened?</label>
                <textarea 
                    required 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    placeholder="Please describe the incident in detail..."
                    className="w-full bg-gray-50 p-4 rounded-2xl text-sm font-medium outline-none border border-transparent focus:border-red-200 focus:bg-white transition-all resize-none"
                />
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-red-600 text-white py-5 rounded-[28px] font-black uppercase tracking-widest shadow-xl shadow-red-200 active:scale-95 transition-transform"
            >
                {loading ? 'Sending Alert...' : 'Submit Report'}
            </button>
        </form>
      </div>
    </div>
  );
};

export default Safety;