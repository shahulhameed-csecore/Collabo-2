'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { 
  MessageSquare, 
  LayoutDashboard, 
  CheckCircle, 
  ArrowRight,
  Shield,
  Clock,
  Smartphone,
  Sparkles,
  Zap,
  Bot
} from 'lucide-react';

export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setIsAuthenticated(true);
        router.push('/dashboard');
      }
    });
  }, [supabase.auth, router]);

  // Button styles mimicking shadcn/ui
  const buttonBase = "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none";
  const buttonPrimary = `${buttonBase} bg-emerald-500 text-white hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] h-12 px-8`;
  const buttonSecondary = `${buttonBase} bg-slate-900 border border-slate-700 text-slate-100 hover:bg-slate-800 hover:text-white h-12 px-8`;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden">
      
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo variant="full" size={32} href="/" />
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block">
              Log in
            </Link>
            <Link href="/signup" className={`${buttonBase} bg-white text-slate-950 hover:bg-slate-200 h-9 px-4 text-xs shadow-sm`}>
              Try for Free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
          {/* Background Gradients */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none opacity-50 mix-blend-screen" />
          
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8 shadow-sm">
              <Sparkles className="w-4 h-4" />
              Built for Indian D2C Brands
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight mb-8 leading-[1.1]">
              Stop managing influencers <br className="hidden sm:block" />
              in <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">WhatsApp chaos.</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Forward voice notes, negotiations, and deliverables to our AI bot. We instantly extract the data and track it in your campaign dashboard.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className={buttonPrimary}>
                Try for Free
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/login" className={buttonSecondary}>
                Login to Dashboard
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-500 flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" /> No credit card required. Cancel anytime.
            </p>
          </div>

          {/* Abstract Dashboard Mockup */}
          <div className="max-w-6xl mx-auto mt-20 px-4 sm:px-6 relative" style={{ perspective: '1000px' }}>
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent z-10 pointer-events-none" />
            <div className="relative rounded-2xl border border-slate-800 bg-slate-900/50 shadow-2xl overflow-hidden backdrop-blur-sm transform-gpu rotate-x-12 scale-105 opacity-90 transition-all duration-1000 hover:rotate-x-0 hover:scale-100" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(12deg) scale(1.05)' }}>
              {/* Mock Window Controls */}
              <div className="h-10 border-b border-slate-800 flex items-center px-4 gap-2 bg-slate-950/50">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <div className="p-6 grid grid-cols-12 gap-6 h-[400px]">
                {/* Mock Sidebar */}
                <div className="col-span-3 space-y-4">
                  <div className="h-8 w-3/4 bg-slate-800 rounded-lg animate-pulse" />
                  <div className="h-4 w-full bg-slate-800/50 rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-slate-800/50 rounded animate-pulse" />
                  <div className="h-4 w-4/6 bg-slate-800/50 rounded animate-pulse" />
                </div>
                {/* Mock Main Content */}
                <div className="col-span-9 space-y-6">
                  <div className="flex gap-4">
                    <div className="h-24 flex-1 bg-emerald-900/20 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                      <div className="text-emerald-400/50 font-mono text-sm">Active Campaigns</div>
                    </div>
                    <div className="h-24 flex-1 bg-slate-800/50 rounded-xl" />
                    <div className="h-24 flex-1 bg-slate-800/50 rounded-xl" />
                  </div>
                  <div className="h-full bg-slate-800/30 rounded-xl border border-slate-800" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Logos / Trust Signals */}
        <section className="border-y border-white/5 bg-slate-900/20 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-6">Trusted by fast-growing brands</p>
            <div className="flex flex-wrap justify-center items-center gap-10 sm:gap-16 opacity-50 grayscale">
               <span className="text-xl font-bold font-serif">Minimalist.</span>
               <span className="text-xl font-black italic">FITNESS+</span>
               <span className="text-xl font-bold tracking-tighter">GLOW</span>
               <span className="text-xl font-light tracking-widest">NATURE</span>
               <span className="text-xl font-bold">KetoInd</span>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">How Collabo Works</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">From messy negotiations to perfectly structured campaigns in four simple steps.</p>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              {[
                { 
                  icon: <MessageSquare className="w-6 h-6 text-emerald-400" />,
                  title: "1. Negotiate on WhatsApp",
                  desc: "Chat with creators normally. Discuss deliverables, timelines, and budgets just like you always do."
                },
                { 
                  icon: <Smartphone className="w-6 h-6 text-emerald-400" />,
                  title: "2. Forward to Bot",
                  desc: "Simply forward the voice note, image, or text to our official Collabo WhatsApp Bot."
                },
                { 
                  icon: <Bot className="w-6 h-6 text-emerald-400" />,
                  title: "3. AI Extracts Details",
                  desc: "Our Gemini AI instantly reads the chat and extracts dates, costs, and content requirements."
                },
                { 
                  icon: <LayoutDashboard className="w-6 h-6 text-emerald-400" />,
                  title: "4. Track in Dashboard",
                  desc: "Your campaign is magically drafted. Approve it, track deadlines, and get automated reminders."
                }
              ].map((step, i) => (
                <div key={i} className="group relative bg-slate-900 border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1">
                  <div className="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center mb-6 border border-slate-800 group-hover:border-emerald-500/50 transition-colors">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features / Benefits */}
        <section className="py-24 bg-slate-900/30 border-y border-white/5 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 leading-tight">Scale your influencer marketing, <span className="text-emerald-400">without the headcount.</span></h2>
                <p className="text-slate-400 text-lg mb-10">Collabo acts as your automated campaign manager, so you can focus on building relationships instead of updating spreadsheets.</p>
                
                <div className="space-y-8">
                  <div className="flex gap-4 items-start">
                    <div className="mt-1 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20"><CheckCircle className="w-6 h-6 text-emerald-400" /></div>
                    <div>
                      <h4 className="text-xl font-bold text-white mb-2">Never Miss a Deliverable</h4>
                      <p className="text-slate-400 leading-relaxed">Automated email and WhatsApp reminders ensure creators post on time. Get notified before a deadline is missed.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="mt-1 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20"><Zap className="w-6 h-6 text-blue-400" /></div>
                    <div>
                      <h4 className="text-xl font-bold text-white mb-2">Save 10+ Hours a Week</h4>
                      <p className="text-slate-400 leading-relaxed">Stop manually updating Google Sheets. The AI bot logs data, tracks payments, and organizes deliverables for you.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="mt-1 bg-purple-500/10 p-2 rounded-lg border border-purple-500/20"><Shield className="w-6 h-6 text-purple-400" /></div>
                    <div>
                      <h4 className="text-xl font-bold text-white mb-2">Zero-Trust Security</h4>
                      <p className="text-slate-400 leading-relaxed">Your campaign data is encrypted via Supabase RLS. We don't train public AI models on your private negotiations.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Image / Graphic Area */}
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-[100px] rounded-full pointer-events-none" />
                <div className="relative bg-[#020617] border border-slate-800 rounded-3xl p-8 shadow-2xl">
                   <div className="space-y-6">
                      {/* Fake WhatsApp Chat */}
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shrink-0">CR</div>
                        <div className="bg-slate-800 rounded-2xl rounded-tl-sm p-4 text-sm text-slate-200 shadow-sm border border-slate-700">
                          "Hey! Yes, ₹15,000 works for 1 Reel and 2 Stories. Can post by Friday."
                        </div>
                      </div>
                      
                      <div className="flex justify-center">
                        <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
                           <Sparkles className="w-3 h-3" /> AI Extracting Details...
                        </div>
                      </div>
                      
                      {/* Fake Dashboard Entry */}
                      <div className="bg-slate-900 border border-emerald-500/50 rounded-xl p-5 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-2xl"></div>
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-white font-bold">Campaign Drafted</span>
                          <span className="bg-emerald-500 text-white text-xs px-2 py-1 rounded font-semibold shadow-sm">Ready</span>
                        </div>
                        <div className="space-y-3 text-sm relative z-10">
                          <div className="flex justify-between border-b border-slate-800 pb-2">
                            <span className="text-slate-400">Deliverables</span>
                            <span className="text-white font-medium">1 Reel, 2 Stories</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-800 pb-2">
                            <span className="text-slate-400">Budget</span>
                            <span className="text-emerald-400 font-medium">₹15,000</span>
                          </div>
                          <div className="flex justify-between pb-1">
                            <span className="text-slate-400">Deadline</span>
                            <span className="text-white font-medium">Friday</span>
                          </div>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-emerald-950/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[400px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">Ready to bring order to the chaos?</h2>
            <p className="text-xl text-emerald-100/70 mb-10 max-w-2xl mx-auto">
              Join hundreds of D2C brands automating their influencer marketing with Collabo.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className={`${buttonPrimary} scale-100 sm:scale-110 shadow-2xl shadow-emerald-500/20 group`}>
                Start Your Free Trial
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <p className="mt-8 text-sm text-slate-400">14-day free trial • ₹599/month after • Cancel anytime</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#020617] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50 grayscale">
            <Logo variant="full" size={24} href="" className="grayscale opacity-50" />
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

