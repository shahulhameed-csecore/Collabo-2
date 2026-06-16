'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase';
import { Settings, MessageSquare, Phone, AlertCircle, Save, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadSettings() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data, error } = await supabase
        .from('user_settings')
        .select('whatsapp_number')
        .eq('user_id', user.id)
        .single();

      if (data && data.whatsapp_number) {
        setWhatsappNumber(data.whatsapp_number);
      }
      setIsLoading(false);
    }
    loadSettings();
  }, [supabase]);

  const handleSave = async () => {
    if (!userId) return;
    
    let cleanNumber = whatsappNumber.replace(/\D/g, ''); // strip non-digits
    if (cleanNumber && !cleanNumber.startsWith('91') && cleanNumber.length === 10) {
      cleanNumber = '91' + cleanNumber; // default to India code
    }

    setIsSaving(true);
    
    // Upsert the setting
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, whatsapp_number: cleanNumber })
      .select();

    if (error) {
      console.error(error);
      toast.error('Failed to save settings. Please try again.');
    } else {
      setWhatsappNumber(cleanNumber);
      toast.success('WhatsApp number linked successfully!');
    }
    setIsSaving(false);
  };

  return (
    <DashboardLayout onNewCampaign={() => {}}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
          <Settings className="w-5 h-5 text-slate-300" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your integrations and account preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp Integration Card */}
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl overflow-hidden relative">
          {/* Subtle glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none" />
          
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
              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/40 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  How it works
                </h3>
                <ol className="list-decimal list-inside text-sm text-slate-400 space-y-2">
                  <li>Save your WhatsApp number below to link your account.</li>
                  <li>Save our Bot number to your contacts.</li>
                  <li>Forward any influencer negotiation chat or voice note to the bot.</li>
                  <li>Our AI will instantly extract the details, create a Draft campaign, and reply with a confirmation!</li>
                </ol>
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
                    placeholder="e.g. 919876543210 (include country code)"
                    disabled={isLoading}
                    className="w-full bg-slate-950/50 border border-slate-700/60 text-white placeholder-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Include your country code (e.g. 91 for India). No + sign.</p>
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
      </div>
    </DashboardLayout>
  );
}
