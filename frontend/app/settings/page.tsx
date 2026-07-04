'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Settings, MessageSquare, Phone, AlertCircle, Save, 
  Bell, Mail, Copy, Check, Info, ShieldCheck, Send, QrCode, Smartphone, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { saveWhatsAppNumber, getWhatsAppNumber, getApiErrorMessage } from '@/lib/api';

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

  const handleUnlinkTG = async () => {
    setIsSavingTG(true);
    try {
      await saveWhatsAppNumber({
        whatsapp_number: whatsappNumber,
        telegram_username: "", 
        email_reminders_enabled: emailEnabled,
        whatsapp_reminders_enabled: waEnabled
      });
      setTelegramUsername('');
      toast.success('Telegram account unlinked successfully!');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to unlink Telegram account.'));
    } finally {
      setIsSavingTG(false);
    }
  };

  const handleUnlinkWA = async () => {
    setIsSavingWA(true);
    try {
      await saveWhatsAppNumber({
        whatsapp_number: "", 
        telegram_username: telegramUsername,
        email_reminders_enabled: emailEnabled,
        whatsapp_reminders_enabled: waEnabled
      });
      setWhatsappNumber('');
      toast.success('WhatsApp account unlinked successfully!');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to unlink WhatsApp account.'));
    } finally {
      setIsSavingWA(false);
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

  return (
    <DashboardLayout onNewCampaign={() => {}}>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Step 1: QR Code Card */}
                    <div className="bg-white dark:bg-slate-900/80 rounded-3xl p-6 border border-slate-200 dark:border-slate-800/80 flex flex-col items-center text-center gap-5 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
                      <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm border border-emerald-100 dark:border-emerald-500/20 shadow-sm shrink-0">1</div>
                      <div>
                        <p className="font-extrabold text-slate-900 dark:text-white mb-1.5 text-base">Scan to Chat</p>
                        <p className="text-xs text-slate-500 font-medium px-4">Scan this QR code with your phone to open our bot instantly.</p>
                      </div>
                      
                      <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-100 dark:border-slate-800 transition-transform duration-500 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/10 group-hover:rotate-1">
                        <img src="/whatsapp-qr.png" alt="WhatsApp QR Code" className="w-36 h-36 object-contain" />
                      </div>
                      
                      <a href={`https://wa.me/${botNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 mt-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 px-5 py-2.5 rounded-xl transition-colors">
                        <Smartphone className="w-3.5 h-3.5" /> Or click to open app
                      </a>
                    </div>

                    {/* Step 2 & 3 Container */}
                    <div className="flex flex-col gap-6">
                      
                      {/* Alt Step 1: Save Number */}
                      <div className="bg-slate-50/50 dark:bg-slate-900/40 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800/50 flex flex-col justify-center flex-1 shadow-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-100/50 dark:to-slate-800/20" />
                        <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-black text-[10px] tracking-wider uppercase shadow-inner">or</div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm">Save Number Manually</p>
                          </div>
                          
                          <div className="flex items-center gap-0 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-1">
                              <code className="text-sm font-mono font-bold text-slate-900 dark:text-emerald-400">{botNumber}</code>
                            </div>
                            <button onClick={handleCopy} className="px-5 py-3.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors flex items-center gap-2 group/btn active:bg-emerald-100 dark:active:bg-emerald-500/20">
                              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />}
                              <span className={`text-xs font-bold uppercase tracking-wider hidden sm:inline ${copied ? 'text-emerald-500' : ''}`}>{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Link Number */}
                      <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900/50 rounded-3xl p-5 border border-emerald-100 dark:border-emerald-800/40 flex flex-col justify-center flex-1 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-sm shadow-md shadow-emerald-500/40">2</div>
                          <p className="font-bold text-emerald-900 dark:text-emerald-400 text-sm">Link Your Number</p>
                        </div>
                        
                        <div className="relative group/input">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/60 group-focus-within/input:text-emerald-500 transition-colors" />
                          <input
                            type="tel"
                            value={whatsappNumber}
                            onChange={(e) => setWhatsappNumber(e.target.value)}
                            placeholder="e.g. 9876543210"
                            disabled={isLoading}
                            className="w-full bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-800/60 text-slate-900 dark:text-white placeholder-slate-400 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
                          />
                        </div>
                        <p className="text-[11px] text-emerald-600/80 dark:text-emerald-500/70 mt-2.5 font-medium flex items-center gap-1.5 ml-1">
                          <Info className="w-3 h-3" /> We auto-format Indian numbers (no +91 needed)
                        </p>
                      </div>

                    </div>
                  </div>

                  {botNumber.includes("+1") && (
                    <div className="p-5 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex items-start gap-3 shadow-inner mt-4">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-sm font-bold text-amber-900 dark:text-amber-400 block mb-1">Testing with Meta Sandbox?</strong>
                        <p className="text-xs text-amber-800/80 dark:text-amber-500/80 font-medium leading-relaxed">
                          Because this is a US Test Number, Meta restricts inbound messages unless you initiate a chat from the Meta Dashboard first. Upgrade to a production Indian number to remove this restriction.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="pt-6 border-t border-slate-200/60 dark:border-slate-800/60 flex justify-end gap-4">
                    {whatsappNumber && (
                      <button
                        onClick={handleUnlinkWA}
                        disabled={isSavingWA || isLoading}
                        className="inline-flex items-center gap-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 active:scale-95 font-bold rounded-2xl px-6 py-3.5 text-sm transition-all"
                      >
                        Unlink
                      </button>
                    )}
                    <button
                      onClick={handleSaveWA}
                      disabled={isSavingWA || isLoading}
                      className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white active:scale-95 font-bold rounded-2xl px-8 py-3.5 text-sm transition-all shadow-lg shadow-slate-900/20 dark:shadow-emerald-500/25 hover:shadow-xl disabled:opacity-70 disabled:pointer-events-none"
                    >
                      {isSavingWA ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>Save Connection <Sparkles className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Step 1 */}
                    <div className="bg-slate-50/50 dark:bg-slate-900/40 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800/50 flex flex-col justify-center h-full shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shadow-inner border border-blue-200 dark:border-blue-500/30">1</div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">Find our Bot</p>
                      </div>
                      <div className="px-5 py-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-center">
                        <code className="text-sm font-mono font-bold text-slate-900 dark:text-blue-400">{telegramBotUsername}</code>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl p-5 border border-blue-100 dark:border-blue-800/30 flex flex-col justify-center h-full shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-500/40">2</div>
                        <p className="font-bold text-blue-900 dark:text-blue-400 text-sm">Link Username</p>
                      </div>
                      <div className="relative group/input">
                        <Send className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500/60 group-focus-within/input:text-blue-500 transition-colors" />
                        <input
                          type="text"
                          value={telegramUsername}
                          onChange={(e) => setTelegramUsername(e.target.value)}
                          placeholder="e.g. @yourusername"
                          disabled={isLoading}
                          className="w-full bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-800/60 text-slate-900 dark:text-white placeholder-slate-400 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-200/60 dark:border-slate-800/60 flex justify-end gap-4">
                    {telegramUsername && (
                      <button
                        onClick={handleUnlinkTG}
                        disabled={isSavingTG || isLoading}
                        className="inline-flex items-center gap-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 active:scale-95 font-bold rounded-2xl px-6 py-3.5 text-sm transition-all"
                      >
                        Unlink
                      </button>
                    )}
                    <button
                      onClick={handleSaveTG}
                      disabled={isSavingTG || isLoading}
                      className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white active:scale-95 font-bold rounded-2xl px-8 py-3.5 text-sm transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl disabled:opacity-70"
                    >
                      {isSavingTG ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Save Telegram'
                      )}
                    </button>
                  </div>
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
    </DashboardLayout>
  );
}
