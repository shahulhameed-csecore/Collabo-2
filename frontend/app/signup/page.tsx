'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Mail, Lock, Eye, EyeOff, ArrowRight,
  Loader2, CheckCircle, XCircle, Check, X
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';

// ─── Password strength rules ─────────────────────────────────────────────────
const RULES = [
  { id: 'length',    label: 'At least 8 characters',          test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter (A–Z)',      test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter (a–z)',      test: (p: string) => /[a-z]/.test(p) },
  { id: 'number',    label: 'One number (0–9)',                test: (p: string) => /[0-9]/.test(p) },
  { id: 'special',   label: 'One special character (!@#$...)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(passed: number): { label: string; color: string; barColor: string; bars: number } {
  if (passed <= 1) return { label: 'Very weak',  color: 'text-rose-400',   barColor: 'bg-rose-500',   bars: 1 };
  if (passed === 2) return { label: 'Weak',       color: 'text-orange-400', barColor: 'bg-orange-500', bars: 2 };
  if (passed === 3) return { label: 'Fair',       color: 'text-amber-400',  barColor: 'bg-amber-500',  bars: 3 };
  if (passed === 4) return { label: 'Strong',     color: 'text-emerald-400',barColor: 'bg-emerald-500',bars: 4 };
  return              { label: 'Very strong', color: 'text-emerald-400',barColor: 'bg-emerald-500',bars: 5 };
}

export default function SignupPage() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [showPassword, setShowPass]     = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [touched, setTouched]           = useState(false);
  const [loading, setLoading]           = useState(false);
  const [success, setSuccess]           = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Evaluate each rule against the current password
  const ruleResults = useMemo(() => RULES.map(r => ({ ...r, passed: r.test(password) })), [password]);
  const passedCount = ruleResults.filter(r => r.passed).length;
  const strength = getStrength(passedCount);
  const allPassed = passedCount === RULES.length;
  const passwordsMatch = password === confirmPassword;
  const isFormValid = allPassed && passwordsMatch && email.length > 0;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isFormValid) {
      if (!allPassed) toast.error('Please meet all password requirements.');
      else if (!passwordsMatch) toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Signup failed. Please try again.');
    } else {
      setSuccess(true);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast.error(error.message || 'Google login failed.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Account created!</h2>
            <p className="text-slate-400 text-sm mb-6">
              You can now log in with your credentials.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl py-3 text-sm transition-all shadow-lg shadow-emerald-500/25"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo variant="full" size={32} href="/" />
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
          <p className="text-slate-400 text-sm mb-6">Start managing campaigns for free</p>

          <form onSubmit={handleSignup} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@brand.com"
                  className="w-full bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setTouched(false); }}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-500 rounded-xl pl-10 pr-11 py-3 text-sm focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
                <button type="button" onClick={() => setShowPass(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength meter — only show when user starts typing */}
              {password.length > 0 && (
                <div className="mt-3 space-y-2">
                  {/* Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < strength.bars ? strength.barColor : 'bg-slate-700'}`}
                        />
                      ))}
                    </div>
                    <span className={`text-xs font-medium ${strength.color} whitespace-nowrap`}>{strength.label}</span>
                  </div>

                  {/* Rules checklist */}
                  <div className="grid grid-cols-1 gap-1 p-3 bg-slate-800/50 rounded-xl border border-slate-700/40">
                    {ruleResults.map((rule) => (
                      <div key={rule.id} className="flex items-center gap-2">
                        {rule.passed
                          ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          : <X className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                        }
                        <span className={`text-xs transition-colors ${rule.passed ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {rule.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full bg-slate-800/60 border text-white placeholder-slate-500 rounded-xl pl-10 pr-11 py-3 text-sm focus:outline-none focus:ring-1 transition-all
                    ${confirmPassword.length > 0
                      ? passwordsMatch
                        ? 'border-emerald-500/50 focus:border-emerald-500/70 focus:ring-emerald-500/30'
                        : 'border-rose-500/50 focus:border-rose-500/70 focus:ring-rose-500/30'
                      : 'border-slate-700/50 focus:border-emerald-500/70 focus:ring-emerald-500/30'
                    }`}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {/* Match indicator */}
                {confirmPassword.length > 0 && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2">
                    {passwordsMatch
                      ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                      : <XCircle className="w-4 h-4 text-rose-400" />
                    }
                  </div>
                )}
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-rose-400 mt-1.5 ml-1">Passwords do not match</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 mt-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                : <>Create account <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          {/* Divider */}
          <div className="relative mt-6 mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800/60"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-900 text-slate-500">Or continue with</span>
            </div>
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 font-semibold rounded-xl py-3 text-sm transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
              <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            Google
          </button>

          <p className="mt-8 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
