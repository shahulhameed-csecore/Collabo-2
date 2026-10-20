'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Settings, MessageSquare, AlertCircle, 
  Bell, Mail, Copy, Check, Send, Smartphone,
  CreditCard, ExternalLink, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  saveWhatsAppNumber, 
  getWhatsAppNumber, 
  verifyWhatsAppConnection, 
  getApiErrorMessage, 
  getBillingUsage, 
  BillingUsage, 
  generateWhatsAppCode, 
  unlinkWhatsApp 
} from '@/lib/api';
import { IS_TESTING_PHASE } from '@/lib/config';
import { createClient } from '@/lib/supabase';

interface SubscriptionData {
  tier: string;
  is_paid?: boolean;
  trial_ends_at?: string | null;
}

export default function SettingsPage() {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [waEnabled, setWaEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingWA, setIsSavingWA] = useState(false);
  const [isSavingReminders, setIsSavingReminders] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  
  // Verification states
  const [isVerifyingWA, setIsVerifyingWA] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const botNumber = process.env.NEXT_PUBLIC_BOT_NUMBER || "+91 6374771074";

  const handleCopy = () => {
    navigator.clipboard.writeText(botNumber);
    setCopied(true);
    toast.success('Bot number copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        // Parallelize direct Supabase queries, WhatsApp settings, and billing usage fetching
        const [dbResult, waResult, billingResult] = await Promise.allSettled([
          userId
            ? Promise.all([
                supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
                supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
              ])
            : Promise.resolve([null, null]),
          getWhatsAppNumber(),
          getBillingUsage(),
        ]);

        if (dbResult.status === 'fulfilled' && dbResult.value) {
          const [settingsRes, subRes] = dbResult.value as any;
          const userSettings = settingsRes?.data;
          const subData = subRes?.data;

          if (userSettings) {
            if (userSettings.whatsapp_number) setWhatsappNumber(userSettings.whatsapp_number);
            if (userSettings.telegram_username) setTelegramUsername(userSettings.telegram_username);
            if (userSettings.email_reminders_enabled !== undefined) setEmailEnabled(userSettings.email_reminders_enabled);
            if (userSettings.whatsapp_reminders_enabled !== undefined) setWaEnabled(userSettings.whatsapp_reminders_enabled);
          }
          if (subData) {
            setSubscriptionData(subData);
          }
        }

        if (waResult.status === 'fulfilled' && waResult.value) {
          const settings = waResult.value;
          if (settings.whatsapp_number) setWhatsappNumber(settings.whatsapp_number);
          if (settings.telegram_username) setTelegramUsername(settings.telegram_username);
          if (settings.email_reminders_enabled !== undefined) setEmailEnabled(settings.email_reminders_enabled);
          if (settings.whatsapp_reminders_enabled !== undefined) setWaEnabled(settings.whatsapp_reminders_enabled);
        }

        if (billingResult.status === 'fulfilled' && billingResult.value) {
          setUsage(billingResult.value);
        }
      } catch (error) {
        console.warn("Notice: settings initial load:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const isPro = IS_TESTING_PHASE || 
    usage?.current_plan === 'pro' || 
    Boolean(usage?.is_paid) || 
    subscriptionData?.tier === 'pro' || 
    Boolean(subscriptionData?.is_paid);

  const formatMaskedPhone = (num: string) => {
    if (!num) return '';
    const clean = num.startsWith('+') ? num : `+${num}`;
    if (clean.length > 4) {
      return clean.slice(0, -4) + '****';
    }
    return clean;
  };

  const handleGenerateCode = async () => {
    if (!isPro) {
      toast.error('WhatsApp integration is a Pro feature. Please upgrade your subscription.');
      return;
    }
    setIsSavingWA(true);
    try {
      const response = await generateWhatsAppCode();
      setPairingCode(response.code);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to generate code. Please try again.'));
    } finally {
      setIsSavingWA(false);
    }
  };

  const handleUnlinkWA = async () => {
    setIsSavingWA(true);
    try {
      await unlinkWhatsApp();
      setWhatsappNumber('');
      setPairingCode(null);
      toast.success('WhatsApp account unlinked successfully');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to unlink WhatsApp account.'));
    } finally {
      setIsSavingWA(false);
    }
  };

  const handleVerifyWA = async () => {
    if (!isPro) {
      toast.error('WhatsApp integration is a Pro feature. Please upgrade your subscription.');
      return;
    }
    setIsVerifyingWA(true);
    try {
      await verifyWhatsAppConnection();
      toast.success('Test ping sent successfully! Your WhatsApp is connected.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to verify connection.'));
    } finally {
      setIsVerifyingWA(false);
    }
  };

  // Instant auto-save toggle for Email reminders
  const handleToggleEmail = async () => {
    const nextVal = !emailEnabled;
    setEmailEnabled(nextVal);
    try {
      await saveWhatsAppNumber({
        whatsapp_number: whatsappNumber,
        telegram_username: telegramUsername,
        email_reminders_enabled: nextVal,
        whatsapp_reminders_enabled: waEnabled
      });
      toast.success(nextVal ? 'Email reminders enabled' : 'Email reminders disabled');
    } catch (error) {
      setEmailEnabled(!nextVal);
      toast.error(getApiErrorMessage(error, 'Failed to update reminder settings.'));
    }
  };

  // Instant auto-save toggle for WhatsApp reminders
  const handleToggleWA = async () => {
    const nextVal = !waEnabled;
    setWaEnabled(nextVal);
    try {
      await saveWhatsAppNumber({
        whatsapp_number: whatsappNumber,
        telegram_username: telegramUsername,
        email_reminders_enabled: emailEnabled,
        whatsapp_reminders_enabled: nextVal
      });
      toast.success(nextVal ? 'WhatsApp reminders enabled' : 'WhatsApp reminders disabled');
    } catch (error) {
      setWaEnabled(!nextVal);
      toast.error(getApiErrorMessage(error, 'Failed to update reminder settings.'));
    }
  };

  // Explicit Save Preferences button
  const handleSavePreferences = async () => {
    setIsSavingReminders(true);
    try {
      await saveWhatsAppNumber({
        whatsapp_number: whatsappNumber,
        telegram_username: telegramUsername,
        email_reminders_enabled: emailEnabled,
        whatsapp_reminders_enabled: waEnabled
      });
      toast.success('Preferences saved successfully');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save preferences.'));
    } finally {
      setIsSavingReminders(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-16 animate-fade-in select-none">
      
      {/* ── Page Header ── */}
      <div className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white font-sans">
              Settings
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-sans mt-0.5">
              Manage integrations, notifications, and application preferences.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        /* ── Skeletons ── */
        <div className="space-y-8 animate-pulse pt-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-44 bg-slate-100 dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-white/[0.06]">
          
          {/* ── SECTION 1: Subscription Plan ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 border-b border-slate-200 dark:border-white/[0.06] items-start">
            {/* Left Side: Open Canvas, NO box border */}
            <div className="lg:col-span-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-3 font-sans">
                Subscription Plan
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-sans leading-relaxed mt-1">
                Manage your workspace tier, billing status, and unlocked platform quotas.
              </p>
            </div>

            {/* Right Side: Clean Card Container */}
            <div className="lg:col-span-7">
              <div className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans font-medium">Current Plan</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        isPro 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                          : 'bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08]'
                      }`}>
                        {isPro ? 'PRO' : 'STARTER'}
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 font-sans">
                      {isPro ? 'Collabo Pro' : 'Starter Plan (Free)'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">
                      {isPro 
                        ? 'Unlimited campaign pipelines, priority AI brief parsing, and automated alerts.' 
                        : 'Free tier includes basic deal tracking. Upgrade for unlimited scale.'}
                    </p>
                  </div>
                  
                  <Link
                    href="/billing"
                    className="inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white px-4 py-2.5 rounded-xl text-xs font-sans font-medium transition cursor-pointer shrink-0"
                  >
                    <span>Manage Billing</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 2: WhatsApp AI Bot ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 border-b border-slate-200 dark:border-white/[0.06] items-start">
            {/* Left Side: Open Canvas, NO box border */}
            <div className="lg:col-span-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-3 font-sans">
                WhatsApp AI Bot
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-sans leading-relaxed mt-1">
                Forward creator negotiations, audio notes, and screenshots for zero-touch brief extraction.
              </p>
            </div>

            {/* Right Side: Clean Card Container */}
            <div className="lg:col-span-7">
              <div className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-2xl p-6 shadow-sm space-y-5">
                {/* Official Bot Number Pill */}
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/[0.06]">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">Official AI Bot Number:</span>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-2 text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 transition active:scale-95 cursor-pointer group"
                    title="Click to copy bot number"
                  >
                    <span className="text-slate-500 dark:text-slate-400 font-sans text-[11px]">Bot:</span>
                    <span className="font-mono text-slate-900 dark:text-slate-200">{botNumber}</span>
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition shrink-0" />
                    )}
                  </button>
                </div>

                {whatsappNumber ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans font-medium">Connection Status</span>
                          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                            CONNECTED
                          </span>
                        </div>
                        <p className="text-lg font-mono font-semibold text-slate-900 dark:text-white tracking-wide">
                          {formatMaskedPhone(whatsappNumber)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                          Active encrypted connection for auto-deal extraction.
                        </p>
                      </div>

                      <button
                        onClick={handleUnlinkWA}
                        disabled={isSavingWA || isLoading}
                        className="font-sans text-xs text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200 bg-rose-500/10 dark:bg-rose-500/[0.08] hover:bg-rose-500/20 dark:hover:bg-rose-500/[0.15] border border-rose-500/20 px-4 py-2 rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-center"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{isSavingWA ? 'Unlinking...' : 'Unlink Number'}</span>
                      </button>
                    </div>

                    <div className="pt-3 border-t border-slate-200 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-xs font-sans text-slate-500 dark:text-slate-400">
                        Verify bot connectivity by dispatching a test ping:
                      </span>
                      <button
                        onClick={handleVerifyWA}
                        disabled={isVerifyingWA}
                        className="font-sans text-xs text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{isVerifyingWA ? 'Pinging...' : 'Send Test Ping'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans font-medium">Connection Status</span>
                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">
                          Disconnected
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                        Pair your WhatsApp to auto-extract creator agreements. Generate a secure 10-minute code below to connect.
                      </p>
                    </div>

                    {!pairingCode ? (
                      <button
                        onClick={handleGenerateCode}
                        disabled={isSavingWA || isLoading}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-sans font-semibold rounded-xl px-4 py-2.5 text-xs transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)] active:scale-95 cursor-pointer flex items-center gap-2"
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>{isSavingWA ? 'Generating...' : 'Generate Pairing Code'}</span>
                      </button>
                    ) : (
                      <div className="p-4 bg-slate-50 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-sans font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Your Pairing Code</p>
                          <p className="text-3xl font-mono font-bold tracking-widest text-emerald-600 dark:text-emerald-400 mt-0.5">{pairingCode}</p>
                          <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400 mt-1">Expires in 10 minutes. Send this code to our bot.</p>
                        </div>
                        <a 
                          href={`https://wa.me/${botNumber.replace(/[^0-9]/g, '')}?text=${pairingCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-[#25D366] hover:bg-[#20ba59] text-black font-sans text-xs font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2 transition active:scale-95 shrink-0"
                        >
                          <Smartphone className="w-4 h-4" /> Open in WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── SECTION 3: Notification Settings ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 border-b border-slate-200 dark:border-white/[0.06] items-start">
            {/* Left Side: Open Canvas, NO box border */}
            <div className="lg:col-span-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Bell className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-3 font-sans">
                Notification Settings
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-sans leading-relaxed mt-1">
                Configure delivery channels for campaign deadlines, reminders, and delivery alerts.
              </p>
            </div>

            {/* Right Side: Clean Card Container */}
            <div className="lg:col-span-7">
              <div className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-2xl p-6 shadow-sm space-y-4">
                
                {/* Email Reminders Toggle Row */}
                <div 
                  onClick={handleToggleEmail}
                  className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12] rounded-xl p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                      <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white font-sans">Email Reminders</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                        Receive 48h warnings and overdue alerts directly in your inbox.
                      </p>
                    </div>
                  </div>

                  {/* Smooth Linear Switch */}
                  <div className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
                    emailEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/[0.1]'
                  }`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                      emailEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </div>
                </div>

                {/* WhatsApp Reminders Toggle Row */}
                <div 
                  onClick={handleToggleWA}
                  className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12] rounded-xl p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                      <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white font-sans">WhatsApp Reminders</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                        Get real-time deadline notifications and instant ping alerts on WhatsApp.
                      </p>
                    </div>
                  </div>

                  {/* Smooth Linear Switch */}
                  <div className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
                    waEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/[0.1]'
                  }`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                      waEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-[11px] text-slate-500 font-sans">
                    Changes auto-save. Click button for explicit confirmation.
                  </p>
                  <button
                    onClick={handleSavePreferences}
                    disabled={isSavingReminders}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white text-xs font-sans font-medium rounded-xl px-4 py-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingReminders ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* ── SECTION 4: App Preferences ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 items-start">
            {/* Left Side: Open Canvas, NO box border */}
            <div className="lg:col-span-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Settings className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-3 font-sans">
                App Preferences
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-sans leading-relaxed mt-1">
                Customize local interface behaviors and guided walk-through walkthroughs.
              </p>
            </div>

            {/* Right Side: Clean Card Container */}
            <div className="lg:col-span-7">
              <div className="bg-white dark:bg-[#0A0E17] border border-slate-200 dark:border-white/[0.07] rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white font-sans">Onboarding Tour</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-sans mt-1">
                    Restart the guided interactive dashboard tour from the beginning.
                  </p>
                </div>
                <button
                  onClick={() => {
                    Object.keys(localStorage).forEach(key => {
                      if (key.startsWith('collabo_tour_completed')) {
                        localStorage.removeItem(key);
                      }
                    });
                    window.location.href = '/dashboard';
                  }}
                  className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white text-xs font-sans font-medium rounded-xl px-4 py-2.5 transition active:scale-95 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Restart Tour</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
