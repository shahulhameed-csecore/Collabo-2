'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Settings, MessageSquare, Phone, AlertCircle, Save, 
  Bell, Mail, Copy, Check, Info, ShieldCheck, Send
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

  const botNumber = process.env.NEXT_PUBLIC_BOT_NUMBER || "+1 (555) 656-5993";
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
      toast.success('WhatsApp integration updated!');
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
      toast.success('Telegram integration updated!');
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
        telegram_username: "", // Empty string to unset it
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
      toast.success('Reminder preferences updated!');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save settings. Please try again.'));
    } finally {
      setIsSavingReminders(false);
    }
  };

  return (
    <DashboardLayout onNewCampaign={() => {}}>
      <div className="max-w-5xl mx-auto pb-16 animate-fade-in">
        
        {/* Page Header */}
        <div className="mb-10 flex items-center gap-4 border-b border-slate-200 dark:border-slate-800/60 pb-8">
          <div className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50">
            <Settings className="w-6 h-6 text-slate-700 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
            <p className="text-slate-500 text-sm mt-1">Manage your integrations, notifications, and account preferences.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-12 animate-pulse">
            <section className="flex flex-col lg:flex-row gap-8 lg:gap-12">
              <div className="lg:w-1/3 space-y-3">
                <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                <div className="h-16 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
              </div>
              <div className="lg:w-2/3">
                <div className="h-64 w-full bg-slate-100 dark:bg-slate-800/50 rounded-3xl"></div>
              </div>
            </section>
            <section className="flex flex-col lg:flex-row gap-8 lg:gap-12">
              <div className="lg:w-1/3 space-y-3">
                <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                <div className="h-16 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
              </div>
              <div className="lg:w-2/3">
                <div className="h-48 w-full bg-slate-100 dark:bg-slate-800/50 rounded-3xl"></div>
              </div>
            </section>
          </div>
        ) : (
        <div className="space-y-12">
          
          {/* ─── SECTION: WhatsApp Integration ─── */}
          <section className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            <div className="lg:w-1/3 flex-shrink-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-500" /> WhatsApp AI Bot
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Connect your WhatsApp to forward negotiation chats, voice notes, and screenshots directly to Collabo. Our AI will instantly extract the data and track your campaign.
              </p>
            </div>
            
            <div className="lg:w-2/3">
              <div className="bg-white dark:bg-[#0A0F1C] border border-slate-200 dark:border-slate-800/60 rounded-3xl overflow-hidden shadow-sm relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none translate-x-1/4 -translate-y-1/4" />
                
                <div className="p-6 sm:p-8 relative z-10 space-y-8">
                  {/* Instructions */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-500" />
                      How to connect
                    </h3>
                    
                    <div className="space-y-0 relative">
                      {/* Timeline line */}
                      <div className="absolute left-3.5 top-8 bottom-8 w-0.5 bg-slate-100 dark:bg-slate-800/80 -z-10" />
                      
                      {/* Step 1 */}
                      <div className="flex gap-4 pb-8">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white dark:bg-slate-900 border-2 border-emerald-500 shadow-sm shadow-emerald-500/20 flex items-center justify-center text-xs font-black text-emerald-600 dark:text-emerald-400 z-10">1</div>
                        <div className="pt-1">
                          <p className="text-sm text-slate-900 dark:text-white font-bold leading-snug mb-1">Save the Bot Number</p>
                          <p className="text-xs text-slate-500 leading-relaxed mb-3">Add this official number to your phone's contacts as "Collabo Bot" or scan the QR code.</p>
                          
                          <div className="flex flex-col sm:flex-row gap-6 items-start">
                            <div className="inline-flex flex-col gap-3">
                              <div className="inline-flex items-center gap-0 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-r border-slate-200 dark:border-slate-800">
                                  <code className="text-sm font-mono font-bold text-slate-900 dark:text-emerald-400">{botNumber}</code>
                                </div>
                                <button 
                                  onClick={handleCopy}
                                  className="px-4 py-2.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors flex items-center gap-2 group"
                                >
                                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                                  <span className={`text-xs font-bold uppercase tracking-wider ${copied ? 'text-emerald-500' : ''}`}>{copied ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>
                              <a href={`https://wa.me/${botNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1">
                                Click here to open WhatsApp &rarr;
                              </a>
                            </div>

                            <div className="flex flex-col items-center p-3 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hidden sm:flex">
                              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Scan to Chat</p>
                              <img src="/whatsapp-qr.png" alt="WhatsApp QR Code" className="w-24 h-24 rounded-lg object-contain bg-white p-1" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-black text-slate-400 dark:text-slate-500 z-10">2</div>
                        <div className="pt-1 w-full">
                          <p className="text-sm text-slate-900 dark:text-white font-bold leading-snug mb-3">Enter your WhatsApp number</p>
                          <div className="space-y-2">
                            <div className="relative max-w-sm">
                              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 peer-focus:text-emerald-500 transition-colors" />
                              <input
                                type="tel"
                                value={whatsappNumber}
                                onChange={(e) => setWhatsappNumber(e.target.value)}
                                placeholder="e.g. 9876543210"
                                disabled={isLoading}
                                className="peer w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-inner disabled:opacity-50"
                              />
                            </div>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                              <Info className="w-3 h-3 text-emerald-500" />
                              Indian numbers don't need +91. We format it automatically.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {botNumber.includes("+1") && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <strong className="text-amber-800 dark:text-amber-500 block mb-1">Testing with Meta Sandbox?</strong>
                        <p className="text-amber-700 dark:text-amber-500/80 leading-relaxed">
                          Because this is a US Test Number, Meta restricts inbound messages unless you initiate a chat from the Meta Dashboard first. Upgrade to a production Indian number to remove this restriction.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 flex justify-end">
                    <button
                      onClick={handleSaveWA}
                      disabled={isSavingWA || isLoading}
                      className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 font-bold rounded-xl px-5 py-2.5 text-sm transition-all disabled:opacity-70 disabled:pointer-events-none"
                    >
                      {isSavingWA ? (
                        <div className="w-4 h-4 border-2 border-slate-400 dark:border-slate-400 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
                      ) : (
                        'Save WhatsApp Link'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-800/60" />

          {/* ─── SECTION: Telegram Integration ─── */}
          <section className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            <div className="lg:w-1/3 flex-shrink-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-500" /> Telegram AI Bot
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Prefer Telegram? Connect your account to forward messages, voice notes, and media directly to our Telegram Bot. Our AI will automatically track the campaign.
              </p>
            </div>
            
            <div className="lg:w-2/3">
              <div className="bg-white dark:bg-[#0A0F1C] border border-slate-200 dark:border-slate-800/60 rounded-3xl overflow-hidden shadow-sm relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none translate-x-1/4 -translate-y-1/4" />
                
                <div className="p-6 sm:p-8 relative z-10 space-y-8">
                  {/* Instructions */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-blue-500" />
                      How to connect
                    </h3>
                    
                    <div className="space-y-0 relative">
                      {/* Timeline line */}
                      <div className="absolute left-3.5 top-8 bottom-8 w-0.5 bg-slate-100 dark:bg-slate-800/80 -z-10" />
                      
                      {/* Step 1 */}
                      <div className="flex gap-4 pb-8">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-500 shadow-sm shadow-blue-500/20 flex items-center justify-center text-xs font-black text-blue-600 dark:text-blue-400 z-10">1</div>
                        <div className="pt-1">
                          <p className="text-sm text-slate-900 dark:text-white font-bold leading-snug mb-1">Start a chat with our Bot</p>
                          <p className="text-xs text-slate-500 leading-relaxed mb-3">Search for this bot on Telegram and tap Start.</p>
                          <div className="inline-flex items-center gap-0 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80">
                              <code className="text-sm font-mono font-bold text-slate-900 dark:text-blue-400">{telegramBotUsername}</code>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-black text-slate-400 dark:text-slate-500 z-10">2</div>
                        <div className="pt-1 w-full">
                          <p className="text-sm text-slate-900 dark:text-white font-bold leading-snug mb-3">Enter your Telegram username</p>
                          <div className="space-y-2">
                            <div className="relative max-w-sm">
                              <Send className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 peer-focus:text-blue-500 transition-colors" />
                              <input
                                type="text"
                                value={telegramUsername}
                                onChange={(e) => setTelegramUsername(e.target.value)}
                                placeholder="e.g. @yourusername"
                                disabled={isLoading}
                                className="peer w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner disabled:opacity-50"
                              />
                            </div>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                              <Info className="w-3 h-3 text-blue-500" />
                              We use this to verify messages are from you.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 flex justify-end gap-3">
                    {telegramUsername && (
                      <button
                        onClick={handleUnlinkTG}
                        disabled={isSavingTG || isLoading}
                        className="inline-flex items-center gap-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 active:scale-95 font-bold rounded-xl px-5 py-2.5 text-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
                      >
                        Unlink
                      </button>
                    )}
                    <button
                      onClick={handleSaveTG}
                      disabled={isSavingTG || isLoading}
                      className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 font-bold rounded-xl px-5 py-2.5 text-sm transition-all disabled:opacity-70 disabled:pointer-events-none"
                    >
                      {isSavingTG ? (
                        <div className="w-4 h-4 border-2 border-slate-400 dark:border-slate-400 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
                      ) : (
                        'Save Telegram Link'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-slate-200 dark:border-slate-800/60" />

          {/* ─── SECTION: Notifications ─── */}
          <section className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            <div className="lg:w-1/3 flex-shrink-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <Bell className="w-4 h-4 text-rose-500" /> Notifications
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Control how you want to be reminded about upcoming deadlines. We recommend keeping WhatsApp reminders on for the best experience.
              </p>
            </div>
            
            <div className="lg:w-2/3">
              <div className="bg-white dark:bg-[#0A0F1C] border border-slate-200 dark:border-slate-800/60 rounded-3xl overflow-hidden shadow-sm">
                
                <div className="p-6 sm:p-8 space-y-6">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
                        <Mail className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">Email Reminders</h3>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-sm font-medium">
                          Get an email 48 hours before a deadline, and an alert when a campaign becomes overdue.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setEmailEnabled(!emailEnabled)}
                      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500/50 dark:focus:ring-offset-slate-900 shadow-inner ${
                        emailEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                        emailEnabled ? 'translate-x-[26px] shadow-emerald-500/50' : 'translate-x-[2px]'
                      }`} />
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
                        <MessageSquare className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">WhatsApp Reminders</h3>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-sm font-medium">
                          Receive instant pings from our bot to your linked number for critical deadlines.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setWaEnabled(!waEnabled)}
                      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500/50 dark:focus:ring-offset-slate-900 shadow-inner ${
                        waEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                        waEnabled ? 'translate-x-[26px] shadow-emerald-500/50' : 'translate-x-[2px]'
                      }`} />
                    </button>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 flex justify-end">
                    <button
                      onClick={handleSaveReminders}
                      disabled={isSavingReminders || isLoading}
                      className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 font-bold rounded-xl px-5 py-2.5 text-sm transition-all disabled:opacity-70 disabled:pointer-events-none"
                    >
                      {isSavingReminders ? (
                        <div className="w-4 h-4 border-2 border-slate-400 dark:border-slate-400 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
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

          {/* ─── SECTION: App Preferences ─── */}
          <section className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            <div className="lg:w-1/3 flex-shrink-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-500" /> App Preferences
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Manage your general application settings and preferences.
              </p>
            </div>
            
            <div className="lg:w-2/3">
              <div className="bg-white dark:bg-[#0A0F1C] border border-slate-200 dark:border-slate-800/60 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 sm:p-8 space-y-6">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-shadow gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
                        <Info className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">Onboarding Tour</h3>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-sm font-medium">
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
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-50 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white h-10 px-4 py-2"
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
