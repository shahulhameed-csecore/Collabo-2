'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Settings, MessageSquare, Phone, AlertCircle, Save, Bell, Mail, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { saveWhatsAppNumber, getWhatsAppNumber, getApiErrorMessage } from '@/lib/api';

export default function SettingsPage() {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [waEnabled, setWaEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const response = await saveWhatsAppNumber({
        whatsapp_number: whatsappNumber,
        email_reminders_enabled: emailEnabled,
        whatsapp_reminders_enabled: waEnabled
      });
      setWhatsappNumber(response.whatsapp_number || '');
      setEmailEnabled(response.email_reminders_enabled);
      setWaEnabled(response.whatsapp_reminders_enabled);
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save settings. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout onNewCampaign={() => {}}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <Settings className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your integrations and account preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* WhatsApp Integration Card */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/50 rounded-2xl overflow-hidden relative shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none" />
          
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">WhatsApp Bot Integration</h2>
                <p className="text-xs text-slate-400 mt-0.5">Forward chats to automatically create campaigns</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Instructions */}
              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/40 space-y-4">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-emerald-400" />
                  How to link your WhatsApp
                </h3>
                
                <div className="space-y-4 text-sm text-slate-300">
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white mt-0.5">1</span>
                    <p className="leading-snug">Save your personal WhatsApp phone number below. We automatically handle country codes like <span className="text-emerald-400 font-mono">+91</span>.</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white mt-0.5">2</span>
                    <div className="w-full">
                      <p className="mb-2 leading-snug">Save our Official Bot number to your contacts:</p>
                      <button 
                        onClick={handleCopy}
                        className="flex items-center gap-2.5 px-3 py-2 bg-slate-900 border border-slate-700 hover:border-emerald-500/50 rounded-lg text-emerald-400 font-mono font-bold text-sm transition-colors group w-full sm:w-auto"
                      >
                        {botNumber}
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white mt-0.5">3</span>
                    <p className="leading-snug">Forward any influencer chat, screenshot, or voice note to the Bot. Collabo AI will instantly create your campaign!</p>
                  </div>

                  {/* Test Number Warning */}
                  {botNumber.includes("+1") && (
                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-xs text-yellow-500 font-medium">
                        <strong className="block mb-1">⚠️ Using a Meta Test Number?</strong>
                        Meta blocks unverified international texts to US Test Numbers. To test it, you must initiate the chat from the Meta Dashboard first, or upgrade to a real Indian Production Number.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Your WhatsApp Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="e.g. 9876543210"
                    disabled={isLoading}
                    className="w-full bg-slate-950/50 border border-slate-700/60 text-white placeholder-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  <strong className="text-emerald-400">Indian Users:</strong> Enter your 10-digit number. We automatically handle the +91 country code.
                </p>
              </div>

              <button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl px-4 py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save WhatsApp Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Notifications & Reminders Card */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/50 rounded-2xl overflow-hidden relative shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-700/10 dark:bg-blue-500/8 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none" />
          
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <Bell className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Automated Reminders</h2>
                <p className="text-xs text-slate-400 mt-0.5">Stay on top of deadlines automatically</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/40">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" /> Email Reminders
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Get an email alert 48 hours before a campaign deadline, and an alert when it's overdue.</p>
                  </div>
                  <button
                    onClick={() => setEmailEnabled(!emailEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-inner ${
                      emailEnabled
                        ? 'bg-emerald-500 shadow-emerald-500/30'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                      emailEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/40">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-slate-400" /> WhatsApp Reminders
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Receive a WhatsApp message from our bot directly to your linked number for upcoming deadlines.</p>
                  </div>
                  <button
                    onClick={() => setWaEnabled(!waEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-inner ${
                      waEnabled
                        ? 'bg-emerald-500 shadow-emerald-500/30'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                      waEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
            
            <button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="w-full mt-6 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl px-4 py-2.5 text-sm transition-all border border-slate-700/50 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
