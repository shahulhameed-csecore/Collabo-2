'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { 
  Mail, 
  ArrowRight, 
  Loader2, 
  ArrowLeft, 
  ShieldCheck, 
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Left Showcase Panel (Clean Linear Typography & Negative Space) ──────────

function LeftPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between h-full p-12 xl:p-16 bg-[#05070B] border-r border-white/[0.06] relative overflow-hidden select-none">
      
      {/* ── Atmospheric Radial Emerald Spotlight & Dot Matrix Mask ── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_30%_20%,rgba(16,185,129,0.08),transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-dot-grid opacity-25 pointer-events-none" />

      {/* Exposed Architectural Crosshair Markers at Section Borders */}
      <div className="absolute -right-[7px] top-12 text-emerald-500/40 text-xs font-mono pointer-events-none">+</div>
      <div className="absolute -right-[7px] bottom-12 text-emerald-500/40 text-xs font-mono pointer-events-none">+</div>

      {/* ── 1. Top Bar: Logo + Subtle Home Link ── */}
      <div className="flex items-center justify-between relative z-10 shrink-0 pt-2">
        <Logo variant="full" size={26} href="/" theme="dark" />
        <Link 
          href="/" 
          className="text-xs font-sans text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-white/[0.04]"
        >
          <span>← Back to Home</span>
        </Link>
      </div>

      {/* ── 2. Center: Editorial Typography & Generous Negative Space ── */}
      <div className="relative z-10 my-auto py-12 max-w-lg">
        {/* Subtle status pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6 shadow-sm font-sans">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Zero-Entry Influencer CRM</span>
        </div>

        {/* Crisp 2-line metallic headline */}
        <h1 className="text-4xl xl:text-5xl font-semibold tracking-[-0.03em] leading-[1.15] bg-gradient-to-b from-white via-white/95 to-slate-400 bg-clip-text text-transparent mb-5 font-sans">
          <span className="block">From WhatsApp Chaos</span>
          <span className="block">to Campaign Clarity.</span>
        </h1>

        {/* Clean, calm 2-line description */}
        <p className="text-base text-slate-400 max-w-md leading-relaxed font-normal font-sans">
          Forward creator voice notes, DMs, or briefs to our WhatsApp bot. Collabo structures your entire campaign pipeline automatically.
        </p>
      </div>

      {/* ── 3. Bottom: Quiet single-line muted footer ── */}
      <div className="border-t border-white/[0.06] pt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 font-sans relative z-10 shrink-0">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
          0.8s AI Extraction
        </span>
        <span className="text-white/20">•</span>
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
          Automated 48h WhatsApp Chasers
        </span>
        <span className="text-white/20">•</span>
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
          Zero Creator App Installs
        </span>
      </div>

    </div>
  );
}

// ─── Main Unified Auth Terminal (Step 1: Email/Google, Step 2: 6-Digit OTP) ───

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const router = useRouter();
  const supabase = createClient();
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setInterval(() => setResendTimer(p => p - 1), 1000);
      return () => clearInterval(t);
    }
  }, [resendTimer]);

  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !email.includes('@')) { 
      toast.error('Please enter a valid email address.'); 
      return; 
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ 
      email: email.trim(), 
      options: { shouldCreateUser: true } 
    });
    setLoading(false);
    if (error) { 
      toast.error(error.message || 'Failed to send code.'); 
    } else { 
      toast.success('Code sent to your email.'); 
      setStep('otp'); 
      setResendTimer(60); 
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100); 
    }
  };

  const handleVerifyCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const token = otp.join('');
    if (token.length !== 6) { 
      toast.error('Please enter the 6-digit code.'); 
      return; 
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ 
      email: email.trim(), 
      token, 
      type: 'email' 
    });
    setLoading(false);
    if (error) { 
      toast.error(error.message || 'Invalid code. Please try again.'); 
    } else { 
      toast.success('Welcome to Collabo!'); 
      router.push('/dashboard'); 
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: 'google', 
      options: { redirectTo: `${window.location.origin}/auth/callback` } 
    });
    if (error) { 
      toast.error(error.message || 'Google login failed.'); 
      setLoading(false); 
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const n = [...otp]; 
    n[index] = value; 
    setOtp(n);
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      handleVerifyCode();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const d = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '');
    if (d) { 
      const n = [...otp]; 
      for (let i = 0; i < d.length; i++) n[i] = d[i]; 
      setOtp(n); 
      otpInputRefs.current[Math.min(d.length, 5)]?.focus(); 
    }
  };

  return (
    <div className="min-h-screen bg-[#05070B] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300 grid lg:grid-cols-[52%_48%] overflow-hidden relative">
      
      {/* ── Left Showcase Panel ─────────────────────────────────── */}
      <LeftPanel />

      {/* ── Right Auth Terminal ──────────────────────────────────── */}
      <div className="min-h-screen lg:h-screen flex flex-col items-center justify-center p-6 sm:p-10 bg-[#05070B] overflow-y-auto lg:overflow-hidden relative">
        
        {/* Subtle Radial Glow in Center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/[0.04] blur-[120px] pointer-events-none rounded-full" />

        {/* Mobile Header (Logo + Back Link) */}
        <div className="lg:hidden w-full max-w-[420px] flex items-center justify-between mb-6">
          <Logo variant="full" size={24} href="/" theme="dark" />
          <Link href="/" className="text-xs font-sans text-slate-400 hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>

        <div className="w-full max-w-[420px] relative z-10">

          {/* Floating Eyebrow Badge */}
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 text-xs font-sans font-medium shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>14-Day Full Pro Trial • No Credit Card Required</span>
            </div>
          </div>

          {/* Architectural Auth Card Container */}
          <div className="bg-[#0A0E17]/80 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_25px_50px_-12px_rgba(0,0,0,0.7)] rounded-2xl p-7 sm:p-9 relative">
            
            <AnimatePresence mode="wait">

              {/* ── Step 1: Email & Google OAuth ──────────────────── */}
              {step === 'email' && (
                <motion.div
                  key="email-step"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <h2 className="text-2xl font-semibold tracking-tight text-gradient-metallic mb-1 font-sans">
                    Welcome to Collabo
                  </h2>
                  <p className="text-slate-400 text-sm mb-6 font-normal font-sans">
                    Sign in or create your workspace in seconds.
                  </p>

                  <form onSubmit={handleSendCode} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2 font-sans">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="you@brand.com"
                          className="w-full bg-[#05070B] border border-white/[0.08] focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 transition-all outline-none font-sans"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !email.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#059669] text-[#05070B] font-semibold rounded-xl py-3 px-4 shadow-lg shadow-emerald-500/10 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-sans"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending code...</span>
                        </>
                      ) : (
                        <>
                          <span>Continue with Email</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Divider */}
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/[0.06]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 bg-[#0A0E17] text-[11px] font-mono tracking-widest text-slate-500">
                        OR
                      </span>
                    </div>
                  </div>

                  {/* Google OAuth Button */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/[0.15] text-slate-200 font-medium rounded-xl py-3 px-4 transition-all active:scale-[0.98] disabled:opacity-60 text-sm font-sans"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </motion.div>
              )}

              {/* ── Step 2: 6-Digit OTP Verification View ─────────── */}
              {step === 'otp' && (
                <motion.div
                  key="otp-step"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <button 
                    onClick={() => setStep('email')} 
                    className="text-xs font-sans text-slate-400 hover:text-white transition-colors mb-4 flex items-center gap-1.5 group"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> 
                    <span>Back to Email</span>
                  </button>

                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                    <ShieldCheck className="w-5 h-5" />
                  </div>

                  <h2 className="text-2xl font-semibold tracking-tight text-white mb-1.5 font-sans">
                    Check your inbox
                  </h2>

                  {/* Clean un-wrapped email badge row */}
                  <p className="text-sm text-slate-400 font-sans">
                    We sent a 6-digit verification code to
                  </p>
                  <div className="mt-1.5 mb-6 flex items-center gap-2.5">
                    <span className="font-mono text-xs text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20 px-2.5 py-1 rounded-md whitespace-nowrap">
                      {email}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep('email')}
                      className="text-xs text-slate-400 hover:text-white underline underline-offset-4 transition"
                    >
                      Change
                    </button>
                  </div>

                  <div className="space-y-5">
                    {/* 6 Individual Tactile OTP Slots */}
                    <div className="grid grid-cols-6 gap-2 sm:gap-2.5 my-4" onPaste={handlePaste}>
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={el => { otpInputRefs.current[index] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={e => handleOtpChange(index, e.target.value)}
                          onKeyDown={e => handleOtpKeyDown(index, e)}
                          className={cn(
                            "font-mono text-xl font-semibold text-white text-center h-12 sm:h-14 rounded-xl bg-[#05070B] border outline-none transition-all focus:border-emerald-400 focus:bg-emerald-500/[0.04] focus:ring-2 focus:ring-emerald-500/20",
                            digit ? "border-emerald-500/40 bg-emerald-500/[0.02]" : "border-white/[0.10]"
                          )}
                        />
                      ))}
                    </div>

                    {/* Verify CTA: Bright emerald when 6 digits, clean muted surface when disabled */}
                    <button
                      type="button"
                      onClick={() => handleVerifyCode()}
                      disabled={loading || otp.join('').length !== 6}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 transition-all text-sm font-sans font-semibold",
                        otp.join('').length === 6 && !loading
                          ? "bg-[#10B981] hover:bg-[#059669] text-[#05070B] shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
                          : "bg-white/[0.06] text-slate-400 cursor-not-allowed"
                      )}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying & Launching...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify & Launch Workspace</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* Resend Countdown Row */}
                    <div className="text-center pt-2">
                      {resendTimer > 0 ? (
                        <p className="font-mono tabular-nums text-xs text-slate-400">
                          Resend code in 00:{resendTimer < 10 ? `0${resendTimer}` : resendTimer}s
                        </p>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => handleSendCode()} 
                          disabled={loading} 
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors disabled:opacity-60 font-sans"
                        >
                          {loading ? 'Sending...' : 'Resend OTP'}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

          </div>

          {/* Micro Trust Badges */}
          <div className="flex items-center justify-center gap-4 mt-6 text-xs text-slate-400 font-sans">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>256-Bit SSL Encrypted</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero Setup Time</span>
            </div>
          </div>

          {/* Legal Terms Link */}
          <p className="text-center text-[11px] text-slate-500 mt-3 font-sans">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-slate-400 hover:text-white underline transition-colors">
              Terms of Service
            </Link>
            {' & '}
            <Link href="/privacy" className="text-slate-400 hover:text-white underline transition-colors">
              Privacy Policy
            </Link>.
          </p>

        </div>
      </div>

    </div>
  );
}
