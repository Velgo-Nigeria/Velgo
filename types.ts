

export type UserRole = 'client' | 'worker' | 'admin';
export type SubscriptionTier = 'basic' | 'lite' | 'standard' | 'pro' | 'enterprise';
export type ClientType = 'personal' | 'enterprise';
export type TaskStatus = 'open' | 'assigned' | 'completed';
export type TaskUrgency = 'normal' | 'urgent' | 'emergency';
export type DisputeStatus = 'pending' | 'resolved' | 'dismissed';

export interface NotificationPreferences {
  jobAlerts: boolean;
  renewals: boolean;
  reviews: boolean;
  security: boolean;
  promotions: boolean;
}

export interface Profile {
  id: string;
  email?: string;
  full_name: string;
  phone_number: string;
  role: UserRole;
  client_type?: ClientType;
  subscription_tier: SubscriptionTier;
  task_count: number;
  bank_name?: string;
  account_number?: string;
  account_name?: string; // New field
  address?: string; 
  state?: string;   
  lga?: string;     
  latitude?: number;  // New: For Geofencing
  longitude?: number; // New: For Geofencing
  bio?: string;
  service_title?: string;
  starting_price?: number;
  avatar_url?: string;
  nin_image_url?: string; // New: Manual Verification
  instagram_handle?: string; // New: Social Proof
  portfolio_url?: string;    // New: Portfolio Link
  is_verified: boolean;
  category?: string;
  subcategory?: string;
  last_reset_date: string;
  subscription_end_date?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  theme_mode?: 'light' | 'dark' | 'auto';
  notification_preferences?: NotificationPreferences;
}

export interface PostedTask {
  id: string;
  client_id: string;
  title: string;
  description: string;
  budget: number;
  location: string;
  latitude?: number;  // New: For Geofencing
  longitude?: number; // New: For Geofencing
  status: TaskStatus;
  urgency: TaskUrgency;
  assigned_worker_id?: string;
  category: string;
  subcategory?: string;
  created_at: string;
}

export interface Booking {
  id: string;
  client_id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  task_id?: string;
  created_at: string;
  quote_price?: number; // New: Worker's Bid
  rating?: number; 
  review?: string;
  is_punctual?: boolean; // New: Punctuality Check
  client_rating?: number; 
  client_review?: string;
  profiles?: Profile; 
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export interface Dispute {
  id: string;
  reporter_id: string;
  booking_id: string;
  reason_type: string;
  details: string;
  status: DisputeStatus;
  created_at: string;
}