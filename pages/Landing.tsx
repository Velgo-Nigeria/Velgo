
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserRole } from '../types';
import { VelgoLogo } from '../components/Brand';

interface LandingProps {
  onGetStarted: (role: UserRole) => void;
  onLogin: () => void;
  onViewLegal: (tab: string) => void;
}

const Landing: React.FC<LandingProps> = ({ onGetStarted, onLogin, onViewLegal }) => {
  const [reviews, setReviews] = useState<any[]>([]);
  
  // Review Form State
  const [reviewName, setReviewName] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    const { data } = await supabase.from('app_reviews').select('*').order('created_at', { ascending: false }).limit(10);
    if (data) setReviews(data);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewName.trim() || !reviewComment.trim()) return;
    setSubmitting(true);
    
    const { error } = await supabase.from('app_reviews').insert([{
      user_name: reviewName,
      comment: reviewComment,
      rating: reviewRating
    }]);

    if (!error) {
      setSubmitted(true);
      fetchReviews();
      setReviewName('');
      setReviewComment('');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Hero Section */}
      <div className="relative h-[60vh] flex flex-col justify-end px-6 pb-12 overflow-hidden bg-gray-900 rounded-b-[40px] shadow-2xl z-10">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1574950578143-858c6fc58922?auto=format&fit=crop&q=80&w=2000" 
            className="w-full h-full object-cover opacity-40"
            alt="Nigerian Worker"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
        </div>

        <div className="relative z-10 space-y-5 animate-fadeIn">
          <div className="flex justify-between items-start">
             <VelgoLogo variant="light" className="h-12" />
             <button onClick={onLogin} className="bg-white/10 backdrop-blur-md px-5 py-2 rounded-full text-[10px] font-black uppercase text-white border border-white/20">Sign In</button>
          </div>
          
          <h1 className="text-4xl font-black text-white leading-[1.05] tracking-tight mt-4">
            The Trusted App <br/>
            Bridging <span className="text-brand">Workers</span> <br/>
            & Clients.
          </h1>
          
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => onGetStarted('client')}
              className="flex-1 bg-brand text-white py-4 rounded-2xl font-black text-sm uppercase shadow-lg shadow-brand/20 active:scale-95 transition-transform"
            >
              Hire Help
            </button>
            <button 
              onClick={() => onGetStarted('worker')}
              className="flex-1 bg-white text-gray-900 py-4 rounded-2xl font-black text-sm uppercase shadow-lg active:scale-95 transition-transform"
            >
              Earn Money
            </button>
          </div>
        </div>
      </div>

      {/* Trust Affirmations (Ticker) */}
      <div className="bg-brand-light py-6 overflow-hidden">
         <div className="px-6 space-y-4">
            <p className="text-center text-[10px] font-black uppercase tracking-[3px] text-brand opacity-70">Our Guarantee</p>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                <div className="snap-center shrink-0 w-64 p-5 bg-white rounded-[24px] border-2 border-brand/20 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-brand text-white text-[9px] font-black px-2 py-1 rounded-bl-lg">100% YOURS</div>
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-3 text-brand text-lg"><i className="fa-solid fa-hand-holding-dollar"></i></div>
                    <h3 className="font-black text-gray-900 text-lg">0% Commission</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">Workers keep 100% of the agreed price. No platform deductions.</p>
                </div>
                <div className="snap-center shrink-0 w-64 p-5 bg-white rounded-[24px] border border-brand/10 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-3 text-blue-600 text-lg"><i className="fa-solid fa-user-shield"></i></div>
                    <h3 className="font-black text-gray-900 text-lg">Verified Workers</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">We verify IDs and addresses so you can hire with peace of mind.</p>
                </div>
                <div className="snap-center shrink-0 w-64 p-5 bg-white rounded-[24px] border border-brand/10 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-3 text-purple-600 text-lg"><i className="fa-solid fa-scale-balanced"></i></div>
                    <h3 className="font-black text-gray-900 text-lg">Fair Guidelines</h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">A strict code of conduct ensures respect and quality service for all.</p>
                </div>
            </div>
         </div>
      </div>

      {/* Rate Us Section (MOVED UP) */}
      <div className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-sm mx-auto space-y-6">
            <div className="text-center">
                <h3 className="text-xl font-black">Rate Your Experience</h3>
                <p className="text-xs text-gray-400">Help us make Velgo better for Nigeria.</p>
            </div>

            {submitted ? (
                <div className="bg-green-500/20 p-6 rounded-2xl text-center border border-green-500/30">
                    <i className="fa-solid fa-heart text-3xl text-brand mb-2"></i>
                    <p className="font-black text-brand-light">Thank you for the love!</p>
                </div>
            ) : (
                <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div className="flex justify-center gap-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button 
                                key={star} 
                                type="button"
                                onClick={() => setReviewRating(star)}
                                className={`text-3xl transition-transform active:scale-125 ${star <= reviewRating ? 'text-yellow-400' : 'text-gray-700'}`}
                            >
                                <i className="fa-solid fa-star"></i>
                            </button>
                        ))}
                    </div>
                    
                    <input 
                        value={reviewName}
                        onChange={(e) => setReviewName(e.target.value)}
                        placeholder="Your Name"
                        className="w-full bg-white/10 border border-white/10 rounded-xl p-4 text-sm font-bold text-white placeholder-gray-500 outline-none focus:border-brand transition-colors"
                        required
                    />
                    
                    <textarea 
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="What do you think about Velgo?"
                        rows={3}
                        className="w-full bg-white/10 border border-white/10 rounded-xl p-4 text-sm font-medium text-white placeholder-gray-500 outline-none focus:border-brand transition-colors resize-none"
                        required
                    />

                    <button 
                        type="submit" 
                        disabled={submitting}
                        className="w-full bg-brand text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-brand-dark transition-colors"
                    >
                        {submitting ? 'Posting...' : 'Submit Review'}
                    </button>
                </form>
            )}
        </div>
      </div>

      {/* Community Reviews (MOVED DOWN) */}
      <div className="py-12 px-6 bg-white space-y-6">
        <div className="text-center">
             <h2 className="text-2xl font-black text-gray-900">Naija Loves Velgo</h2>
             <p className="text-sm text-gray-500">See what the community is saying.</p>
        </div>
        
        <div className="space-y-4">
            {reviews.length === 0 ? (
                <div className="text-center text-gray-300 text-sm py-4">Be the first to review!</div>
            ) : (
                reviews.map((r) => (
                    <div key={r.id} className="bg-gray-50 p-5 rounded-[24px] border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                             <span className="font-bold text-gray-900 text-sm">{r.user_name}</span>
                             <div className="flex text-yellow-400 text-xs gap-0.5">
                                {Array(r.rating).fill(0).map((_,i) => <i key={i} className="fa-solid fa-star"></i>)}
                             </div>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">"{r.comment}"</p>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Footer / Copyright (Separated) */}
      <div className="bg-gray-50 border-t border-gray-100 py-8 text-center space-y-3 mt-auto">
          <VelgoLogo className="h-6 mx-auto opacity-30 grayscale mb-2" />
          <div className="flex justify-center gap-4 text-[10px] font-bold text-gray-400 uppercase">
              <button onClick={() => onViewLegal('tos')}>Terms</button>
              <button onClick={() => onViewLegal('privacy')}>Privacy</button>
              <button onClick={() => onViewLegal('guidelines')}>Guidelines</button>
          </div>
          <div className="space-y-1">
             <p className="text-[10px] text-gray-400 uppercase tracking-widest">© 2025 Velgo Nigeria.</p>
             <p className="text-[8px] text-gray-300 font-black uppercase tracking-[2px]">A Division of Universal Empire</p>
          </div>
      </div>
    </div>
  );
};

export default Landing;
