
import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { supabase, safeFetch } from '../lib/supabaseClient';
import { Profile, SubscriptionTier, Broadcast } from '../lib/types';
import { TIERS } from '../lib/constants';
import { openWhatsAppHelper } from '../lib/whatsapp';

import { SparkChart, SafetyReportRelationsCard } from "./admin/AdminComponents";
import { BroadcastTab } from "./admin/tabs/BroadcastTab";
import { VerifyTab } from "./admin/tabs/VerifyTab";
import { UsersTab } from "./admin/tabs/UsersTab";
import { SafetyTab } from "./admin/tabs/SafetyTab";
import { SupportTab } from "./admin/tabs/SupportTab";
import { ReviewsTab } from "./admin/tabs/ReviewsTab";
import { AppRatingsTab } from "./admin/tabs/AppRatingsTab";
import { fetchAllAppRatings } from "../lib/appRatings";
import { StatsTab } from "./admin/tabs/StatsTab";
import { ErrorsTab } from "./admin/tabs/ErrorsTab";
import { AuditTab } from "./admin/tabs/AuditTab";
import { ChangelogTab } from "./admin/tabs/ChangelogTab";
import { DeletedAccountsTab, DeletedAccountRecord } from "./admin/tabs/DeletedAccountsTab";
import { LocationsTab } from "./admin/tabs/LocationsTab";
import { VerificationLightbox } from "./admin/VerificationLightbox";
import { UserDossierModal } from "./admin/UserDossierModal";
import { downloadUsersCSV, downloadUsersPDF, downloadStatsPDF } from "./admin/exportUtils";

const AdminDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'verify' | 'safety' | 'support' | 'broadcast' | 'app_ratings' | 'reviews' | 'stats' | 'locations' | 'deleted' | 'errors' | 'audit' | 'updates'>('users');

  const [safetyReports, setSafetyReports] = useState<any[]>([]);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [deletedAccounts, setDeletedAccounts] = useState<DeletedAccountRecord[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<Profile[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [pendingReplies, setPendingReplies] = useState<any[]>([]);
  const [appErrors, setAppErrors] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<{
      totalUsers: number;
      weeklyActiveCount: number;
      roles: { client: number; worker: number; admin: number };
      verifiedCount: number;
      tiers: { basic: number; lite: number; standard: number; pro: number };
      totalTasks: number;
      totalBudget: number;
      taskStatus: Record<string, number>;
      totalBookings: number;
      bookingStatus: Record<string, number>;
      revenueMRR: number;
      averageBudget: number;
      categoryDistribution: Record<string, number>;
      userGrowth: { label: string; count: number }[];
      taskVolumeWeekly: { label: string; count: number }[];
  } | null>(null);
  const [counts, setCounts] = useState<{
      verify: number;
      safety: number;
      support: number;
      reviews: number;
      deleted: number;
  }>({ verify: 0, safety: 0, support: 0, reviews: 0, deleted: 0 });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);

  // Blocking Form states
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState<string>('');
  const [unblockConfirmId, setUnblockConfirmId] = useState<string | null>(null);

  // User Activity Dossier modal state
  const [dossierUser, setDossierUser] = useState<any | null>(null);
  const [isDossierDeleted, setIsDossierDeleted] = useState<boolean>(false);

  // Broadcast Form
  const [bTitle, setBTitle] = useState('');
  const [bMessage, setBMessage] = useState('');
  const [bTarget, setBTarget] = useState<'all' | 'user' | 'admin'>('all');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Lightbox & Audit UX States
  const [lightboxUser, setLightboxUser] = useState<Profile | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotate, setRotate] = useState<number>(0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);

  const [selectedTicketUser, setSelectedTicketUser] = useState<any>(null);
  const [blockedBookings, setBlockedBookings] = useState<any[]>([]);
  const [adminReply, setAdminReply] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    fetchData(); 
    fetchCounts();
  }, [activeTab]);

  useEffect(() => {
    if (selectedTicketUser && chatScrollRef.current) {
        chatScrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [supportMessages, selectedTicketUser]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    
    try {
        let result: { data: any, error: any } = { data: null, error: null };

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            setErrorMsg("Session expired. Please re-login.");
            setLoading(false);
            return;
        }

        // Fetch current user's profile to inspect database-level role
        const { data: curProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (curProfile) {
            setCurrentUserProfile(curProfile);
        }

        if (activeTab === 'stats') {
            try {
                // Fetch stats datasets
                const { data: allProfiles, error: pErr } = await supabase.from('profiles').select('role, is_verified, subscription_tier, created_at, tokens, updated_at, category');
                const { data: allTasks, error: tErr } = await supabase.from('posted_tasks').select('status, budget, created_at, category');
                const { data: allBookings, error: bErr } = await supabase.from('bookings').select('status, created_at, task_id');

                if (pErr || tErr || bErr) {
                    throw new Error(pErr?.message || tErr?.message || bErr?.message || "Error fetching records");
                }

                const profilesList = allProfiles || [];
                const totalUsers = profilesList.length;
                const roles = { client: 0, worker: 0, admin: 0 };
                let verifiedCount = 0;
                const tiers = { basic: 0, lite: 0, standard: 0, pro: 0 };

                // Weekly active users calculation: profiles whose updated_at/created_at is within the last 7 days
                let weeklyActiveCount = 0;
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                profilesList.forEach((p: any) => {
                    const r = p.role || 'user';
                    if (r === 'admin') {
                        roles.admin++;
                    } else if (p.category) {
                        roles.worker++;
                    } else {
                        roles.client++;
                    }

                    if (p.is_verified) verifiedCount++;

                    const tier = p.subscription_tier || 'basic';
                    if (tier === 'lite') {
                        tiers.lite++;
                    } else if (tier === 'standard') {
                        tiers.standard++;
                    } else if (tier === 'pro') {
                        tiers.pro++;
                    } else if (tier === 'basic' && (p.tokens || 0) > 0) {
                        tiers.basic++;
                    }

                    const lastActive = p.updated_at ? new Date(p.updated_at) : p.created_at ? new Date(p.created_at) : null;
                    if (lastActive && lastActive >= sevenDaysAgo) {
                        weeklyActiveCount++;
                    }
                });

                // Tier pricing definitions in NGN (Starter Pack, Standard Pack, Pro Pack, Power Pack)
                const tierPrices = { basic: 900, lite: 3999, standard: 6999, pro: 9999 };
                const revenueMRR = (tiers.basic * tierPrices.basic) + 
                                    (tiers.lite * tierPrices.lite) + 
                                    (tiers.standard * tierPrices.standard) + 
                                    (tiers.pro * tierPrices.pro);

                const tasksList = allTasks || [];
                const totalTasks = tasksList.length;
                let totalBudget = 0;
                const taskStatus: Record<string, number> = {};
                const categoryDistribution: Record<string, number> = {};

                tasksList.forEach((t: any) => {
                    totalBudget += t.budget || 0;
                    taskStatus[t.status] = (taskStatus[t.status] || 0) + 1;
                    categoryDistribution[t.category] = (categoryDistribution[t.category] || 0) + 1;
                });

                const averageBudget = totalTasks > 0 ? Math.round(totalBudget / totalTasks) : 0;

                const bookingsList = allBookings || [];
                const totalBookings = bookingsList.length;
                const bookingStatus: Record<string, number> = {};
                bookingsList.forEach((b: any) => {
                    bookingStatus[b.status] = (bookingStatus[b.status] || 0) + 1;
                });

                // Calculate direct bookings vs applications
                const totalApplications = bookingsList.filter(b => b.task_id != null).length;
                const totalDirectBookings = bookingsList.filter(b => b.task_id == null).length;

                // Group User Growth by Week (last 8 weeks)
                const userGrowthMap: Record<string, number> = {};
                const weekStartTimes: { label: string; start: number; end: number }[] = [];
                const now = new Date();
                
                for (let i = 7; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - (i * 7));
                    d.setHours(0, 0, 0, 0);
                    // Start of week (Sunday)
                    const dayOfWeek = d.getDay();
                    const weekStart = new Date(d);
                    weekStart.setDate(d.getDate() - dayOfWeek);
                    weekStart.setHours(0, 0, 0, 0);
                    
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 7);
                    
                    const label = `${weekStart.getDate()} ${weekStart.toLocaleString('default', { month: 'short' })}`;
                    userGrowthMap[label] = 0;
                    weekStartTimes.push({ label, start: weekStart.getTime(), end: weekEnd.getTime() });
                }

                profilesList.forEach((p: any) => {
                    if (!p.created_at) return;
                    const t = new Date(p.created_at).getTime();
                    const matched = weekStartTimes.find(w => t >= w.start && t < w.end);
                    if (matched) {
                        userGrowthMap[matched.label]++;
                    }
                });

                // Group Job Traffic (Posts & Direct Bookings) by Day (last 7 days window)
                const dailyPostMap: Record<string, number> = {};
                const dayStartTimes: { label: string; start: number; end: number }[] = [];
                
                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    d.setHours(0, 0, 0, 0);
                    
                    const dayEnd = new Date(d);
                    dayEnd.setDate(d.getDate() + 1);
                    
                    const label = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
                    dailyPostMap[label] = 0;
                    dayStartTimes.push({ label, start: d.getTime(), end: dayEnd.getTime() });
                }

                tasksList.forEach((t: any) => {
                    if (!t.created_at) return;
                    const time = new Date(t.created_at).getTime();
                    const matched = dayStartTimes.find(d => time >= d.start && time < d.end);
                    if (matched) {
                        dailyPostMap[matched.label]++;
                    }
                });

                bookingsList.forEach((b: any) => {
                    if (b.task_id != null) return; // Count only direct bookings (marketplace tasks are already counted)
                    if (!b.created_at) return;
                    const time = new Date(b.created_at).getTime();
                    const matched = dayStartTimes.find(d => time >= d.start && time < d.end);
                    if (matched) {
                        dailyPostMap[matched.label]++;
                    }
                });

                setStats({
                    totalUsers,
                    weeklyActiveCount,
                    roles,
                    verifiedCount,
                    tiers,
                    totalTasks,
                    totalBudget,
                    taskStatus,
                    totalBookings,
                    bookingStatus,
                    revenueMRR,
                    averageBudget,
                    categoryDistribution,
                    totalApplications,
                    totalDirectBookings,
                    userGrowth: Object.entries(userGrowthMap).map(([label, count]) => ({ label, count })),
                    taskVolumeWeekly: Object.entries(dailyPostMap).map(([label, count]) => ({ label, count }))
                });
            } catch (err: any) {
                console.error("Failed to compile stats: ", err);
                setErrorMsg("Failed to compile platform-wide metrics: " + err.message);
            } finally {
                setLoading(false);
            }
            return;
        }

        if (activeTab === 'users') {
            result = await safeFetch(() => supabase.from('profiles').select('*').order('created_at', { ascending: false }));
        } else if (activeTab === 'verify') {
            // Fetch users who have an uploaded ID but are NOT yet verified
            result = await safeFetch(() => supabase.from('profiles').select('*').not('nin_image_url', 'is', null).eq('is_verified', false).order('updated_at', { ascending: false }));
        } else if (activeTab === 'safety') {
            result = await safeFetch(() => supabase
                .from('safety_reports')
                .select('*, profiles:reporter_id(full_name, phone_number, id, email, avatar_url)')
                .order('created_at', { ascending: false }));
        } else if (activeTab === 'broadcast') {
            result = await safeFetch(() => supabase.from('broadcasts').select('*').order('created_at', { ascending: false }));
        } else if (activeTab === 'reviews') {
            result = await safeFetch(() => supabase
                .from('bookings')
                .select(`
                    id,
                    review,
                    rating,
                    worker_reply,
                    worker_reply_at,
                    worker_reply_approved,
                    client:client_id(full_name, avatar_url),
                    worker:worker_id(full_name, avatar_url)
                `)
                .not('worker_reply', 'is', null)
                .neq('worker_reply', '')
                .order('worker_reply_at', { ascending: false }));
        } else if (activeTab === 'support') {
            result = await safeFetch(() => supabase
                .from('support_messages')
                .select('*, profiles(full_name, email, avatar_url, id)')
                .order('created_at', { ascending: true }));
        } else if (activeTab === 'errors') {
            result = await safeFetch(() => supabase
                .from('app_errors')
                .select('*')
                .order('timestamp', { ascending: false }));
        } else if (activeTab === 'audit') {
            result = await safeFetch(() => supabase
                .from('admin_audit_logs')
                .select('*, admin_profile:admin_id(full_name, email, avatar_url, role)')
                .order('created_at', { ascending: false }));
        } else if (activeTab === 'deleted') {
            result = await safeFetch(() => supabase
                .from('deleted_accounts')
                .select('*')
                .order('deleted_at', { ascending: false }));
        } else {
            result = { data: [], error: null };
        }

        if (result.error) {
            if (result.error.message?.includes('admin_reply') || result.error.message?.includes('support_messages')) {
                setErrorMsg("Database Schema Realignment Required: Please run the SQL migration script located in `/supabase/fix_support_messages_schema.sql` inside your Supabase SQL Editor to provision the Support Desk columns and resolve the connection crash.");
            } else if (result.error.message?.includes('app_errors')) {
                setErrorMsg("Database Schema Required: The 'app_errors' table does not exist. Please run the SQL migration script to create it.");
            } else if (result.error.message?.includes('deleted_accounts')) {
                console.warn("deleted_accounts table not found in schema cache yet.");
            } else {
                setErrorMsg(`Data Error: ${result.error.message}`);
            }
        }

        if (activeTab === 'users') setUsers(result.data || []);
        else if (activeTab === 'verify') setPendingVerifications(result.data || []);
        else if (activeTab === 'safety') setSafetyReports(result.data || []);
        else if (activeTab === 'broadcast') setBroadcasts(result.data || []);
        else if (activeTab === 'reviews') setPendingReplies(result.data || []);
        else if (activeTab === 'support') setSupportMessages(result.data || []);
        else if (activeTab === 'deleted') setDeletedAccounts(result.data || []);
        else if (activeTab === 'errors') setAppErrors(result.data || []);
        else if (activeTab === 'audit') setAuditLogs(result.data || []);

    } catch (err: any) {
        setErrorMsg(err.message || "Unknown system error occurred.");
    } finally {
        setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
        // 1. Pending Verifications count
        const { count: vCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .not('nin_image_url', 'is', null)
            .eq('is_verified', false);

        // 2. Active Safety Reports count (unresolved / undismissed)
        const { data: sData } = await supabase
            .from('safety_reports')
            .select('status');
        const sCount = sData ? sData.filter((r: any) => r.status !== 'resolved' && r.status !== 'dismissed').length : 0;

        // 3. Support Tickets count (where client sent last message and admin didn't reply yet)
        let supportPendingCount = 0;
        try {
            const { data: supportMsgs, error: supportErr } = await supabase
                .from('support_messages')
                .select('id, admin_reply, user_id, created_at, profiles:user_id(id)');
            
            if (supportErr) {
                console.warn("Support messages table query error (likely pending schema update):", supportErr.message);
            } else if (supportMsgs) {
                const grouped = supportMsgs.reduce((acc: any, msg) => {
                    if (!msg.profiles) return acc;
                    const uid = Array.isArray(msg.profiles) ? msg.profiles[0]?.id : msg.profiles?.id;
                    if (!acc[uid]) acc[uid] = { lastMsg: msg };
                    if (new Date(msg.created_at) > new Date(acc[uid].lastMsg.created_at)) {
                        acc[uid].lastMsg = msg;
                    }
                    return acc;
                }, {});
                supportPendingCount = Object.values(grouped).filter((ticket: any) => !ticket.lastMsg.admin_reply).length;
            }
        } catch (supportCatchErr) {
            console.error("Critical error in support ticket count check:", supportCatchErr);
        }

        // 4. Worker Replies count (where worker_reply is set but not yet approved)
        const { count: rCount } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .not('worker_reply', 'is', null)
            .neq('worker_reply', '')
            .or('worker_reply_approved.is.null,worker_reply_approved.eq.false');

        // 5. Fetch blocked/impeded pending matches where client has 0 tokens remaining
        try {
            const { data: bData } = await supabase
                .from('bookings')
                .select(`
                    id,
                    created_at,
                    client:client_id(id, full_name, email, tokens),
                    worker:worker_id(id, full_name, email),
                    posted_tasks:task_id(id, title)
                `)
                .eq('status', 'pending');

            const impeded = (bData || []).filter((b: any) => (b.client?.tokens ?? 0) < 1);
            setBlockedBookings(impeded);
        } catch (bErr) {
            console.error("Failed auditing blocked matches:", bErr);
        }

        let appRatingsPendingCount = 0;
        try {
            const allRatings = await fetchAllAppRatings();
            appRatingsPendingCount = allRatings.filter((r: any) => !r.admin_reply).length;
        } catch (arErr) {
            console.warn("Failed fetching app ratings pending count:", arErr);
        }

        let deletedCount = 0;
        try {
            const { count: dCount } = await supabase
                .from('deleted_accounts')
                .select('*', { count: 'exact', head: true });
            deletedCount = dCount || 0;
        } catch (delErr) {
            console.warn("Failed fetching deleted count:", delErr);
        }

        setCounts({
            verify: vCount || 0,
            safety: sCount,
            support: supportPendingCount,
            app_ratings: appRatingsPendingCount,
            reviews: rCount || 0,
            deleted: deletedCount
        });
    } catch (e) {
        console.error("Error fetching admin counts:", e);
    }
  };

  const handleRestoreDeletedUser = async (record: DeletedAccountRecord) => {
    try {
      const { error } = await supabase
        .from('deleted_accounts')
        .delete()
        .eq('id', record.id);

      if (error) throw error;

      await logAdminAction('unblacklist_account', record.id, {
        email: record.email,
        phone_number: record.phone_number,
        name: record.full_name
      });

      alert(`Removed ${record.full_name || record.email || 'account'} from the blacklist. They can now re-register or access the platform.`);
      fetchData();
      fetchCounts();
    } catch (err: any) {
      alert("Failed to remove account from blacklist: " + err.message);
    }
  };

  const logAdminAction = async (actionType: string, targetId: string | null, details: any = {}) => {
      if (!currentUserProfile) return;
      try {
          await supabase.from('admin_audit_logs').insert({
              admin_id: currentUserProfile.id,
              action_type: actionType,
              target_id: targetId,
              details: details
          });
      } catch (err) {
          console.error("Failed to log admin action:", err);
      }
  };

  const handleDownloadPdf = () => downloadStatsPDF(stats);

  const handleSendBroadcast = async () => {
      if (!bTitle || !bMessage) return;
      setSendingBroadcast(true);
      try {
          const { data: { user } } = await supabase.auth.getUser();
          const { error } = await supabase.from('broadcasts').insert({
              admin_id: user?.id,
              title: bTitle,
              message: bMessage,
              target_role: bTarget
          });
          
          if (error) throw error;
          
          await logAdminAction('SEND_BROADCAST', null, { title: bTitle, target: bTarget });

          alert("Broadcast sent successfully to " + bTarget + " users!");
          setBTitle('');
          setBMessage('');
          fetchData();
      } catch (err: any) {
          alert("Failed to broadcast: " + err.message);
      } finally {
          setSendingBroadcast(false);
      }
  };

  const handleDeleteBroadcast = async (id: string) => {
      if (!window.confirm("Delete this broadcast?")) return;
      const { error } = await supabase.from('broadcasts').delete().eq('id', id);
      if (error) alert("Could not delete: " + error.message);
      else {
          await logAdminAction('DELETE_BROADCAST', id);
          setBroadcasts(prev => prev.filter(b => b.id !== id));
      }
  };

  // Process Verification from Verify Tab
  const handleVerificationDecision = async (userId: string, decision: 'approve' | 'reject') => {
      const reason = rejectionReasons[userId]?.trim();
      if (decision === 'reject' && !reason) {
          alert("Please provide a Reason for Rejection so the user knows what to correct.");
          return;
      }

      setProcessingId(userId);
      try {
          const updates = decision === 'approve' 
            ? { is_verified: true, id_rejection_reason: null } 
            : { nin_image_url: null, is_verified: false, id_rejection_reason: reason }; // Clear image on reject so user can re-upload

          const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
          if (error) throw error;

          setPendingVerifications(prev => prev.filter(u => u.id !== userId));
          setRejectionReasons(prev => {
              const copy = { ...prev };
              delete copy[userId];
              return copy;
          });
          
          await logAdminAction('VERIFICATION_' + decision.toUpperCase(), userId, { reason });
          
          alert(`User ${decision}d successfully.`);
          fetchCounts();
      } catch (err: any) {
          alert("Action failed: " + err.message);
      } finally {
          setProcessingId(null);
      }
  };

  const handleManualTierUpdate = async (userId: string, newTier: SubscriptionTier) => {
      setProcessingId(userId);
      try {
        const addedTokens = TIERS.find(t => t.id === newTier)?.limit || 0;
        await supabase.rpc('add_tokens', { p_user_id: userId, p_amount: addedTokens });

        const { error } = await supabase.from('profiles').update({
            subscription_tier: newTier
        }).eq('id', userId);
        if (error) throw error;
        
        await logAdminAction('UPDATE_TIER', userId, { new_tier: newTier, added_tokens: addedTokens });
        
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_tier: newTier } : u));
      } catch (error: any) {
          alert("Failed to update tier: " + error?.message);
      } finally {
        setProcessingId(null);
      }
  };

  const handleBlockUser = async (userId: string) => {
      const reason = blockReasonInput.trim();
      if (!reason) {
          alert("Please enter an official Reason for Block.");
          return;
      }
      setProcessingId(userId);
      try {
          const { error } = await supabase.from('profiles').update({
              is_blocked: true,
              block_reason: reason
          }).eq('id', userId);
          if (error) throw error;
          
          await logAdminAction('BLOCK_USER', userId, { reason });

          setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: true, block_reason: reason } : u));
          setBlockingUserId(null);
          setBlockReasonInput('');
          alert("User blocked successfully and session token revoked!");
      } catch (err: any) {
          alert("Failed to block user: " + err.message);
      } finally {
          setProcessingId(null);
      }
  };

  const handleUnblockUser = async (userId: string) => {
      setProcessingId(userId);
      try {
          const { error } = await supabase.from('profiles').update({
              is_blocked: false,
              block_reason: null
          }).eq('id', userId);
          if (error) throw error;

          await logAdminAction('UNBLOCK_USER', userId);

          setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: false, block_reason: null } : u));
          setUnblockConfirmId(null);
          alert("User unblocked successfully!");
      } catch (err: any) {
          alert("Failed to unblock user: " + err.message);
      } finally {
          setProcessingId(null);
      }
  };

  const handleUpdateUserProfile = async (userId: string, newFullName: string, newPhoneNumber: string, reason: string) => {
      setProcessingId(userId);
      try {
          const targetUser = users.find(u => u.id === userId);
          const { error } = await supabase.from('profiles').update({
              full_name: newFullName,
              phone_number: newPhoneNumber,
              updated_at: new Date().toISOString()
          }).eq('id', userId);
          
          if (error) throw error;

          // Sync auth user metadata if updating current logged in user
          try {
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              if (currentUser && currentUser.id === userId) {
                  await supabase.auth.updateUser({
                      data: {
                          full_name: newFullName,
                          display_name: newFullName,
                          name: newFullName
                      }
                  });
              }
          } catch (authErr) {
              console.warn("Could not sync auth metadata:", authErr);
          }

          await logAdminAction('ADMIN_UPDATE_USER_PROFILE', userId, {
              old_name: targetUser?.full_name,
              new_name: newFullName,
              old_phone: targetUser?.phone_number,
              new_phone: newPhoneNumber,
              reason: reason || 'Admin manual profile edit'
          });

          setUsers(prev => prev.map(u => u.id === userId ? {
              ...u,
              full_name: newFullName,
              phone_number: newPhoneNumber,
              updated_at: new Date().toISOString()
          } : u));

          alert(`Successfully updated profile for ${newFullName}!`);
      } catch (err: any) {
          alert("Failed to update user profile: " + err.message);
          throw err;
      } finally {
          setProcessingId(null);
      }
  };

  const handleReviewReplyApprove = async (bookingId: string) => {
      setProcessingId(bookingId);
      try {
          const { error } = await supabase
              .from('bookings')
              .update({ worker_reply_approved: true })
              .eq('id', bookingId);
          if (error) throw error;
          
          await logAdminAction('APPROVE_REVIEW_REPLY', bookingId);
          
          setPendingReplies(prev => prev.map(item => item.id === bookingId ? { ...item, worker_reply_approved: true } : item));
          alert("Worker reply approved! It is now live on their profile.");
          fetchCounts();
      } catch (err: any) {
          alert("Action failed: " + err.message);
      } finally {
          setProcessingId(null);
      }
  };

  const handleReviewReplyReject = async (bookingId: string) => {
      if (!window.confirm("Are you sure you want to delete and reset this worker reply? The worker will be allowed to submit a new response.")) return;
      setProcessingId(bookingId);
      try {
          const { error } = await supabase
              .from('bookings')
              .update({ 
                  worker_reply: null, 
                  worker_reply_at: null, 
                  worker_reply_approved: false 
              })
              .eq('id', bookingId);
          if (error) throw error;
          
          await logAdminAction('REJECT_REVIEW_REPLY', bookingId);
          
          setPendingReplies(prev => prev.filter(item => item.id !== bookingId));
          alert("Worker reply rejected & deleted.");
          fetchCounts();
      } catch (err: any) {
          alert("Action failed: " + err.message);
      } finally {
          setProcessingId(null);
      }
  };

  const handleSafetyAction = async (reportId: string, action: 'resolve' | 'dismiss') => {
      const status = action === 'resolve' ? 'resolved' : 'dismissed';
      
      // Find reporter profile id to trigger automated notification
      const report = safetyReports.find((r: any) => r.id === reportId);
      const recipientId = report?.reporter_id || report?.profiles?.id;

      const { error } = await supabase.from('safety_reports').update({ status }).eq('id', reportId);
      if (error) {
          alert("Failed: " + error.message);
      } else {
          // If resolving, send an instant database-backed push/in-app notification to the reporter
          if (action === 'resolve' && recipientId) {
              try {
                  await supabase.from('notifications').insert({
                      user_id: recipientId,
                      title: '🛡️ Safety Case Resolved',
                      message: `Your security report regarding "${report?.type || 'incident'}" has been inspected and resolved by Velgo Compliance. Thank you for keeping our community safe.`,
                      type: 'success'
                  });
              } catch (notifErr: any) {
                  console.error("Warning: Notification sync failed", notifErr.message);
              }
          }
          await logAdminAction('SAFETY_REPORT_ACTION', reportId, { action });
          fetchData();
      }
  };

  const sendAdminReply = async () => {
      if (!selectedTicketUser || !adminReply.trim()) return;
      const { error } = await supabase.from('support_messages').insert({
          user_id: selectedTicketUser.id,
          content: adminReply,
          admin_reply: true, 
          status: 'open'
      });
      if (!error) {
          await logAdminAction('SEND_SUPPORT_REPLY', selectedTicketUser.id, { reply: adminReply });
          // Send automatic in-app notification to the customer's PWA notification tray
          try {
              await supabase.from('notifications').insert({
                  user_id: selectedTicketUser.id,
                  title: '💬 New Help Desk Reply',
                  message: `A Velgo support operator has replied: "${adminReply.length > 50 ? adminReply.substring(0, 50) + '...' : adminReply}"`,
                  type: 'info'
              });
          } catch (notifErr: any) {
              console.error("Warning: Notification sync failed", notifErr.message);
          }

          setAdminReply('');
          fetchData();
      } else {
          alert("Failed: " + error.message);
      }
  };

  const handleDownloadUsersCSV = () => downloadUsersCSV(users);

  const handleDownloadUsersPDF = () => downloadUsersPDF(users);

  const filteredUsers = users.filter(u => 
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.phone_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedSupport = supportMessages.reduce((acc: any, msg) => {
      if (!msg.profiles) return acc;
      const uid = Array.isArray(msg.profiles) ? msg.profiles[0]?.id : msg.profiles?.id;
      if (!acc[uid]) acc[uid] = { user: msg.profiles, messages: [], lastMsg: msg };
      acc[uid].messages.push(msg);
      if (new Date(msg.created_at) > new Date(acc[uid].lastMsg.created_at)) acc[uid].lastMsg = msg;
      return acc;
  }, {});

  const sortedSupportTickets = Object.values(groupedSupport).sort((a: any, b: any) => 
      new Date(b.lastMsg.created_at).getTime() - new Date(a.lastMsg.created_at).getTime()
  );

  return (
    <div className="bg-gray-50 dark:bg-slate-900 min-h-screen pb-24 flex flex-col transition-colors duration-200">
      <div className="px-6 pt-10 pb-4 bg-gray-900 sticky top-0 z-20 text-white shadow-lg">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
                <button onClick={onBack}><i className="fa-solid fa-chevron-left"></i></button>
                <h1 className="text-2xl font-black">Admin Panel</h1>
            </div>
            <button onClick={fetchData} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <i className={`fa-solid fa-rotate-right ${loading ? 'animate-spin' : ''}`}></i>
            </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['users', 'verify', 'safety', 'support', 'broadcast', 'app_ratings', 'reviews', 'stats', 'locations', 'deleted', 'errors', 'audit', 'updates'].map(tab => {
            const badgeCount = counts[tab as keyof typeof counts] || 0;
            return (
              <button 
                key={tab} 
                onClick={() => { setActiveTab(tab as any); setSelectedTicketUser(null); }} 
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all duration-150 ${activeTab === tab ? 'bg-brand text-white font-black' : 'bg-white/10 text-gray-400 hover:bg-white/15 hover:text-white'}`}
              >
                <span>{tab === 'app_ratings' ? '⭐ App Ratings' : tab === 'reviews' ? 'Worker Replies' : tab === 'stats' ? 'Metrics & Stats' : tab === 'locations' ? '📍 Locations & Waitlist' : tab === 'deleted' ? '🗑️ Deleted Accounts' : tab === 'errors' ? 'Error Logs' : tab === 'audit' ? 'Audit Logs' : tab === 'updates' ? '🚀 Updates & Changelog' : tab}</span>
                {badgeCount > 0 && (
                  <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded-full tracking-tight shrink-0 ${
                    activeTab === tab ? 'bg-white text-gray-950 font-black' : 'bg-red-50 text-white animate-pulse'
                  }`}>
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>

       <div className="p-4 flex-1 overflow-y-auto">
         {/* Active Token Expiry Matches Impediment Overlay */}
         {!loading && blockedBookings.length > 0 && (
             <div className="mb-6 bg-amber-500/10 dark:bg-amber-950/20 rounded-[24px] border border-amber-500/20 p-5 space-y-3 font-sans">
                 <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2.5">
                         <div className="w-9 h-9 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center shrink-0">
                             <i className="fa-solid fa-triangle-exclamation animate-pulse"></i>
                         </div>
                         <div>
                             <h4 className="text-[11px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                                 ⚠️ Token-Impeded Booking Matches ({blockedBookings.length})
                             </h4>
                             <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                                 These matches are currently stuck on hold because the client has depleted their remaining tokens.
                             </p>
                         </div>
                     </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                     {blockedBookings.slice(0, 6).map((b: any) => (
                         <div key={b.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 rounded-xl p-3 flex flex-col justify-between text-xs space-y-2 shadow-sm">
                             <div>
                                 <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider text-gray-400">
                                     <span>Task: {b.posted_tasks?.title || 'Direct Hire'}</span>
                                     <span>{new Date(b.created_at).toLocaleDateString()}</span>
                                 </div>
                                 <p className="font-extrabold text-[11px] text-gray-800 dark:text-gray-200 mt-1">
                                     Client: <span className="text-amber-500 font-black">{b.client?.full_name || b.client?.email || 'N/A'}</span> (0 Tokens)
                                 </p>
                                 <p className="text-[10px] font-bold text-gray-500 mt-0.5">
                                     Ready Worker: <span className="text-slate-900 dark:text-white font-extrabold">{b.worker?.full_name || b.worker?.email || 'N/A'}</span>
                                 </p>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
         )}

         {loading ? <div className="text-center py-20 text-gray-400">Loading data...</div> : 
         errorMsg ? (
             activeTab === 'broadcast' && (errorMsg.includes('broadcasts') || errorMsg.includes('schema cache')) ? (
                 <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-[32px] border border-amber-200 dark:border-slate-800 space-y-6 animate-fadeIn font-sans max-w-xl mx-auto">
                     <div className="flex items-start gap-4">
                         <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center shrink-0 text-xl">
                             <i className="fa-solid fa-circle-exclamation animate-bounce"></i>
                         </div>
                         <div>
                             <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">📢 Activate Admin Broadcasts</h3>
                             <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                 The <code>public.broadcasts</code> table was not found in your Supabase database schema cache. This table stores public announcements sent to students, clients, or professionals.
                             </p>
                         </div>
                     </div>

                     <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700/60 space-y-3">
                         <p className="text-xs font-bold text-slate-700 dark:text-gray-200 flex items-center gap-1.5"><i className="fa-solid fa-magic text-amber-500"></i> How to initialize in 10 seconds:</p>
                         <ol className="list-decimal pl-4 text-xs text-slate-500 dark:text-gray-400 space-y-1.5">
                             <li>Open your <strong>Supabase Dashboard</strong>.</li>
                             <li>Go to the <strong>SQL Editor</strong> in the left sidebar.</li>
                             <li>Click <strong>New Query</strong>, paste the script below, and click <strong>Run</strong>.</li>
                             <li>Refresh this dashboard tab to start broadcasting!</li>
                         </ol>
                     </div>

                     <div className="space-y-2">
                         <div className="flex justify-between items-center px-1">
                             <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">SQL Setup Script</span>
                             <button 
                                 onClick={() => {
                                     const sql = `CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_role TEXT DEFAULT 'all',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access" ON public.broadcasts;
CREATE POLICY "Admins have full access" ON public.broadcasts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role::text = 'admin'
        )
    );

DROP POLICY IF EXISTS "Users view targeted" ON public.broadcasts;
CREATE POLICY "Users view targeted" ON public.broadcasts
    FOR SELECT USING (
        target_role = 'all' OR 
        target_role = (SELECT role::text FROM public.profiles WHERE id = auth.uid())
    );

GRANT ALL ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;`;
                                     navigator.clipboard.writeText(sql);
                                     alert("SQL setup code copied to clipboard! Paste and run it in your Supabase SQL Editor.");
                                 }}
                                 className="text-[9px] font-black uppercase tracking-wider px-3 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                             >
                                 <i className="fa-solid fa-copy"></i> Copy Script
                             </button>
                         </div>
                         <pre className="p-4 bg-slate-900 text-slate-300 rounded-2xl text-[10px] font-mono leading-relaxed overflow-x-auto border border-slate-800 max-h-52 overflow-y-auto">
{`CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_role TEXT DEFAULT 'all',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access" ON public.broadcasts;
CREATE POLICY "Admins have full access" ON public.broadcasts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role::text = 'admin'
        )
    );

DROP POLICY IF EXISTS "Users view targeted" ON public.broadcasts;
CREATE POLICY "Users view targeted" ON public.broadcasts
    FOR SELECT USING (
        target_role = 'all' OR 
        target_role = (SELECT role::text FROM public.profiles WHERE id = auth.uid())
    );

GRANT ALL ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;`}
                         </pre>
                     </div>
                 </div>
             ) : (
                 <div className="p-6 bg-red-50 text-red-600 rounded-2xl text-center border border-red-100 animate-fadeIn"><p className="text-xs font-bold">{errorMsg}</p></div>
             )
           ) :

         activeTab === 'broadcast' ? <BroadcastTab
                        currentUserProfile={currentUserProfile}
                        bTitle={bTitle}
                        setBTitle={setBTitle}
                        bMessage={bMessage}
                        setBMessage={setBMessage}
                        setBTarget={setBTarget}
                        bTarget={bTarget}
                        handleSendBroadcast={handleSendBroadcast}
                        sendingBroadcast={sendingBroadcast}
                        broadcasts={broadcasts}
                        handleDeleteBroadcast={handleDeleteBroadcast}
                      /> :

          activeTab === 'verify' ? <VerifyTab
                            pendingVerifications={pendingVerifications}
                            setLightboxUser={setLightboxUser}
                            setZoom={setZoom}
                            setRotate={setRotate}
                            setPanX={setPanX}
                            setPanY={setPanY}
                          /> : 
         
         activeTab === 'users' ? <UsersTab
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                downloadUsersCSV={handleDownloadUsersCSV}
                                downloadUsersPDF={handleDownloadUsersPDF}
                                filteredUsers={filteredUsers}
                                handleManualTierUpdate={handleManualTierUpdate}
                                currentUserProfile={currentUserProfile}
                                unblockConfirmId={unblockConfirmId}
                                handleUnblockUser={handleUnblockUser}
                                setUnblockConfirmId={setUnblockConfirmId}
                                blockingUserId={blockingUserId}
                                blockReasonInput={blockReasonInput}
                                setBlockReasonInput={setBlockReasonInput}
                                handleBlockUser={handleBlockUser}
                                setBlockingUserId={setBlockingUserId}
                                onViewDossier={(u) => { setDossierUser(u); setIsDossierDeleted(false); }}
                                onUpdateUserProfile={handleUpdateUserProfile}
                              /> : 
         
         activeTab === 'safety' ? <SafetyTab
                                    safetyReports={safetyReports}
                                    setActiveTab={setActiveTab}
                                    setSelectedTicketUser={setSelectedTicketUser}
                                    handleSafetyAction={handleSafetyAction}
                                  /> : 
         
         activeTab === 'support' ? <SupportTab
                                        selectedTicketUser={selectedTicketUser}
                                        setSelectedTicketUser={setSelectedTicketUser}
                                        groupedSupport={groupedSupport}
                                        chatScrollRef={chatScrollRef}
                                        adminReply={adminReply}
                                        setAdminReply={setAdminReply}
                                        sendAdminReply={sendAdminReply}
                                        sortedSupportTickets={sortedSupportTickets}
                                      /> :

          activeTab === 'app_ratings' ? <AppRatingsTab /> :

          activeTab === 'reviews' ? <ReviewsTab
                                            pendingReplies={pendingReplies}
                                            processingId={processingId}
                                            handleReviewReplyReject={handleReviewReplyReject}
                                            handleReviewReplyApprove={handleReviewReplyApprove}
                                          /> : 

          activeTab === 'stats' && stats ? <StatsTab
                                                handleDownloadPdf={handleDownloadPdf}
                                                stats={stats}
                                              /> :

          activeTab === 'locations' ? <LocationsTab />

 : activeTab === 'deleted' ? <DeletedAccountsTab
                                deletedAccounts={deletedAccounts}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                onRestoreUser={handleRestoreDeletedUser}
                                onViewDossier={(rec) => { setDossierUser(rec); setIsDossierDeleted(true); }}
                                loading={loading}
                              /> : activeTab === 'errors' ? <ErrorsTab
                                                        appErrors={appErrors}
                                                      /> : activeTab === 'audit' ? <AuditTab
                                                            auditLogs={auditLogs}
                                                          /> : activeTab === 'updates' ? <ChangelogTab /> : null
        }
      </div>

      {/* Modern High-Contrast Lightbox Modal Visual Workspace with Rotate, Zoom, Pan & State Comparison */}
      {lightboxUser && <VerificationLightbox
            lightboxUser={lightboxUser}
            setLightboxUser={setLightboxUser}
            zoom={zoom}
            rotate={rotate}
            panX={panX}
            panY={panY}
            setPanY={setPanY}
            setPanX={setPanX}
            setZoom={setZoom}
            setRotate={setRotate}
            setRejectionReasons={setRejectionReasons}
            rejectionReasons={rejectionReasons}
            handleVerificationDecision={handleVerificationDecision}
            processingId={processingId}
          />}

      {/* User Activity Dossier & Audit Modal Workspace */}
      {dossierUser && (
        <UserDossierModal
          user={dossierUser}
          isDeleted={isDossierDeleted}
          onClose={() => setDossierUser(null)}
        />
      )}
    </div>
  );
};
export default AdminDashboard;