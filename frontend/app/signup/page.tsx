'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  Zap, Mail, Lock, Eye, EyeOff, ArrowRight,
  Loader2, CheckCircle, XCircle, Check, X
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

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
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-2.5 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/30">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">InfluencerTrack</span>
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

          <p className="mt-6 text-center text-sm text-slate-500">
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
