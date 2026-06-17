'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { 
  Zap, 
  MessageSquare, 
  LayoutDashboard, 
  CheckCircle, 
  TrendingUp, 
  ArrowRight,
  Shield,
  Clock,
  Smartphone
} from 'lucide-react';

export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setIsAuthenticated(true);
      }
    });
  }, [supabase.auth]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500 rounded-lg shadow-lg shadow-emerald-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Collabo</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link 
                href="/dashboard"
                className="px-5 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-all shadow-lg shadow-emerald-500/20"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block">
                  Log in
                </Link>
                <Link 
                  href="/signup"
                  className="px-5 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-all shadow-lg shadow-emerald-500/20"
                >
                  Start Free Trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight mb-8 leading-tight">
              Stop managing influencers <br className="hidden sm:block" />
              in <span className="text-emerald-400">WhatsApp chaos.</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Turn forwarded chats and voice notes into clean, trackable campaigns automatically. The smartest way for Indian D2C brands to scale influencer marketing.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href={isAuthenticated ? "/dashboard" : "/signup"}
                className="w-full sm:w-auto px-8 py-4 text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 group"
              >
                {isAuthenticated ? "Open Dashboard" : "Try Collabo for Free"}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              {!isAuthenticated && (
                <Link 
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 text-base font-bold bg-slate-900 border border-slate-700 hover:border-slate-600 text-white rounded-xl transition-all flex items-center justify-center"
                >
                  Book a Demo
                </Link>
              )}
            </div>
            <p className="mt-4 text-sm text-slate-500">No credit card required • 14-day free trial</p>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 bg-slate-900/50 border-y border-slate-800/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">How Collabo Works</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">From messy negotiations to perfectly structured campaigns in three simple steps.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 relative">
                <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-6 border border-slate-700">
                  <MessageSquare className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">1. Negotiate on WhatsApp</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Chat with creators normally. Discuss deliverables, timelines, and budgets just like you always do.
                </p>
                <div className="absolute top-8 right-8 text-6xl font-black text-slate-800/30">1</div>
              </div>

              {/* Step 2 */}
              <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-2xl p-8 relative">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">2. Forward to Collabo Bot</h3>
                <p className="text-emerald-100/70 text-sm leading-relaxed">
                  Simply forward the voice note, image, or text to our official WhatsApp Bot. Our AI extracts everything instantly.
                </p>
                <div className="absolute top-8 right-8 text-6xl font-black text-emerald-500/10">2</div>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 relative">
                <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-6 border border-slate-700">
                  <LayoutDashboard className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">3. Track on Dashboard</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Your campaign is magically drafted. Approve it, track deadlines, and get automated reminders before posts go live.
                </p>
                <div className="absolute top-8 right-8 text-6xl font-black text-slate-800/30">3</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl font-bold text-white mb-6">Designed specifically for Indian D2C brands.</h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="mt-1"><CheckCircle className="w-6 h-6 text-emerald-400" /></div>
                    <div>
                      <h4 className="text-lg font-bold text-white mb-1">Never Miss a Deliverable</h4>
                      <p className="text-slate-400 text-sm">Automated email and WhatsApp reminders ensure creators post on time.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="mt-1"><Clock className="w-6 h-6 text-emerald-400" /></div>
                    <div>
                      <h4 className="text-lg font-bold text-white mb-1">Save 10+ Hours a Week</h4>
                      <p className="text-slate-400 text-sm">Stop manually updating Google Sheets. The AI bot logs data for you.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="mt-1"><Shield className="w-6 h-6 text-emerald-400" /></div>
                    <div>
                      <h4 className="text-lg font-bold text-white mb-1">Zero-Trust Security</h4>
                      <p className="text-slate-400 text-sm">Your campaign data is encrypted and isolated. We don't train public AI on your chats.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/10 blur-[80px] rounded-full" />
                <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl p-6 shadow-2xl">
                  <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <div className="ml-2 text-xs text-slate-500 font-mono">collabo-dashboard</div>
                  </div>
                  {/* Mock UI */}
                  <div className="space-y-4">
                    <div className="h-10 bg-slate-800 rounded-lg w-full" />
                    <div className="flex gap-4">
                      <div className="h-32 bg-slate-800 rounded-lg w-1/3" />
                      <div className="h-32 bg-slate-800 rounded-lg w-2/3" />
                    </div>
                    <div className="h-24 bg-slate-800 rounded-lg w-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Teaser */}
        <section className="py-20 bg-emerald-950/20 border-t border-emerald-900/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Simple, transparent pricing.</h2>
            <p className="text-xl text-slate-300 mb-8">
              Everything you need to manage your influencers, for just <span className="text-emerald-400 font-bold">₹599 / month</span>.
            </p>
            <Link 
              href={isAuthenticated ? "/dashboard" : "/signup"}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20"
            >
              Start Your 14-Day Free Trial
            </Link>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 border-t border-slate-800/60 bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl font-bold text-white mb-12">Trusted by fast-growing D2C Brands</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { name: "Rahul S.", role: "Founder, GlowIndia", text: "Collabo completely replaced our messy Google Sheets. The WhatsApp bot is literal magic." },
                { name: "Priya M.", role: "Marketing Lead", text: "We scaled from 10 to 50 creators a month without hiring another manager. Best ₹599 spent." },
                { name: "Ankit K.", role: "D2C Owner", text: "The automated reminders saved us from so many missed deadlines. Highly recommend for any Indian brand." }
              ].map((testimonial, i) => (
                <div key={i} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="flex text-emerald-400 mb-4">
                    {[1, 2, 3, 4, 5].map(star => <svg key={star} className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}
                  </div>
                  <p className="text-slate-300 text-sm mb-6 leading-relaxed">"{testimonial.text}"</p>
                  <div>
                    <p className="font-bold text-white text-sm">{testimonial.name}</p>
                    <p className="text-xs text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-emerald-500" />
            <span className="text-xl font-bold text-white tracking-tight">Collabo</span>
          </div>
          
          <div className="flex gap-8 text-sm">
            <Link href="/privacy" className="text-slate-400 hover:text-emerald-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-slate-400 hover:text-emerald-400 transition-colors">Terms of Service</Link>
            <a href="mailto:support@collabo.app" className="text-slate-400 hover:text-emerald-400 transition-colors">Contact</a>
          </div>
          
          <p className="text-sm text-slate-600">
            © {new Date().getFullYear()} Collabo. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  );
}
