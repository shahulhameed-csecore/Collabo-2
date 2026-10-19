'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, MessageSquare, Phone, AlertCircle, 
  Bell, Mail, Copy, Check, Info, ShieldCheck, Send, Smartphone, Sparkles, CreditCard, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  saveWhatsAppNumber, 
  getWhatsAppNumber, 
  verifyWhatsAppConnection, 
  getApiErrorMessage, 
  getBillingUsage, 
  BillingUsage, 
  createRazorpayOrder, 
  verifyRazorpayPayment, 
  generateWhatsAppCode, 
  unlinkWhatsApp, 
  generateTelegramCode, 
  unlinkTelegram 
} from '@/lib/api';
import { IS_TESTING_PHASE } from '@/lib/config';
import { createClient } from '@/lib/supabase';

export default function SettingsPage() {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [waEnabled, setWaEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingWA, setIsSavingWA] = useState(false);
  const [isSavingTG, setIsSavingTG] = useState(false);
  const [isSavingReminders, setIsSavingReminders] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  
  // Verification states
  const [waVerificationStatus, setWaVerificationStatus] = useState<'none' | 'pending' | 'connected' | 'failed'>('none');
  const [isVerifyingWA, setIsVerifyingWA] = useState(false);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [tgPairingCode, setTgPairingCode] = useState<string | null>(null);

  const botNumber = process.env.NEXT_PUBLIC_BOT_NUMBER || "+91 6374771074";
  const telegramBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "@collabo_bot";

  const handleCopy = () => {
    navigator.clipboard.writeText(botNumber);
    setCopied(true);
    toast.success('Bot number copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await getWhatsAppNumber();
        if (settings.whatsapp_number) {
          setWhatsappNumber(settings.whatsapp_number);
        }
        if (settings.telegram_username) {
          setTelegramUsername(settings.telegram_username);
        }
        if (settings.email_reminders_enabled !== undefined) {
          setEmailEnabled(settings.email_reminders_enabled);
          setWaEnabled(settings.whatsapp_reminders_enabled);
        }
        if (settings.verification_status) {
          setWaVerificationStatus(settings.verification_status as any);
        }
        if (settings.whatsapp_verified_at) {
          setLastVerifiedAt(new Date(settings.whatsapp_verified_at).toLocaleString());
        } else {
          setLastVerifiedAt(null);
        }
        const usageData = await getBillingUsage().catch(() => null);
        if (usageData) {
          setUsage(usageData);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const isPro = IS_TESTING_PHASE || usage?.current_plan === 'pro' || Boolean(usage?.is_paid);

  const handleSaveWA = async () => {
    if (whatsappNumber && !isPro) {
      toast.error('WhatsApp integration is a Pro feature. Please upgrade your subscription.');
      return;
    }
    setIsSavingWA(true);
    try {
      const response = await saveWhatsAppNumber({
        whatsapp_number: whatsappNumber,
        telegram_username: telegramUsername,
        email_reminders_enabled: emailEnabled,
        whatsapp_reminders_enabled: waEnabled
      });
      setWhatsappNumber(response.whatsapp_number || '');
      setWaVerificationStatus('none');
      setLastVerifiedAt(null);
      toast.success('WhatsApp integration updated successfully');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save settings. Please try again.'));
    } finally {
      setIsSavingWA(false);
    }
  };

  const handleSaveTG = async () => {
    setIsSavingTG(true);
    try {
      const response = await saveWhatsAppNumber({
        whatsapp_number: whatsappNumber,
        telegram_username: telegramUsername,
        email_reminders_enabled: emailEnabled,
        whatsapp_reminders_enabled: waEnabled
      });
      setTelegramUsername(response.telegram_username || '');
      toast.success('Telegram integration updated successfully');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save settings. Please try again.'));
    } finally {
      setIsSavingTG(false);
    }
  };

  const handleGenerateTGCode = async () => {
    setIsSavingTG(true);
    try {
      const response = await generateTelegramCode();
      setTgPairingCode(response.code);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to generate code. Please try again.'));
    } finally {
      setIsSavingTG(false);
    }
  };

  const handleUnlinkTG = async () => {
    setIsSavingTG(true);
    try {
      await unlinkTelegram();
      setTelegramUsername('');
      setTgPairingCode(null);
      toast.success('Telegram account unlinked successfully');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to unlink Telegram account.'));
    } finally {
      setIsSavingTG(false);
    }
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
      setWaVerificationStatus('none');
      setLastVerifiedAt(null);
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
    setWaVerificationStatus('pending');
    try {
      await verifyWhatsAppConnection();
      setWaVerificationStatus('connected');
      setLastVerifiedAt(new Date().toLocaleString());
      toast.success('Test message sent successfully! Your WhatsApp is connected.');
    } catch (error) {
      setWaVerificationStatus('failed');
      toast.error(getApiErrorMessage(error, 'Failed to verify connection.'));
    } finally {
      setIsVerifyingWA(false);
    }
  };

  const handleSaveReminders = async () => {
    setIsSavingReminders(true);
    try {
      const response = await saveWhatsAppNumber({
        whatsapp_number: whatsappNumber,
        telegram_username: telegramUsername,
        email_reminders_enabled: emailEnabled,
        whatsapp_reminders_enabled: waEnabled
      });
      setEmailEnabled(response.email_reminders_enabled);
      setWaEnabled(response.whatsapp_reminders_enabled);
      toast.success('Reminder preferences updated successfully');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save settings. Please try again.'));
    } finally {
      setIsSavingReminders(false);
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

  const handleUpgrade = async () => {
    if (IS_TESTING_PHASE && !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      toast.info('Payments are currently disabled during the testing phase.');
      return;
    }
    
    let userEmail = "";
    let userName = "";

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userEmail = session.user.email || "";
        userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || "";
      }
    } catch (err) {
      console.error("Failed to fetch session for prefill", err);
    }

    try {
      const order = await createRazorpayOrder();
      
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Collabo",
        description: "Collabo Pro - Monthly",
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
            toast.success("Payment successful! You are now on the Pro plan.");
            const data = await getBillingUsage();
            setUsage(data);
          } catch (_err) {
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
    } catch (_err) {
      toast.error("Failed to initiate payment. Please try again.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 animate-fade-in select-none">
      
      {/* ── Compact Architectural Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-emerald-400" />
            Workspace Settings
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Manage your subscription, AI ingestion channels, and deadline notification rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400 bg-white/[0.03] border border-white/[0.07] px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Security: E2E Encrypted
          </span>
        </div>
      </div>

      {isLoading ? (
        /* ── Skeletons ── */
        <div className="space-y-6 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 bg-[#0A0E17] border border-white/[0.07] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* ── 1. SECTION: Subscription Plan ── */}
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-6 shadow-2xl hover:border-white/[0.1] transition-colors">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Title & Description */}
              <div className="lg:col-span-4 space-y-1.5">
                <div className="flex items-center gap-2 text-white">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold tracking-tight">Subscription Plan</h2>
                </div>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  Manage your subscription tier, billing status, and unlocked platform quotas.
                </p>
              </div>

              {/* Right Column: Controls */}
              <div className="lg:col-span-8">
                <div className="bg-[#05070B] border border-white/[0.06] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Current Plan</span>
                      <span className={`text-[10px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${
                        isPro 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-white/[0.04] text-slate-400 border-white/[0.08]'
                      }`}>
                        {isPro ? 'Pro Active' : 'Starter Tier'}
                      </span>
                    </div>
                    <p className="text-base font-semibold text-white font-mono tracking-tight">
                      {isPro ? 'Collabo Pro' : 'Starter (Free)'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      {isPro 
                        ? 'Unlimited campaign pipelines & priority AI parsing enabled.' 
                        : 'Free tier includes basic deal tracking. Upgrade for unlimited scale.'}
                    </p>
                  </div>

                  {!isPro ? (
                    <button
                      onClick={handleUpgrade}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-medium rounded-lg px-4 py-2.5 text-xs transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95 cursor-pointer flex items-center gap-2 shrink-0"
                    >
                      Upgrade to Pro <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="font-mono text-xs text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0">
                      <Check className="w-3.5 h-3.5" /> Full Enterprise Access
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* ── 2. SECTION: WhatsApp AI Bot ── */}
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-6 shadow-2xl hover:border-white/[0.1] transition-colors">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Title & Description */}
              <div className="lg:col-span-4 space-y-1.5">
                <div className="flex items-center gap-2 text-white">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold tracking-tight">WhatsApp AI Bot</h2>
                </div>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  Connect your number to forward negotiations, audio notes, and screenshots for zero-touch brief extraction.
                </p>

                {/* Bot Number Snippet */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                    <span className="truncate">Bot: {botNumber}</span>
                    <button 
                      onClick={handleCopy} 
                      className="text-slate-400 hover:text-white transition cursor-pointer p-0.5 ml-2 shrink-0"
                      title="Copy bot number"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Controls */}
              <div className="lg:col-span-8">
                {whatsappNumber ? (
                  <div className="bg-[#05070B] border border-white/[0.06] rounded-lg p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Connection Status</span>
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">
                            Connected
                          </span>
                        </div>
                        <p className="text-base font-semibold text-white font-mono tracking-wide">
                          {whatsappNumber.substring(0, whatsappNumber.length - 4) + '****'}
                        </p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          {lastVerifiedAt ? `Last active: ${lastVerifiedAt}` : 'Active encrypted connection'}
                        </p>
                      </div>

                      <button
                        onClick={handleUnlinkWA}
                        disabled={isSavingWA || isLoading}
                        className="bg-rose-500/[0.08] hover:bg-rose-500/[0.15] border border-rose-500/25 text-rose-300 font-medium rounded-xl px-4 py-2 text-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        {isSavingWA ? 'Unlinking...' : 'Unlink Number'}
                      </button>
                    </div>

                    <div className="pt-3 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-[11px] font-mono text-slate-400">
                        Verify real-time bot connectivity by dispatching a test ping:
                      </span>
                      <button
                        onClick={handleVerifyWA}
                        disabled={isVerifyingWA}
                        className="font-mono text-xs text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-400" />
                        {isVerifyingWA ? 'Pinging...' : 'Send Test Ping'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#05070B] border border-white/[0.06] rounded-lg p-5 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Connection Status</span>
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">
                          Disconnected
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-sans leading-relaxed mt-1">
                        Connect your WhatsApp to forward briefs, voice notes, and agreements directly to Collabo AI.
                        Generate a secure 10-minute pairing code below to pair your account.
                      </p>
                    </div>

                    {!pairingCode ? (
                      <button
                        onClick={handleGenerateCode}
                        disabled={isSavingWA || isLoading}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-medium rounded-lg px-4 py-2 text-xs transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95 cursor-pointer flex items-center gap-2"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        {isSavingWA ? 'Generating...' : 'Generate Pairing Code'}
                      </button>
                    ) : (
                      <div className="p-4 bg-black/40 rounded-xl border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-wider">Your Pairing Code</p>
                          <p className="text-3xl font-mono font-bold tracking-widest text-emerald-400 mt-0.5">{pairingCode}</p>
                          <p className="text-[11px] font-mono text-slate-400 mt-1">Expires in 10 minutes. Send code to our bot.</p>
                        </div>
                        <a 
                          href={`https://wa.me/${botNumber.replace(/[^0-9]/g, '')}?text=${pairingCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-[#25D366] hover:bg-[#20ba59] text-black font-mono text-xs font-semibold rounded-lg px-4 py-2.5 flex items-center gap-2 transition active:scale-95 shrink-0"
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

          {/* ── 3. SECTION: Notification Settings ── */}
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-6 shadow-2xl hover:border-white/[0.1] transition-colors">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Title & Description */}
              <div className="lg:col-span-4 space-y-1.5">
                <div className="flex items-center gap-2 text-white">
                  <Bell className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold tracking-tight">Notification Settings</h2>
                </div>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  Configure automated dispatch channels for upcoming delivery deadlines and overdue escalations.
                </p>
                <div className="pt-2">
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Toggles auto-save instantly
                  </span>
                </div>
              </div>

              {/* Right Column: Controls */}
              <div className="lg:col-span-8 space-y-3">
                
                {/* Email Reminders Toggle Card */}
                <div 
                  onClick={handleToggleEmail}
                  className="bg-[#05070B] border border-white/[0.06] hover:border-white/[0.12] rounded-lg p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-300 shrink-0">
                      <Mail className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white">Email Reminders</h3>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Receive 48h advance warnings and critical deadline alerts in your inbox.
                      </p>
                    </div>
                  </div>

                  {/* Tactile Linear Switch */}
                  <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
                    emailEnabled ? 'bg-emerald-500' : 'bg-white/[0.1]'
                  }`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                      emailEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </div>
                </div>

                {/* WhatsApp Reminders Toggle Card */}
                <div 
                  onClick={handleToggleWA}
                  className="bg-[#05070B] border border-white/[0.06] hover:border-white/[0.12] rounded-lg p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-300 shrink-0">
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white">WhatsApp Reminders</h3>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Direct ping from our bot to your verified WhatsApp number for priority milestones.
                      </p>
                    </div>
                  </div>

                  {/* Tactile Linear Switch */}
                  <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
                    waEnabled ? 'bg-emerald-500' : 'bg-white/[0.1]'
                  }`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                      waEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* ── 4. SECTION: App Preferences ── */}
          <div className="bg-[#0A0E17] border border-white/[0.07] rounded-xl p-6 shadow-2xl hover:border-white/[0.1] transition-colors">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Title & Description */}
              <div className="lg:col-span-4 space-y-1.5">
                <div className="flex items-center gap-2 text-white">
                  <Settings className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold tracking-tight">App Preferences</h2>
                </div>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  Manage application experience, guided product tours, and interface preferences.
                </p>
              </div>

              {/* Right Column: Controls */}
              <div className="lg:col-span-8">
                <div className="bg-[#05070B] border border-white/[0.06] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-300 shrink-0">
                      <Info className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white">Onboarding Tour</h3>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Replay the interactive welcome tour to explore the Campaign Command Center features.
                      </p>
                    </div>
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
                    className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 text-xs font-medium rounded-xl px-4 py-2 transition font-mono active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    Restart Tour
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
