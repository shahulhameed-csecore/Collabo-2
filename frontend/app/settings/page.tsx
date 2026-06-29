'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Settings, MessageSquare, Phone, AlertCircle, Save, 
  Bell, Mail, Copy, Check, Info, ShieldCheck 
} from 'lucide-react';
import { toast } from 'sonner';
import { saveWhatsAppNumber, getWhatsAppNumber, getApiErrorMessage } from '@/lib/api';

export default function SettingsPage() {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [waEnabled, setWaEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingWA, setIsSavingWA] = useState(false);
  const [isSavingReminders, setIsSavingReminders] = useState(false);
  const [copied, setCopied] = useState(false);

  const botNumber = process.env.NEXT_PUBLIC_BOT_NUMBER || "+1 (555) 656-5993";

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

  const handleSaveReminders = async () => {
    setIsSavingReminders(true);
    try {
      const response = await saveWhatsAppNumber({
        whatsapp_number: whatsappNumber,
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

        <div className="space-y-12">
          
          {/* ─── SECTION: WhatsApp Integration ─── */}
          <section className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            <div className="lg:w-1/3 flex-shrink-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">WhatsApp AI Bot</h2>
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
                    
                    <div className="space-y-5">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300">1</div>
                        <div className="pt-1">
                          <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-snug mb-1">Save the Bot Number</p>
                          <p className="text-xs text-slate-500 leading-relaxed mb-3">Add this official number to your phone's contacts as "Collabo Bot".</p>
                          <div className="inline-flex items-center gap-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-800">
                              <code className="text-sm font-mono font-bold text-slate-900 dark:text-emerald-400">{botNumber}</code>
                            </div>
                            <button 
                              onClick={handleCopy}
                              className="px-4 py-2.5 text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors flex items-center gap-2"
                            >
                              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              <span className="text-xs font-bold uppercase tracking-wider">{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300">2</div>
                        <div className="pt-1 w-full">
                          <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-snug mb-3">Enter your personal WhatsApp number</p>
                          <div className="space-y-2">
                            <div className="relative max-w-sm">
                              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="tel"
                                value={whatsappNumber}
                                onChange={(e) => setWhatsappNumber(e.target.value)}
                                placeholder="e.g. 9876543210"
                                disabled={isLoading}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner disabled:opacity-50"
                              />
                            </div>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1">
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

          {/* ─── SECTION: Notifications ─── */}
          <section className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            <div className="lg:w-1/3 flex-shrink-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">Notifications</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Control how you want to be reminded about upcoming deadlines. We recommend keeping WhatsApp reminders on for the best experience.
              </p>
            </div>
            
            <div className="lg:w-2/3">
              <div className="bg-white dark:bg-[#0A0F1C] border border-slate-200 dark:border-slate-800/60 rounded-3xl overflow-hidden shadow-sm">
                
                <div className="p-6 sm:p-8 space-y-6">
                  
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/50">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                        <Mail className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Email Reminders</h3>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                          Get an email 48 hours before a deadline, and an alert when a campaign becomes overdue.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setEmailEnabled(!emailEnabled)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500/50 dark:focus:ring-offset-slate-900 ${
                        emailEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
                        emailEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/50">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                        <MessageSquare className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">WhatsApp Reminders</h3>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                          Receive instant pings from our bot to your linked number for critical deadlines.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setWaEnabled(!waEnabled)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500/50 dark:focus:ring-offset-slate-900 ${
                        waEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
                        waEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
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

        </div>
      </div>
    </DashboardLayout>
  );
}
