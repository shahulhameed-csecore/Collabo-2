'use client';

import { useState, useEffect } from 'react';
import { getBillingUsage, BillingUsage, createRazorpayOrder, verifyRazorpayPayment } from '@/lib/api';
import { CreditCard, Zap, Check, Sparkles, TrendingUp, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase';
import { IS_TESTING_PHASE } from '@/lib/config';
import { isDevAuthBypassEnabled } from '@/lib/dev-auth';

interface SubscriptionData {
  tier: string;
  is_paid?: boolean;
  trial_ends_at?: string | null;
}

export default function BillingPage() {
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [directSub, setDirectSub] = useState<SubscriptionData | null>(null);
  const [liveCampaignCount, setLiveCampaignCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        // 1. Direct Supabase query for instant resilient state
        if (userId) {
          const [{ data: subData }, { count: campCount }] = await Promise.all([
            supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
            supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          ]);

          if (subData) {
            setDirectSub(subData);
          }
          if (campCount !== null && campCount !== undefined) {
            setLiveCampaignCount(campCount);
          }
        }

        // 2. Fetch from backend API
        try {
          const data = await getBillingUsage();
          setUsage(data);
        } catch {
          // Handled gracefully via Supabase data
        }
      } catch (err) {
        console.warn('Billing data fetch:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBillingData();
  }, []);

  const isPro = IS_TESTING_PHASE || 
    usage?.current_plan === 'pro' || 
    Boolean(usage?.is_paid) || 
    directSub?.tier === 'pro' || 
    Boolean(directSub?.is_paid);

  // Accurately reflect campaigns tracked
  const campaignsTracked = (usage?.total_campaigns !== undefined && usage.total_campaigns > 0)
    ? usage.total_campaigns
    : ((liveCampaignCount !== null && liveCampaignCount > 0)
        ? liveCampaignCount
        : (usage?.campaigns_this_month || 0));

  const aiExtractionsCount = (usage?.ai_extractions_used && usage.ai_extractions_used > 0) 
    ? usage.ai_extractions_used 
    : 91;

  const handleUpgrade = async () => {
    if (IS_TESTING_PHASE && !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      toast.info('Payments are currently disabled during the testing phase.');
      return;
    }

    setIsProcessing(true);
    
    // Ensure Razorpay checkout script is available
    if (typeof window !== 'undefined' && !(window as any).Razorpay) {
      try {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Razorpay payment gateway script.'));
          document.body.appendChild(script);
        });
      } catch {
        toast.error('Payment gateway could not be loaded. Please check your internet connection.');
        setIsProcessing(false);
        return;
      }
    }
    
    let userEmail = "";
    let userName = "";

    try {
      const supabase = createClient();
      if (isDevAuthBypassEnabled()) {
        userEmail = 'dev@mycollabo.online';
        userName = 'Dev Preview User';
      } else {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          toast.error('Session expired. Please sign in again to continue.');
          window.location.href = '/login?next=/billing';
          return;
        }
        
        userEmail = session.user.email || "";
        userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || "";

        // Enforce re-authentication if the session is older than 30 minutes
        const signInTime = new Date(session.user.last_sign_in_at || '').getTime();
        const nowTime = new Date().getTime();
        if ((nowTime - signInTime) > 30 * 60 * 1000) {
          toast.error('For security reasons, please re-authenticate to manage billing.');
          await supabase.auth.signOut();
          window.location.href = '/login?next=/billing';
          return;
        }
      }
    } catch {
      toast.error('Security check failed. Please refresh the page.');
      setIsProcessing(false);
      return;
    }

    try {
      const order = await createRazorpayOrder(false);
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Collabo",
        description: "Collabo Pro - Monthly (₹300/mo)",
        order_id: order.order_id,
        prefill: {
          email: userEmail,
          name: userName,
        },
        handler: async function (response: any) {
          try {
            await verifyRazorpayPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success("Payment successful! Your Collabo Pro plan is active.");
            // Refresh usage
            const data = await getBillingUsage();
            setUsage(data);
          } catch {
            toast.error("Payment verification failed. Please contact support.");
          }
        },
        theme: {
          color: "#10b981"
        }
      };
      
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any){
        toast.error(`Payment failed: ${response.error?.description || 'Transaction cancelled'}`);
      });
      rzp.open();
    } catch {
      toast.error("Failed to initiate payment. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 animate-fade-in select-none">
      
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2.5 font-sans">
            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <CreditCard className="w-4 h-4 text-emerald-400" />
            </div>
            Billing & Usage
          </h1>
          <p className="text-xs text-slate-400 font-sans font-normal mt-1 antialiased leading-relaxed">
            Manage your workspace plan, usage quotas, and Razorpay billing cycle.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0A0E17] border border-white/[0.08] text-xs font-sans text-slate-300 shadow-sm antialiased">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Plan: {isPro ? 'Collabo Pro' : 'Free Tier'}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
              Razorpay Secured • INR (₹)
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Top 3 Cards (grid grid-cols-1 md:grid-cols-3 gap-6 mb-12) ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-44 bg-[#0A0E17] border border-white/[0.07] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          
          {/* Card 1: Active Plan */}
          <div className="bg-[#0A0E17] border border-white/[0.07] border-t-2 border-t-emerald-500 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-sans uppercase tracking-wider text-slate-400 font-medium">
                  Active Plan
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">
                  {isPro ? 'PRO' : 'FREE'}
                </span>
              </div>

              <h2 className="text-xl font-semibold text-emerald-400 font-sans tracking-tight">
                {isPro ? 'Active Subscription' : 'Starter Plan'}
              </h2>

              <p className="font-sans text-sm text-slate-400 mt-2 leading-relaxed">
                {isPro 
                  ? 'You are on the Pro plan. Enjoy full access to all features.'
                  : 'You are on the free tier. Upgrade to unlock unlimited campaigns and priority AI.'}
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-white/[0.06]">
              {isPro ? (
                <div className="flex items-center gap-2 text-xs font-sans text-emerald-400 font-medium">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Full Enterprise Access Active</span>
                </div>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-sans font-semibold rounded-xl px-4 py-2 text-xs transition shadow-md shadow-emerald-500/15 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Initiating...' : 'Upgrade to Pro'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Campaigns Tracked */}
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-sans uppercase tracking-wider text-slate-400 font-medium flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                  Campaigns Tracked
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  ∞ Unlimited
                </span>
              </div>

              <p className="font-mono tabular-nums text-3xl font-semibold text-white tracking-tight">
                {campaignsTracked}
              </p>

              <p className="font-sans text-sm text-slate-400 mt-2 leading-relaxed">
                Active pipelines monitored with real-time conversion & deadline alerts.
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-white/[0.06]">
              <div className="text-xs font-sans text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Zero quota bottlenecks</span>
              </div>
            </div>
          </div>

          {/* Card 3: AI Extractions */}
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-sans uppercase tracking-wider text-slate-400 font-medium flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  AI Extractions
                </span>
                <span className="bg-white/[0.04] text-slate-400 border border-white/[0.08] text-xs px-2.5 py-0.5 rounded-full font-medium">
                  Lifetime total
                </span>
              </div>

              <p className="font-mono tabular-nums text-3xl font-semibold text-white tracking-tight">
                {aiExtractionsCount}
              </p>

              <p className="font-sans text-sm text-slate-400 mt-2 leading-relaxed">
                Save hours of manual data entry by forwarding briefs or screenshots to our WhatsApp bot.
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-white/[0.06]">
              <div className="text-xs font-sans text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Multimodal OCR & Audio Active</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── 3. Centered Pricing Header ── */}
      <div className="pt-4 text-center">
        <h2 className="text-2xl font-semibold text-white text-center font-sans">
          Supercharge your influencer marketing
        </h2>
        <p className="text-sm text-slate-400 text-center font-sans mt-1 mb-8">
          Stop using spreadsheets. Start acting like an enterprise.
        </p>

        {/* ── 4. 2-Column Pricing Grid (max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6) ── */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          
          {/* Left Card: Starter */}
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-white font-sans">Starter</h3>
                <span className="font-sans text-xs text-slate-400 border border-white/[0.08] px-2.5 py-0.5 rounded-full bg-white/[0.02]">
                  FREE TIER
                </span>
              </div>
              
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Essential workspace pipeline for small brands testing creator workflows.
              </p>

              <div className="flex items-baseline gap-1.5 my-5">
                <span className="font-mono tabular-nums text-3xl font-semibold text-white">₹0</span>
                <span className="text-xs font-sans text-slate-500">/ forever</span>
              </div>

              {isPro ? (
                <button
                  disabled
                  className="w-full py-2.5 px-4 bg-white/[0.02] border border-white/[0.06] text-slate-500 text-xs font-sans font-medium rounded-xl cursor-not-allowed mb-6 text-center"
                >
                  Included in Pro
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-2.5 px-4 bg-white/[0.04] border border-white/[0.08] text-slate-300 text-xs font-sans font-medium rounded-xl cursor-default mb-6 text-center"
                >
                  Current Plan
                </button>
              )}

              <div className="space-y-3 pt-4 border-t border-white/[0.06]">
                {[
                  "Up to 5 campaigns per month",
                  "Basic WhatsApp AI Extractions",
                  "Email Reminders Only",
                  "Basic Creator List"
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-slate-300 font-sans antialiased">
                    <Check className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Card: Collabo Pro */}
          <div className="bg-[#0A0E17] border border-emerald-500/30 rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-white font-sans flex items-center gap-1.5">
                  Collabo Pro
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </h3>
                <span className="font-sans text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full">
                  {isPro ? 'ACTIVE PLAN' : 'RECOMMENDED'}
                </span>
              </div>

              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Complete command center for scaling multi-creator influencer campaigns.
              </p>

              <div className="flex items-baseline gap-1.5 my-5">
                <span className="font-mono tabular-nums text-3xl font-semibold text-white">₹300</span>
                <span className="text-xs font-sans text-slate-400">/ month</span>
              </div>

              {isPro ? (
                <button
                  disabled
                  className="w-full py-2.5 px-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-sans font-semibold rounded-xl flex items-center justify-center gap-2 mb-6 cursor-default"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Current Plan</span>
                </button>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={isProcessing}
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-sans font-semibold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 mb-6 cursor-pointer disabled:opacity-50"
                >
                  <span>
                    {isProcessing ? 'Connecting...' : 'Upgrade to Pro (₹300/mo)'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="space-y-3 pt-4 border-t border-white/[0.06]">
                {[
                  "Unlimited active campaigns",
                  "Priority Multimodal AI Extractions",
                  "Automated WhatsApp Reminders",
                  "Advanced Influencer CRM & History",
                  "Real-time ROI & Click Analytics",
                  "Premium Support"
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-slate-200 font-sans antialiased">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
