import { SubscriptionTier } from '../types';

export const TIERS: { id: SubscriptionTier; name: string; price: number; limit: number; features: string[] }[] = [
  { id: 'basic', name: 'Basic / Trial', price: 0, limit: 2, features: ['2 Jobs Limit', 'Basic Profile', 'Standard Support'] },
  { id: 'lite', name: 'Verified Lite', price: 3999, limit: 6, features: ['6 Jobs Limit', 'Higher Visibility', 'Basic Verification Badge'] },
  { id: 'standard', name: 'Verified Standard', price: 6999, limit: 10, features: ['10 Jobs Limit', 'Mid-Tier Priority', 'Invoice Generator', 'Dedicated Support'] },
  { id: 'pro', name: 'Verified Pro', price: 9999, limit: 15, features: ['15 Jobs Limit', 'High Priority', 'Premium Alerts', 'Insurance (Coming Soon)'] },
  { id: 'enterprise', name: 'Enterprise', price: 14999, limit: 999999, features: ['Unlimited Jobs', 'Max Priority', 'Account Manager', 'Bulk Tools'] }
];

export const getTierLimit = (tier?: SubscriptionTier) => {
  const t = TIERS.find(t => t.id === (tier || 'basic'));
  return t ? t.limit : 2;
};

export const CATEGORY_MAP: Record<string, string[]> = {
  'Fashion & Tailoring': [
    'Fashion Designer (Female)', 'Fashion Designer (Male)', 'Bespoke Tailoring', 
    'Aso Ebi Specialist', 'Native/Senator Wear', 'Alterations & Amendments', 
    'Pattern Drafting', 'Shoe Making (Cobbler)', 'Bag Making', 'Jewelry & Bead Making'
  ],
  'Beauty & Wellness': [
    'Makeup Artist (MUA)', 'Gele Stylist', 'Hair Stylist (Unisex)', 'Barbing', 
    'Braiding & Fixing', 'Wig Making & Revamping', 'Nail Technician', 
    'Pedicure & Manicure', 'Spa & Massage Therapy', 'Skincare Expert', 
    'Tattoo & Body Art', 'Personal Trainer', 'Yoga Instructor'
  ],
  'Artisans & Technicians': [
    'Generator Repair (Petrol/Diesel)', 'Inverter & Solar Installation', 'AC & Fridge Repair', 
    'Electrician (House Wiring)', 'Plumbing & Water Treatment', 'Carpenter & Furniture Making', 
    'Painter & Screeding', 'POP Ceiling Services', 'Welder & Fabricator', 
    'Aluminum & Glass Work', 'Tiler & Masonry', 'Vulcanizer', 'Car Mechanic', 'Auto Electrician (Rewire)'
  ],
  'Home & Cleaning': [
    'Deep Cleaning', 'Office Cleaning', 'Post-Construction Cleaning', 
    'Fumigation & Pest Control', 'Laundry & Dry Cleaning', 'Car Wash & Detailing', 
    'Swimming Pool Maintenance', 'Gardening & Landscaping', 'Domestic Help/Cook'
  ],
  'Events & Entertainment': [
    'DJ (Disc Jockey)', 'MC / Hype Man', 'Event Decorator', 'Party Planner', 
    'Catering & Small Chops', 'Baking & Confectionery', 'Ushering Services', 
    'Bouncer / Security', 'Rental Services (Chairs/Canopies)'
  ],
  'Logistics & Errands': [
    'Dispatch Rider (Bike)', 'Truck / Van for Hire', 'Driver for Hire', 
    'Movers & Packers', 'Personal Shopper', 'Market Errand Runner', 
    'Queue Standing Service', 'Food Delivery'
  ],
  'Tech & Creative': [
    'Graphic Design', 'Web Design & Development', 'Social Media Management', 
    'Photography', 'Videography / Editing', 'Phone Repair', 'Laptop/Computer Repair', 
    'CCTV Installation', 'Software Installation'
  ],
  'Professional Services': [
    'Private Tutor (Academic)', 'Music Tutor', 'Language Instructor', 
    'Nurse / Caregiver', 'Physiotherapist', 'Architect / Draughtsman', 
    'Surveyor', 'Accounting / Tax Aid', 'Legal Aid / Notary'
  ]
};