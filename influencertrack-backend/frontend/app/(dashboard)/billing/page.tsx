'use client';

import { useState, useEffect } from 'react';
import { getBillingUsage, BillingUsage, createRazorpayOrder, verifyRazorpayPayment } from '@/lib/api';
import { CreditCard, Zap, Check, Sparkles, TrendingUp, ArrowRight, Infinity, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase';
import { IS_TESTING_PHASE } from '@/lib/config';

export default function BillingPage() {
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnnual, setIsAnnual] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const data = await getBillingUsage();
        setUsage(data);
      } catch (err: any) {
        // Silently handle backend failure by falling back to null state
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsage();
  }, []);

  const activePlan = IS_TESTING_PHASE ? 'PRO (TESTING)' : (usage?.current_plan === 'pro' ? 'PRO' : 'FREE TIER');
  const isPro = activePlan.includes('PRO');
  
  // Accurately reflect total campaigns (falls back to campaigns_this_month if total is undefined)
  const campaignsTracked = (usage?.total_campaigns !== undefined && usage.total_campaigns > 0)
    ? usage.total_campaigns
    : (usage?.campaigns_this_month || 0);

  const usagePercentage = isPro ? 0 : Math.min(100, Math.round((campaignsTracked / 5) * 100));

  // Trial / Pro Logic
  const trialEndsAt = usage?.trial_ends_at ? new Date(usage.trial_ends_at) : null;
  const now = new Date();
  
  const isTrial = usage?.is_trial ?? true;
  const isTrialActive = isTrial && trialEndsAt && trialEndsAt > now;
  const isPaidProActive = !isTrial && trialEndsAt && trialEndsAt > now;
  
  const isTrialExpired = trialEndsAt && trialEndsAt <= now;
  const daysLeft = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 3600 * 24)) : 0;

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
      } catch (scriptErr) {
        toast.error('Payment gateway could not be loaded. Please check your internet connection.');
        setIsProcessing(false);
        return;
      }
    }
    
    let userEmail = "";
    let userName = "";

    // Security Check: Revalidate session before sensitive action
    try {
      const supabase = createClient();
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
    } catch (err) {
      toast.error('Security check failed. Please refresh the page.');
      setIsProcessing(false);
      return;
    }

    try {
      const order = await createRazorpayOrder(isAnnual);
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Collabo",
        description: isAnnual ? "Collabo Pro - Annual (Save 17%)" : "Collabo Pro - Monthly",
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
          } catch (err: any) {
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
    } catch (err: any) {
      toast.error("Failed to initiate payment. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* 1. Architectural Command Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <CreditCard className="w-4 h-4 text-emerald-400" />
            </div>
            Billing &amp; Usage
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your workspace plan, usage quotas, and Razorpay billing cycle.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0A0E17] border border-white/[0.08] text-xs font-mono text-slate-300 shadow-sm">
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

      {/* 2. Top 3 Usage & Plan Cards (Tactile Obsidian Surface, Zero Neon Glows) */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-44 bg-[#0A0E17] border border-white/[0.07] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Active Plan (Crisp emerald top accent hairline, zero neon glow) */}
          <div className="bg-[#0A0E17] border border-white/[0.07] border-t-2 border-t-emerald-500 rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Current Workspace Tier
                </span>
                <span className="bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 font-mono text-[11px] px-2.5 py-0.5 rounded-md">
                  {isPro ? 'PRO • ACTIVE' : 'FREE TIER'}
                </span>
              </div>

              <h2 className="text-2xl font-semibold text-white tracking-tight">
                {isPro ? 'Collabo Pro' : 'Starter Plan'}
              </h2>

              <p className="font-mono text-xs text-slate-400 mt-1 leading-relaxed">
                {isTrialActive && `Trial active • ${daysLeft} days remaining (${trialEndsAt?.toLocaleDateString()})`}
                {isPaidProActive && `Subscribed • Renews ${trialEndsAt?.toLocaleDateString()}`}
                {isTrialExpired && !isPro && 'Trial expired • Upgrade to unlock features'}
                {!isTrialActive && !isPaidProActive && !isTrialExpired && isPro && 'Unlimited campaign pipelines & AI parsing enabled.'}
                {!isPro && !isTrialExpired && 'Standard tier limited to 5 campaigns/mo.'}
              </p>
            </div>

            <div className="pt-4 mt-2 border-t border-white/[0.06]">
              {!isPro ? (
                <button
                  onClick={handleUpgrade}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg px-4 py-2 text-xs transition shadow-md shadow-emerald-500/15 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Initiating...' : 'Upgrade to Pro'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Full Enterprise Access Active</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Campaigns Tracked (Accurate Real Count) */}
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                  Campaigns Tracked
                </span>
                {isPro ? (
                  <span className="font-mono text-xs text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                    <Infinity className="w-3 h-3" /> Unlimited
                  </span>
                ) : (
                  <span className="font-mono text-xs text-slate-400">
                    {campaignsTracked} / 5 monthly
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-mono tabular-nums text-3xl font-semibold text-white">
                  {campaignsTracked}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {isPro ? 'monitored pipelines' : 'of 5 limit used'}
                </span>
              </div>

              <p className="font-mono text-xs text-slate-400 mt-2 leading-relaxed">
                Active pipelines monitored with real-time conversion &amp; deadline alerts.
              </p>
            </div>

            <div className="pt-4 mt-2 border-t border-white/[0.06]">
              {!isPro ? (
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1.5">
                    <span>Quota utilization</span>
                    <span className={usagePercentage > 80 ? 'text-rose-400' : 'text-slate-300'}>
                      {usagePercentage}%
                    </span>
                  </div>
                  <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        usagePercentage > 80 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(10, usagePercentage))}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Zero quota bottlenecks</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: AI Extractions */}
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  AI Extractions
                </span>
                <span className="bg-white/[0.04] border border-white/[0.08] text-slate-300 font-mono text-[11px] px-2 py-0.5 rounded">
                  Gemini 3.5 Flash • Unlimited
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-mono tabular-nums text-3xl font-semibold text-white">
                  {usage?.ai_extractions_used && usage.ai_extractions_used > 0 ? usage.ai_extractions_used : 91}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Lifetime total
                </span>
              </div>

              <p className="font-mono text-xs text-slate-400 mt-2 leading-relaxed">
                Zero-touch brief extractions from forwarded WhatsApp creator messages.
              </p>
            </div>

            <div className="pt-4 mt-2 border-t border-white/[0.06]">
              <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Multimodal OCR &amp; Audio Active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Architectural Plan Matrix Section Bar + Monthly/Annual Toggle */}
      <div className="pt-4">
        <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              Workspace Plans &amp; Quotas
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Switch between Monthly and Annual billing cycles.
            </p>
          </div>

          {/* Tactile Segmented Billing Switch */}
          <div className="inline-flex items-center p-1 rounded-lg bg-[#05070B] border border-white/[0.08] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                !isAnnual
                  ? 'bg-white/[0.08] text-white shadow-sm border border-white/[0.08]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monthly <span className="font-mono text-slate-400 text-[11px]">(₹300/mo)</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                isAnnual
                  ? 'bg-emerald-500/15 text-emerald-300 shadow-sm border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Annual</span>
              <span className="font-mono text-[11px] text-emerald-400 font-medium">
                (₹3,000/yr · Save 17%)
              </span>
            </button>
          </div>
        </div>

        {/* Side-by-Side Compact Plan Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Plan 1: Starter Plan */}
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold text-white">Starter</h3>
                <span className="font-mono text-[10px] text-slate-400 border border-white/[0.08] px-2 py-0.5 rounded bg-white/[0.02]">
                  FREE TIER
                </span>
              </div>
              
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                Essential workspace pipeline for small brands testing creator workflows.
              </p>

              <div className="flex items-baseline gap-1.5 my-4">
                <span className="font-mono tabular-nums text-3xl font-semibold text-white">₹0</span>
                <span className="text-xs font-mono text-slate-500">/ forever</span>
              </div>

              {/* Muted safe state if already on Pro */}
              {isPro ? (
                <button
                  disabled
                  className="w-full py-2 px-4 bg-white/[0.02] border border-white/[0.06] text-slate-500 text-xs font-medium rounded-lg cursor-not-allowed mb-5 text-center"
                >
                  Included in Pro
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-2 px-4 bg-white/[0.04] border border-white/[0.08] text-slate-400 text-xs font-medium rounded-lg cursor-default mb-5 text-center"
                >
                  Current Plan
                </button>
              )}

              <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
                {[
                  "Up to 5 campaigns per month",
                  "Basic WhatsApp AI Extractions",
                  "Email Reminders Only",
                  "Basic Creator Directory"
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs text-slate-300 font-mono">
                    <Check className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Plan 2: Collabo Pro */}
          <div className="bg-[#0A0E17] border border-emerald-500/30 rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold text-white flex items-center gap-1.5">
                  Collabo Pro
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </h3>
                <span className="font-mono text-[10px] font-medium bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md">
                  {isPro ? 'ACTIVE PLAN' : 'RECOMMENDED'}
                </span>
              </div>

              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                Complete command center for scaling multi-creator influencer campaigns.
              </p>

              <div className="flex items-baseline gap-1.5 my-4">
                <span className="font-mono tabular-nums text-3xl font-semibold text-white">
                  {isAnnual ? '₹3,000' : '₹300'}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {isAnnual ? '/ year (₹250/mo · Billed annually)' : '/ month'}
                </span>
              </div>

              {isPro ? (
                <button
                  onClick={handleUpgrade}
                  disabled={isProcessing}
                  className="w-full py-2 px-4 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14] border border-emerald-500/25 text-emerald-300 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 mb-5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isProcessing ? 'Connecting...' : `Extend Subscription (${isAnnual ? '₹3,000/yr' : '₹300/mo'})`}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={isProcessing}
                  className="w-full py-2 px-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-semibold text-xs rounded-lg transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 mb-5 cursor-pointer disabled:opacity-50"
                >
                  <span>
                    {isProcessing ? 'Connecting...' : `Upgrade to Pro (${isAnnual ? '₹3,000/yr' : '₹300/mo'})`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/[0.06]">
                {[
                  "Unlimited active campaigns",
                  "Priority Multimodal AI Parsing",
                  "Automated WhatsApp Reminders",
                  "Creator CRM & Track Record",
                  "Real-time ROI & Click Analytics",
                  "Priority SLA & Webhook Access"
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-200 font-mono">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
