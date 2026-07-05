'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getBillingUsage, BillingUsage, createRazorpayOrder, verifyRazorpayPayment } from '@/lib/api';
import { CreditCard, Zap, Check, Shield, Sparkles, TrendingUp, Star, ArrowRight, Infinity } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { IS_TESTING_PHASE } from '@/lib/config';

export default function BillingPage() {
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnnual, setIsAnnual] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const data = await getBillingUsage();
        setUsage(data);
      } catch (err) {
        // Silently handle backend failure by falling back to null state
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsage();
  }, []);

  const activePlan = IS_TESTING_PHASE ? 'PRO (TESTING)' : (usage?.current_plan === 'pro' ? 'PRO' : 'FREE TIER');
  const isPro = activePlan.includes('PRO');
  const campaignsUsed = usage?.campaigns_this_month || 0;
  const usagePercentage = isPro ? 0 : Math.min(100, Math.round((campaignsUsed / 5) * 100));

  // Trial Logic
  const trialEndsAt = usage?.trial_ends_at ? new Date(usage.trial_ends_at) : null;
  const now = new Date();
  const isTrialActive = trialEndsAt && trialEndsAt > now;
  const isTrialExpired = trialEndsAt && trialEndsAt <= now;
  const daysLeftInTrial = isTrialActive ? Math.ceil((trialEndsAt!.getTime() - now.getTime()) / (1000 * 3600 * 24)) : 0;

  const handleUpgrade = async () => {
    if (IS_TESTING_PHASE && !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      toast.info('Payments are currently disabled during the testing phase.');
      return;
    }
    
    try {
      const order = await createRazorpayOrder(isAnnual);
      
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Collabo",
        description: isAnnual ? "Collabo Pro - Annual" : "Collabo Pro - Monthly",
        order_id: order.order_id,
        handler: async function (response: any) {
          try {
            await verifyRazorpayPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success("Payment successful! You are now on the Pro plan.");
            // Refresh usage
            const data = await getBillingUsage();
            setUsage(data);
          } catch (err) {
            toast.error("Payment verification failed.");
          }
        },
        theme: {
          color: "#10b981"
        }
      };
      
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any){
        toast.error(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err) {
      toast.error("Failed to initiate payment. Please try again.");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <CreditCard className="w-4 h-4 text-emerald-400" />
              </div>
              Usage &amp; Billing
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Manage your plan, billing details, and usage.</p>
          </div>
        </div>

        {/* Current Usage Overview */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="h-56 bg-slate-100 dark:bg-slate-800/50 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Upgrade CTA / Active Plan Card */}
            <div className="relative group md:col-span-1 rounded-3xl p-[1px] bg-gradient-to-b from-emerald-400 to-teal-600 shadow-xl shadow-emerald-500/10 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-300/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="bg-white dark:bg-slate-950/90 h-full w-full rounded-[23px] p-6 relative z-10 flex flex-col justify-between backdrop-blur-xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-300">Active Plan</h3>
                    <div className="flex flex-col items-end gap-1">
                      <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                        {activePlan}
                      </span>
                      {isTrialActive && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Trial: {daysLeftInTrial} days left
                        </span>
                      )}
                      {isTrialExpired && !isPro && (
                        <span className="text-[10px] font-bold text-rose-500">
                          Trial Expired
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                    {isTrialActive 
                      ? "You are currently on a free trial of the Pro plan. Upgrade to maintain access after your trial expires."
                      : (isPro 
                          ? "You are currently on the Pro plan with unlimited campaigns, deep analytics, and CRM."
                          : "You're currently on the free plan. Upgrade to unlock unlimited campaigns, deep analytics, and CRM.")}
                  </p>
                </div>
                {!isPro && (
                  <button onClick={handleUpgrade} className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold rounded-xl px-5 py-3 transition-all shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5">
                    <Sparkles className="w-4 h-4" /> Upgrade to Pro
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  Campaigns Tracked
                </h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <p className="text-4xl font-extrabold text-slate-900 dark:text-white">{campaignsUsed}</p>
                  {isPro ? (
                    <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">
                      <Infinity className="w-4 h-4" />
                      Unlimited
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-slate-400">/ 5</p>
                  )}
                </div>
              </div>
              <div>
                {!isPro ? (
                  <>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      <span>Usage limit</span>
                      <span className={usagePercentage > 80 ? 'text-rose-400' : 'text-slate-500'}>{usagePercentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          usagePercentage > 80
                            ? 'bg-gradient-to-r from-rose-500 to-red-400'
                            : 'bg-gradient-to-r from-purple-500 to-violet-400'
                        }`}
                        style={{ width: `${usagePercentage}%` }}
                      />
                    </div>
                    {usagePercentage > 80 && (
                      <p className="text-xs text-rose-500 font-semibold mt-2">Approaching free limit — consider upgrading.</p>
                    )}
                  </>
                ) : (
                  <div className="h-2" />
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  AI Extractions
                </h3>
                <div className="flex items-end gap-2">
                  <p className="text-4xl font-black text-slate-900 dark:text-white">{usage?.ai_extractions_used || 0}</p>
                  <p className="text-sm font-semibold text-slate-400 mb-1">Lifetime total</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                Save hours of manual data entry by forwarding briefs or screenshots to our WhatsApp bot.
              </p>
            </div>
          </div>
        )}

        {/* Pricing Table */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Supercharge your influencer marketing</h2>
          <p className="text-slate-500 text-sm mb-8">Stop using spreadsheets. Start acting like an enterprise.</p>
          
          <div className="flex justify-center mb-8">
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-700/50">
              <button 
                onClick={() => setIsAnnual(false)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${!isAnnual ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setIsAnnual(true)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${isAnnual ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Yearly <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded-full">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
            {/* Free Plan */}
            <div className="bg-white dark:bg-slate-900/40 p-8 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm relative">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Starter</h3>
              <p className="text-sm text-slate-500 mb-6 h-10">Perfect for small brands testing the waters.</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black text-slate-900 dark:text-white">₹0</span>
                <span className="text-slate-500 font-medium">/ forever</span>
              </div>
              {!isPro ? (
                <button className="w-full py-3 px-5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl mb-8 cursor-default">
                  Current Plan
                </button>
              ) : (
                <button className="w-full py-3 px-5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors mb-8">
                  Downgrade
                </button>
              )}
              <ul className="space-y-4">
                {[
                  "Up to 5 campaigns per month",
                  "Basic WhatsApp AI Extractions",
                  "Email Reminders Only",
                  "Basic Creator List"
                ].map((feat, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400 font-medium">
                    <Check className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro Plan */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 dark:from-slate-900 dark:to-[#0A0F1C] p-8 rounded-3xl border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="absolute top-4 right-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/20 text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider">
                <Star className="w-3 h-3 fill-white" /> Most Popular
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2 relative z-10 flex items-center gap-2">
                Collabo Pro <Sparkles className="w-4 h-4 text-emerald-400" />
              </h3>
              <p className="text-sm text-slate-400 mb-6 h-10 relative z-10">Everything you need to scale influencer marketing profitably.</p>
              <div className="flex items-baseline gap-1 mb-6 relative z-10">
                <span className="text-4xl font-black text-white">{isAnnual ? '₹249' : '₹299'}</span>
                <span className="text-slate-400 font-medium">/ month</span>
              </div>
              
              {isPro ? (
                <button className="relative z-10 w-full py-3 px-5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl mb-8 cursor-default">
                  Current Plan
                </button>
              ) : (
                <button onClick={handleUpgrade} className="relative z-10 w-full py-3 px-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25 mb-8 flex items-center justify-center gap-2 group/btn hover:-translate-y-0.5">
                  Upgrade to Pro <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              )}
              
              <ul className="space-y-4 relative z-10">
                {[
                  "Unlimited active campaigns",
                  "Priority Multimodal AI Extractions",
                  "Automated WhatsApp Reminders",
                  "Advanced Influencer CRM & History",
                  "Real-time ROI & Click Analytics",
                  "Premium Support"
                ].map((feat, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300 font-medium">
                    <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
