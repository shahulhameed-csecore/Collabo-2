'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, MessageSquare, Phone, AlertCircle, 
  Bell, Mail, Copy, Check, Info, ShieldCheck, Send, Smartphone, Sparkles, CreditCard, ArrowRight
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { saveWhatsAppNumber, getWhatsAppNumber, verifyWhatsAppConnection, getApiErrorMessage, getBillingUsage, BillingUsage, createRazorpayOrder, verifyRazorpayPayment, generateWhatsAppCode, unlinkWhatsApp, generateTelegramCode, unlinkTelegram } from '@/lib/api';
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
  // Updated fallback Bot Number as requested
  const botNumber = process.env.NEXT_PUBLIC_BOT_NUMBER || "+91 6374771074";
  const telegramBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "@collabo_bot";

  const handleCopy = () => {
    navigator.clipboard.writeText(botNumber);
    setCopied(true);
    toast.success('Bot number copied to clipboard!');
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

  const handleSaveWA = async () => {
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
      toast.success('WhatsApp integration updated successfully!');
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
      toast.success('Telegram integration updated successfully!');
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
      toast.success('Telegram account unlinked successfully!');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to unlink Telegram account.'));
    } finally {
      setIsSavingTG(false);
    }
  };

  const handleGenerateCode = async () => {
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
      toast.success('WhatsApp account unlinked successfully!');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to unlink WhatsApp account.'));
    } finally {
      setIsSavingWA(false);
    }
  };

  const handleVerifyWA = async () => {
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
      toast.success('Reminder preferences updated successfully!');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save settings. Please try again.'));
    } finally {
      setIsSavingReminders(false);
    }
  };

  const isPro = IS_TESTING_PHASE || usage?.current_plan === 'pro';

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
            // Refresh usage
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
    <>
      <div className="max-w-6xl mx-auto pb-16 animate-fade-in px-2 sm:px-4">
        
        {/* Premium Page Header */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800/60 pb-8 mt-2">
          <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 flex items-center justify-center shadow-inner shrink-0">
            <Settings className="w-7 h-7 text-slate-700 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-1">Settings</h1>
            <p className="text-slate-500 font-medium">Manage integrations, notifications, and application preferences.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-12 animate-pulse">
            <div className="h-64 w-full bg-slate-100 dark:bg-slate-800/50 rounded-3xl"></div>
            <div className="h-48 w-full bg-slate-100 dark:bg-slate-800/50 rounded-3xl"></div>
          </div>
        ) : (
        <div className="space-y-16">
          
          {/* ─── SECTION: Subscription ─── */}
          <section className="flex flex-col xl:flex-row gap-8 xl:gap-12 relative">
            <div className="xl:w-1/3 flex-shrink-0 space-y-4">
              <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-purple-400/10 to-purple-500/10 border border-purple-500/20 text-purple-500 shadow-inner">
                <CreditCard className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Subscription Plan</h2>
                <p className="text-sm text-slate-500 leading-relaxed max-w-sm font-medium">
                  Manage your subscription tier and upgrade to unlock unlimited campaigns and premium features.
                </p>
              </div>
            </div>
            
            <div className="xl:w-2/3">
              <div className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="p-6 sm:p-10 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm gap-5">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5 flex items-center gap-2">
                        Current Plan: {isPro ? <span className="text-emerald-500">Collabo Pro</span> : <span className="text-slate-500">Starter (Free)</span>}
                      </h3>
                      {!isPro && (
                        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
                          You are currently on the free tier. Upgrade to unlock unlimited campaigns and priority extractions.
                        </p>
                      )}
                    </div>
                    {!isPro && (
                      <button
                        onClick={handleUpgrade}
                        className="inline-flex items-center justify-center gap-2 shrink-0 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 active:scale-95 text-white font-bold rounded-2xl px-6 py-3 text-sm transition-all"
                      >
                        Upgrade to Pro <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-800/60" />

          {/* ─── SECTION: WhatsApp Integration ─── */}

          <section className="flex flex-col xl:flex-row gap-8 xl:gap-12 relative">
            <div className="xl:w-1/3 flex-shrink-0 space-y-4">
              <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-emerald-400/10 to-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-inner">
                <MessageSquare className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">WhatsApp AI Bot</h2>
                <p className="text-sm text-slate-500 leading-relaxed max-w-sm font-medium">
                  Connect your WhatsApp to forward negotiation chats, voice notes, and screenshots directly to Collabo. Our AI instantly extracts the data.
                </p>
              </div>
            </div>
            
            <div className="xl:w-2/3">
              <div className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/40 dark:shadow-black/40 relative group transition-all">
                {/* Glow effect */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none translate-x-1/3 -translate-y-1/3 group-hover:bg-emerald-500/15 transition-colors duration-500" />
                
                <div className="p-6 sm:p-10 relative z-10 space-y-8">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    Connection Setup
                  </h3>

                  {whatsappNumber ? (
                    <div className="mt-8 p-5 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-inner bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            Connection Status
                            <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                              Connected
                            </span>
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                            {whatsappNumber.substring(0, whatsappNumber.length - 4) + '****'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="w-full md:w-auto flex gap-3">
                        <button
                          onClick={handleUnlinkWA}
                          disabled={isSavingWA || isLoading}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-100 hover:bg-rose-200 text-rose-600 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 active:scale-95 font-bold rounded-2xl px-6 py-3 text-sm transition-all"
                        >
                          Unlink Number
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-slate-600 dark:text-slate-400 font-medium">
                        Connect your WhatsApp to forward briefs, voice notes, and screenshots to Collabo AI.
                        Click below to generate a secure 10-minute pairing code.
                      </p>

                      {!pairingCode ? (
                        <button
                          onClick={handleGenerateCode}
                          disabled={isSavingWA || isLoading}
                          className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                        >
                          {isSavingWA ? 'Generating...' : 'Generate Pairing Code'}
                        </button>
                      ) : (
                        <div className="space-y-6">
                          <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 text-center sm:text-left shadow-sm">
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Your Pairing Code:</p>
                            <p className="text-4xl font-mono font-black tracking-widest text-slate-900 dark:text-white">
                              {pairingCode}
                            </p>
                            <p className="text-sm text-slate-500 font-medium mt-3">
                              This code expires in 10 minutes. Send it to our bot to verify your number.
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <a 
                              href={`https://wa.me/${botNumber.replace(/[^0-9]/g, '')}?text=${pairingCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full sm:w-auto px-8 py-4 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#25D366]/30 hover:-translate-y-0.5"
                            >
                              <Smartphone className="w-5 h-5" />
                              Open in WhatsApp
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-800/60" />

          {/* ─── SECTION: Notifications ─── */}
          <section className="flex flex-col xl:flex-row gap-8 xl:gap-12 relative">
            <div className="xl:w-1/3 flex-shrink-0 space-y-4">
              <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-rose-400/10 to-rose-500/10 border border-rose-500/20 text-rose-500 shadow-inner">
                <Bell className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Notification Settings</h2>
                <p className="text-sm text-slate-500 leading-relaxed max-w-sm font-medium">
                  Control how you want to be reminded about upcoming deadlines. We recommend keeping WhatsApp reminders on for the best experience.
                </p>
              </div>
            </div>
            
            <div className="xl:w-2/3">
              <div className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/40 dark:shadow-black/40 group">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-3xl pointer-events-none translate-x-1/2 -translate-y-1/2 group-hover:bg-rose-500/10 transition-colors duration-500" />
                
                <div className="p-6 sm:p-10 relative z-10 space-y-5">
                  
                  {/* Email Toggle */}
                  <div 
                    onClick={() => setEmailEnabled(!emailEnabled)}
                    className={`cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 rounded-3xl border transition-all duration-300 gap-5 ${
                      emailEnabled 
                        ? 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/50 shadow-lg shadow-rose-100/50 dark:shadow-none ring-1 ring-rose-500/10' 
                        : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-4 sm:gap-5">
                      <div className={`p-3.5 rounded-2xl border transition-colors shrink-0 shadow-inner ${
                        emailEnabled ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-500' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                      }`}>
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`text-base font-bold mb-1.5 ${emailEnabled ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>Email Reminders</h3>
                        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm font-medium">
                          Get an email 48 hours before a deadline, and an alert when a campaign becomes overdue.
                        </p>
                      </div>
                    </div>
                    {/* iOS style Toggle */}
                    <div
                      className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out shadow-inner border border-black/5 dark:border-white/5 ${
                        emailEnabled ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-300 ease-in-out ${
                        emailEnabled ? 'translate-x-[26px]' : 'translate-x-1'
                      }`} />
                    </div>
                  </div>

                  {/* WA Toggle */}
                  <div 
                    onClick={() => setWaEnabled(!waEnabled)}
                    className={`cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 rounded-3xl border transition-all duration-300 gap-5 ${
                      waEnabled 
                        ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/50 shadow-lg shadow-emerald-100/50 dark:shadow-none ring-1 ring-emerald-500/10' 
                        : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-4 sm:gap-5">
                      <div className={`p-3.5 rounded-2xl border transition-colors shrink-0 shadow-inner ${
                        waEnabled ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                      }`}>
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`text-base font-bold mb-1.5 ${waEnabled ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>WhatsApp Reminders</h3>
                        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm font-medium">
                          Receive instant pings from our bot to your linked number for critical deadlines.
                        </p>
                      </div>
                    </div>
                    {/* iOS style Toggle */}
                    <div
                      className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out shadow-inner border border-black/5 dark:border-white/5 ${
                        waEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-300 ease-in-out ${
                        waEnabled ? 'translate-x-[26px]' : 'translate-x-1'
                      }`} />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-200/60 dark:border-slate-800/60 flex justify-end mt-4">
                    <button
                      onClick={handleSaveReminders}
                      disabled={isSavingReminders || isLoading}
                      className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white active:scale-95 font-bold rounded-2xl px-8 py-3.5 text-sm transition-all shadow-lg shadow-slate-900/20 dark:shadow-white/10 hover:shadow-xl disabled:opacity-70 disabled:pointer-events-none"
                    >
                      {isSavingReminders ? (
                        <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'Save Preferences'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-800/60" />

          {/* ─── SECTION: Telegram Integration ─── */}
          <section className="flex flex-col xl:flex-row gap-8 xl:gap-12 relative opacity-80 hover:opacity-100 transition-opacity">
            <div className="xl:w-1/3 flex-shrink-0 space-y-4">
              <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-blue-400/10 to-blue-500/10 border border-blue-500/20 text-blue-500 shadow-inner">
                <Send className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Telegram AI Bot</h2>
                <p className="text-sm text-slate-500 leading-relaxed max-w-sm font-medium">
                  Prefer Telegram? Connect your account to forward messages directly to our Telegram Bot as a fallback.
                </p>
              </div>
            </div>
            
            <div className="xl:w-2/3">
              <div className="bg-white/50 dark:bg-slate-950/50 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-[2rem] overflow-hidden shadow-sm relative group">
                <div className="p-6 sm:p-10 relative z-10 space-y-8">
                  {telegramUsername ? (
                    <div className="p-5 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-inner bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            Connection Status
                            <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                              Connected
                            </span>
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                            {telegramUsername}
                          </p>
                        </div>
                      </div>
                      
                      <div className="w-full md:w-auto flex gap-3">
                        <button
                          onClick={handleUnlinkTG}
                          disabled={isSavingTG || isLoading}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-100 hover:bg-rose-200 text-rose-600 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 active:scale-95 font-bold rounded-2xl px-6 py-3 text-sm transition-all"
                        >
                          Unlink Telegram
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-slate-600 dark:text-slate-400 font-medium">
                        Connect your Telegram to forward briefs, voice notes, and screenshots to Collabo AI.
                        Click below to generate a secure 10-minute pairing code.
                      </p>

                      {!tgPairingCode ? (
                        <button
                          onClick={handleGenerateTGCode}
                          disabled={isSavingTG || isLoading}
                          className="px-6 py-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
                        >
                          {isSavingTG ? 'Generating...' : 'Generate Telegram Link'}
                        </button>
                      ) : (
                        <div className="space-y-6">
                          <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 text-center sm:text-left shadow-sm">
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Your Pairing Link:</p>
                            <p className="text-3xl font-mono font-black tracking-wider text-slate-900 dark:text-white break-all">
                              {tgPairingCode}
                            </p>
                            <p className="text-sm text-slate-500 font-medium mt-3">
                              This code expires in 10 minutes. Click the button below to verify your account in Telegram.
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <a 
                              href={`https://t.me/${telegramBotUsername.replace('@', '')}?start=${tgPairingCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full sm:w-auto px-8 py-4 bg-[#0088cc] hover:bg-[#007ab8] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#0088cc]/30 hover:-translate-y-0.5"
                            >
                              <Send className="w-5 h-5" />
                              Open in Telegram
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-800/60" />

          {/* ─── SECTION: App Preferences ─── */}
          <section className="flex flex-col xl:flex-row gap-8 xl:gap-12 relative pb-12">
            <div className="xl:w-1/3 flex-shrink-0 space-y-4">
              <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 border border-slate-300 dark:border-slate-700 shadow-inner">
                <Settings className="w-7 h-7 text-slate-700 dark:text-slate-300" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">App Preferences</h2>
                <p className="text-sm text-slate-500 leading-relaxed max-w-sm font-medium">
                  Manage your general application settings and experiences.
                </p>
              </div>
            </div>
            
            <div className="xl:w-2/3">
              <div className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="p-6 sm:p-10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm gap-5">
                    <div className="flex items-start gap-5">
                      <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-inner shrink-0">
                        <Info className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">Onboarding Tour</h3>
                        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm font-medium">
                          Replay the interactive welcome tour to learn about the dashboard features.
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
                      className="inline-flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-bold rounded-2xl px-6 py-3 text-sm transition-all"
                    >
                      Restart Tour
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
        )}
      </div>
    </>
  );
}
