'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Mail, ArrowRight, Loader2, ArrowLeft, CheckCircle2, Shield, Zap, Clock, Bot, Link as LinkIcon, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ─── Left Panel: The Value Proposition ────────────────────────────────────────

const DEMO_STEPS = [
  { icon: '📸', text: 'WhatsApp screenshot uploaded' },
  { icon: '🤖', text: 'AI extracted creator details' },
  { icon: '📅', text: 'Campaign & deadline created' },
  { icon: '💬', text: 'WhatsApp reminder scheduled' },
  { icon: '✅', text: 'Creator proof submitted' },
  { icon: '🚀', text: 'Campaign completed' },
];

const BENEFITS = [
  { icon: Clock,   text: 'Save 5+ hours every week' },
  { icon: CheckCircle2, text: 'Never miss campaign deadlines' },
  { icon: Bot,     text: 'AI-powered campaign extraction' },
  { icon: Smartphone, text: 'Automated WhatsApp reminders' },
  { icon: LinkIcon, text: 'Creator-friendly Magic Links' },
  { icon: Zap,     text: 'Manage everything in one place' },
];

function LeftPanel() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveStep(s => (s + 1) % DEMO_STEPS.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-[#071126] border-r border-[#1E293B]">

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.08] pointer-events-none" />

      {/* Top: Logo + Headline */}
      <div className="relative z-10">
        <Logo variant="full" size={28} href="/" />

        <div className="mt-14">
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight mb-5">
            From WhatsApp Chaos<br />
            to <span className="text-[#00D4A5]">Campaign Clarity.</span>
          </h1>
          <p className="text-[#94A3B8] text-lg leading-relaxed max-w-md">
            Stop managing creators across WhatsApp and spreadsheets. Let Collabo organize everything for you.
          </p>
        </div>
      </div>

      {/* Middle: Animated Live Demo Card */}
      <div className="relative z-10 my-8">
        <div className="bg-[#081428] border border-[#1E293B] rounded-xl p-5 shadow-2xl max-w-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-[#00D4A5] animate-pulse" />
            <span className="text-xs font-mono font-bold text-[#00D4A5] uppercase tracking-wider">Live Demo</span>
          </div>

          <div className="space-y-2">
            {DEMO_STEPS.map((step, i) => (
              <motion.div
                key={i}
                animate={{
                  opacity: i <= activeStep ? 1 : 0.25,
                  x: i === activeStep ? 4 : 0,
                }}
                transition={{ duration: 0.4 }}
                className={cn(
                  "flex items-center gap-3 py-2 px-3 rounded-lg text-sm transition-colors",
                  i === activeStep ? "bg-[#00D4A5]/10 border border-[#00D4A5]/20" : ""
                )}
              >
                <span className="text-base shrink-0">{step.icon}</span>
                <span className={cn(
                  "font-medium",
                  i <= activeStep ? "text-white" : "text-[#1E293B]",
                  i === activeStep ? "text-[#00FFC8]" : ""
                )}>
                  {step.text}
                </span>
                {i < activeStep && (
                  <CheckCircle2 className="w-4 h-4 text-[#00D4A5] ml-auto shrink-0" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: Benefits List */}
      <div className="relative z-10">
        <p className="text-[#94A3B8] text-xs uppercase tracking-widest font-bold mb-4">Why teams choose Collabo</p>
        <ul className="grid grid-cols-1 gap-2">
          {BENEFITS.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-[#94A3B8]">
              <div className="w-7 h-7 rounded-md bg-[#081428] border border-[#1E293B] flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-[#00D4A5]" />
              </div>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}

// ─── Right Panel: Auth Form ────────────────────────────────────────────────────

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
      const timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
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
      options: { shouldCreateUser: true },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message || 'Failed to send code. Please try again.');
    } else {
      toast.success('Sign in code sent to your email.');
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
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error(error.message || 'Google login failed.');
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
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
    const pastedData = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '');
    if (pastedData) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) newOtp[i] = pastedData[i];
      setOtp(newOtp);
      otpInputRefs.current[Math.min(pastedData.length, 5)]?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] grid lg:grid-cols-[1fr_1fr] xl:grid-cols-[55%_45%]">
      
      {/* ── Left Panel ───────────────────────────────────────────────────── */}
      <LeftPanel />

      {/* ── Right Panel ──────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center min-h-screen p-6 md:p-12 bg-[#030712]">
        
        {/* Mobile Logo (hidden on desktop where left panel shows logo) */}
        <div className="lg:hidden mb-8">
          <Logo variant="full" size={28} href="/" />
        </div>

        <div className="w-full max-w-md">

          {/* Free Trial Badge */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="px-3 py-1.5 bg-[#00D4A5]/10 border border-[#00D4A5]/20 rounded-full flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00D4A5] animate-pulse" />
              <span className="text-xs font-bold text-[#00D4A5] uppercase tracking-wider">No credit card required</span>
            </div>
          </div>

          {/* Auth Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-[#081428] border border-[#1E293B] rounded-2xl p-8 shadow-2xl shadow-black/50"
          >

            <AnimatePresence mode="wait">
              {step === 'email' ? (

                // ── Step 1: Email ──────────────────────────────────────────
                <motion.div
                  key="email"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-3xl font-bold text-white mb-2">Welcome to Collabo</h2>
                  <p className="text-[#94A3B8] text-sm mb-8 leading-relaxed">
                    The AI-powered operating system for influencer campaigns. <br />
                    Sign in or create your account.
                  </p>

                  <form onSubmit={handleSendCode} className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@brand.com"
                          className="w-full bg-[#071126] border border-[#1E293B] text-white placeholder-[#94A3B8]/50 rounded-xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:border-[#00D4A5]/70 focus:ring-1 focus:ring-[#00D4A5]/20 transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !email.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-[#00D4A5] hover:bg-[#00FFC8] disabled:opacity-50 disabled:cursor-not-allowed text-[#030712] font-bold rounded-xl py-3.5 text-sm transition-all active:scale-95 shadow-[0_0_20px_rgba(0,212,165,0.2)]"
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Sending code...</>
                      ) : (
                        <>Continue with Email <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </form>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#1E293B]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 bg-[#081428] text-[#94A3B8] text-xs font-medium">OR</span>
                    </div>
                  </div>

                  {/* Google Button */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-[#071126] hover:bg-[#1E293B] border border-[#1E293B] hover:border-[#94A3B8]/30 text-white font-semibold rounded-xl py-3.5 text-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      <path d="M1 1h22v22H1z" fill="none" />
                    </svg>
                    Continue with Google
                  </button>
                </motion.div>

              ) : (

                // ── Step 2: OTP ────────────────────────────────────────────
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <button
                    onClick={() => setStep('email')}
                    className="text-[#94A3B8] hover:text-white transition-colors mb-6 flex items-center gap-2 text-sm font-medium"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>

                  <h2 className="text-2xl font-bold text-white mb-2">Check your inbox</h2>
                  <p className="text-[#94A3B8] text-sm mb-8">
                    We sent a 6-digit code to{' '}
                    <span className="text-white font-semibold">{email}</span>
                  </p>

                  <div className="space-y-6">
                    <div className="flex justify-between gap-2" onPaste={handlePaste}>
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => { otpInputRefs.current[index] = el; }}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          className="w-12 h-14 text-center text-xl font-bold bg-[#071126] border border-[#1E293B] text-white rounded-xl focus:outline-none focus:border-[#00D4A5]/70 focus:ring-1 focus:ring-[#00D4A5]/30 transition-all"
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleVerifyCode()}
                      disabled={loading || otp.join('').length !== 6}
                      className="w-full flex items-center justify-center gap-2 bg-[#00D4A5] hover:bg-[#00FFC8] disabled:opacity-50 disabled:cursor-not-allowed text-[#030712] font-bold rounded-xl py-3.5 text-sm transition-all active:scale-95 shadow-[0_0_20px_rgba(0,212,165,0.2)]"
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                      ) : (
                        <>Verify Code <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>

                    <div className="text-center">
                      {resendTimer > 0 ? (
                        <p className="text-sm text-[#94A3B8]">
                          Resend code in <span className="text-[#00D4A5] font-bold font-mono">{resendTimer}s</span>
                        </p>
                      ) : (
                        <button
                          onClick={handleSendCode}
                          disabled={loading}
                          className="text-sm text-[#00D4A5] hover:text-[#00FFC8] font-semibold transition-colors disabled:opacity-60"
                        >
                          {loading ? 'Sending...' : 'Resend Code'}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>

              )}
            </AnimatePresence>

          </motion.div>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
              <Shield className="w-3.5 h-3.5 text-[#00D4A5]" />
              <span>Secure Authentication</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
              <Zap className="w-3.5 h-3.5 text-[#00D4A5]" />
              <span>Ready in 60 seconds</span>
            </div>
          </div>

          {/* Mobile Benefits (shows only on mobile below the form) */}
          <div className="lg:hidden mt-10 border-t border-[#1E293B] pt-8">
            <p className="text-[#94A3B8] text-xs uppercase tracking-widest font-bold mb-4 text-center">Why Collabo?</p>
            <ul className="space-y-3">
              {BENEFITS.map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-[#94A3B8]">
                  <Icon className="w-4 h-4 text-[#00D4A5] shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-xs text-[#94A3B8]/60 mt-8">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-[#94A3B8] hover:text-white underline transition-colors">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-[#94A3B8] hover:text-white underline transition-colors">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
