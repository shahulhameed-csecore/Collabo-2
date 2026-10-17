'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  Mic, 
  MessageSquare, 
  FileText, 
  Check, 
  Copy, 
  Sparkles, 
  Play, 
  Pause, 
  ShieldCheck, 
  Radio, 
  CheckCheck
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" fill="currentColor" />
    </svg>
  );
}

interface PipelineCase {
  id: string;
  tabTitle: string;
  tabIcon: typeof Mic;
  sourceLabel: string;
  handle: string;
  platform: 'Instagram' | 'YouTube';
  commercial: string;
  deliverables: string;
  deadline: string;
  status: string;
  magicToken: string;
  shortlink: string;
  clicks: number;
  cpc: string;
  latency: string;
  confidence: string;
  voiceDuration?: string;
  transcript?: string;
  chatBubbles?: Array<{ sender: 'creator' | 'brand'; text: string; time: string }>;
  pdfSnippet?: { title: string; agency: string; clauses: string[] };
}

const PIPELINE_CASES: PipelineCase[] = [
  {
    id: 'voice',
    tabTitle: 'Hinglish Voice Note',
    tabIcon: Mic,
    sourceLabel: 'WhatsApp Voice Note (0:38)',
    handle: '@rohan_vlogs',
    platform: 'Instagram',
    commercial: '₹15,000',
    deliverables: '1 Reel + 2 Stories',
    deadline: '24 Oct 2026',
    status: 'Reminder Queued',
    magicToken: 'tok_rh98x1',
    shortlink: 'mycollabo.online/t/rohan15',
    clicks: 128,
    cpc: '₹117.18',
    latency: '780ms',
    confidence: '99.8%',
    voiceDuration: '0:38',
    transcript: '“Bhai 15k final karte hai for 1 Reel + 2 Stories, 24 Oct tak live kar dunga. 50% advance bhej do baki post hone ke baad.”',
  },
  {
    id: 'screenshot',
    tabTitle: 'DM Screenshot',
    tabIcon: MessageSquare,
    sourceLabel: 'WhatsApp Chat Export',
    handle: '@priya_glow',
    platform: 'YouTube',
    commercial: '₹22,500',
    deliverables: '1 YouTube Shorts',
    deadline: '02 Nov 2026',
    status: 'In Review',
    magicToken: 'tok_pg33m7',
    shortlink: 'mycollabo.online/t/priya_glow',
    clicks: 412,
    cpc: '₹54.61',
    latency: '840ms',
    confidence: '99.4%',
    chatBubbles: [
      { sender: 'brand', text: 'Hey Priya! What is your commercial for 1 dedicated skincare YouTube Shorts?', time: '14:12' },
      { sender: 'creator', text: 'Hii! ₹22,500 for 1 YT Shorts with pinned comment link. Can deliver by 02 Nov 2026.', time: '14:15' },
      { sender: 'brand', text: 'Done deal. Sending you the Collabo magic link for proof upload.', time: '14:16' }
    ]
  },
  {
    id: 'brief',
    tabTitle: 'Agency Brief PDF',
    tabIcon: FileText,
    sourceLabel: 'Campaign_Deal_Memo_v1.pdf',
    handle: '@tech_kabir',
    platform: 'Instagram',
    commercial: '₹45,000',
    deliverables: '1 IG Reel + Bio Link',
    deadline: '15 Nov 2026',
    status: 'Contract Bound',
    magicToken: 'tok_tk04k9',
    shortlink: 'mycollabo.online/t/techkabir',
    clicks: 890,
    cpc: '₹50.56',
    latency: '920ms',
    confidence: '99.9%',
    pdfSnippet: {
      title: 'Creator Scope of Work // Pulse Media',
      agency: 'PulseMedia D2C Mandate #PM-4491',
      clauses: [
        'Deliverable: 1x 60s Instagram Reel (4K 60fps) + 72h Link in Bio',
        'Agreed Total Fee: INR 45,000 net payable on verification',
        'Mandatory Go-Live Date: 15 November 2026 18:00 IST'
      ]
    }
  }
];

export function HeroLiveDemo() {
  const [activeTab, setActiveTab] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const currentCase = PIPELINE_CASES[activeTab];

  // Auto-cycle through tabs every 4.5 seconds, pause when hovered
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % PIPELINE_CASES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isHovered, activeTab]);

  const handleCopyLink = (token: string) => {
    navigator.clipboard.writeText(`https://mycollabo.online/submit-proof/${token}`);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <section className="relative pt-16 pb-28 md:pt-24 md:pb-36 overflow-hidden">
      
      {/* ── Atmospheric Radial Spotlights & Dot Matrix Mask ─────────────────── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(16,185,129,0.14),transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-dot-grid opacity-35 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_45%,#000_60%,transparent_100%)] pointer-events-none" />

      <div className="max-w-[1320px] mx-auto px-6 sm:px-12 relative z-10">
        
        {/* Eyebrow & Smooth Editorial Headline */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 font-sans text-xs font-medium mb-6 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.15)]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Zero-Entry Influencer CRM • Powered by Gemini 3.5</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-medium tracking-[-0.03em] leading-[1.08] mb-6 text-gradient-metallic"
          >
            <span className="block">From WhatsApp Chaos</span>
            <span className="block">to Campaign Clarity.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="text-base sm:text-lg lg:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-sans font-normal mb-9"
          >
            Built for Indian D2C brands and agencies. Forward creator voice notes, Hinglish DMs, or rate screenshots to our WhatsApp bot—Gemini AI structures your entire campaign pipeline automatically.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
          >
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-[#05070B] bg-emerald-400 hover:bg-emerald-300 active:scale-[0.98] transition-all duration-150 shadow-[0_2px_12px_rgba(16,185,129,0.3)] font-sans"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-slate-300 bg-[#0A0E17]/80 hover:bg-[#101624] border border-white/[0.08] hover:border-white/[0.14] transition-all duration-150 font-sans backdrop-blur-sm"
            >
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>Explore Live Dashboard</span>
            </Link>
          </motion.div>

          <div className="mt-5 text-xs font-sans text-slate-400">
            Zero credit card required • 2-minute activation • Unlimited campaigns during trial
          </div>
        </div>

        {/* ── UNPACKED INTERACTIVE PIPELINE DEMO ───────────────────────────────── */}
        <div 
          id="pipeline"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative max-w-5xl mx-auto scroll-mt-28"
        >
          
          {/* Main Floating Glass Pipeline Canvas */}
          <div className="rounded-2xl bg-[#080C14]/90 border border-white/[0.08] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl overflow-hidden">
            
            {/* Top Toolbar / Tab Switcher */}
            <div className="px-5 py-3.5 bg-[#0A0E17]/80 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-sans text-slate-400 font-medium">Input Source:</span>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/[0.06]">
                  {PIPELINE_CASES.map((c, idx) => {
                    const Icon = c.tabIcon;
                    const isActive = activeTab === idx;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setActiveTab(idx);
                        }}
                        className={cn(
                          "relative overflow-hidden flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all duration-200",
                          isActive
                            ? "bg-white/[0.1] text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        )}
                      >
                        <Icon className={cn("w-3.5 h-3.5", isActive ? "text-emerald-400" : "text-slate-400")} />
                        <span>{c.tabTitle}</span>
                        {isActive && (
                          <div
                            key={`tab-progress-${activeTab}`}
                            className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-emerald-400 to-teal-300 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-tab-progress"
                            style={{ animationPlayState: isHovered ? 'paused' : 'running' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-sans text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium">Gemini 3.5 Active</span>
              </div>
            </div>

            {/* Main Interactive Stage: Left Source -> Center Flowing Laser -> Right Structured Card */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 sm:p-8 items-center">
              
              {/* ── LEFT: Realistic Input Media (Col 1-5) ───────────────────────── */}
              <div className="lg:col-span-5 flex flex-col justify-center">
                
                <div className="flex items-center justify-between text-xs text-slate-400 font-sans mb-3">
                  <span className="font-medium">Raw Unstructured Message</span>
                  <span className="text-slate-400 text-[11px]">{currentCase.sourceLabel}</span>
                </div>

                <AnimatePresence mode="wait">
                  
                  {/* WhatsApp Voice Note Player */}
                  {currentCase.id === 'voice' && (
                    <motion.div
                      key="voice-player"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                      className="rounded-2xl bg-[#0C1520] border border-white/[0.08] p-4 shadow-lg space-y-4"
                    >
                      {/* WhatsApp Audio Player Widget */}
                      <div className="flex items-center gap-3.5 bg-[#06101A] rounded-xl p-3 border border-emerald-500/10">
                        <button
                          onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                          className="w-10 h-10 rounded-full bg-emerald-500 text-[#05070B] flex items-center justify-center hover:bg-emerald-400 transition-all shrink-0 shadow-md"
                          aria-label={isPlayingAudio ? 'Pause audio' : 'Play audio'}
                        >
                          {isPlayingAudio ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current translate-x-0.5" />
                          )}
                        </button>

                        <div className="flex-1 space-y-1.5">
                          {/* Animated Voice Bars */}
                          <div className="flex items-center gap-1 h-7">
                            {[30, 60, 40, 85, 95, 50, 75, 45, 90, 70, 35, 65, 80, 50, 70, 40, 85, 30].map((h, i) => (
                              <span
                                key={i}
                                className={cn(
                                  "flex-1 rounded-full transition-all duration-200",
                                  isPlayingAudio ? "bg-emerald-400" : "bg-slate-600"
                                )}
                                style={{
                                  height: isPlayingAudio ? `${Math.max(25, h * (i % 2 === 0 ? 1 : 0.85))}%` : `${h * 0.7}%`
                                }}
                              />
                            ))}
                          </div>
                          
                          <div className="flex justify-between items-center text-[11px] font-sans text-slate-400">
                            <span>0:14 / {currentCase.voiceDuration}</span>
                            <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
                              <CheckCheck className="w-3.5 h-3.5" /> 11:42 AM
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp Transcript Quote */}
                      <div className="rounded-xl bg-white/[0.03] p-3 text-xs text-slate-300 font-sans leading-relaxed italic border-l-2 border-emerald-400">
                        {currentCase.transcript}
                      </div>
                    </motion.div>
                  )}

                  {/* WhatsApp Chat Conversation */}
                  {currentCase.id === 'screenshot' && (
                    <motion.div
                      key="chat-screenshot"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                      className="rounded-2xl bg-[#09111C] border border-white/[0.08] p-4 shadow-lg space-y-2.5"
                    >
                      {currentCase.chatBubbles?.map((b, i) => (
                        <div
                          key={i}
                          className={cn(
                            "max-w-[88%] p-3 rounded-2xl text-xs font-sans leading-relaxed shadow-sm",
                            b.sender === 'brand'
                              ? "ml-auto bg-slate-800/90 text-slate-200 rounded-tr-xs"
                              : "mr-auto bg-[#0A261D] text-emerald-100 border border-emerald-500/20 rounded-tl-xs"
                          )}
                        >
                          <div className="flex justify-between items-center gap-2 mb-1 text-[10px] opacity-70">
                            <span className="font-medium">{b.sender === 'brand' ? 'You (Brand Manager)' : '@priya_glow'}</span>
                            <span className="text-[10px]">{b.time}</span>
                          </div>
                          <p>{b.text}</p>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {/* Agency PDF Document Card */}
                  {currentCase.id === 'brief' && (
                    <motion.div
                      key="brief-doc"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 260, damping: 25 }}
                      className="rounded-2xl bg-[#09111C] border border-white/[0.08] p-4 shadow-lg space-y-3"
                    >
                      <div className="flex items-center gap-2.5 pb-2 border-b border-white/[0.06] text-xs font-sans text-slate-200">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <span className="font-medium">{currentCase.pdfSnippet?.title}</span>
                      </div>
                      <div className="text-xs text-slate-400 font-sans">
                        {currentCase.pdfSnippet?.agency}
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300 font-sans">
                        {currentCase.pdfSnippet?.clauses.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-400 text-xs mt-0.5">•</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                </AnimatePresence>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 font-sans">
                  <span>Sender: <strong className="font-mono text-slate-200">{currentCase.handle}</strong></span>
                  <span>WhatsApp: +91 63747 71074</span>
                </div>
              </div>

              {/* ── CENTER: Flowing Glowing Emerald Beam & Gemini Node (Col 6-7) ───────── */}
              <div className="lg:col-span-2 flex flex-col items-center justify-center py-6 lg:py-0 relative">
                
                {/* Desktop Flowing Laser Conduit System */}
                <div className="hidden lg:flex items-center w-full relative">
                  
                  {/* Left-to-Center Pipe: Raw Input -> Gemini 3.5 */}
                  <div className="flex-1 relative h-10 flex items-center">
                    <svg className="w-full h-6 overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="beamGradLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.1" />
                          <stop offset="60%" stopColor="#10B981" stopOpacity="0.7" />
                          <stop offset="100%" stopColor="#34D399" stopOpacity="1" />
                        </linearGradient>
                        <filter id="emeraldGlowLeft" x="-30%" y="-30%" width="160%" height="160%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <line x1="0" y1="12" x2="100%" y2="12" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="3 3" />
                      <line 
                        x1="0" 
                        y1="12" 
                        x2="100%" 
                        y2="12" 
                        stroke="url(#beamGradLeft)" 
                        strokeWidth="2.5" 
                        filter="url(#emeraldGlowLeft)"
                        strokeDasharray="16 24"
                        className="animate-beam-left"
                      />
                    </svg>
                    {/* Dynamic Shooting Data Packet Particle (Left to Center) */}
                    <motion.div
                      animate={{ 
                        left: ['0%', '100%'],
                        opacity: [0, 1, 1, 0.4],
                        scale: [0.7, 1.2, 1, 0.8]
                      }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 1.8, 
                        ease: "easeInOut" 
                      }}
                      className="absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 rounded-full bg-emerald-300 shadow-[0_0_12px_#34D399,0_0_24px_#10B981] pointer-events-none"
                    />
                  </div>

                  {/* Center Gemini Extraction Hub Node */}
                  <div className="relative z-10 mx-1 px-3 py-2.5 rounded-2xl bg-[#0D1522] border border-emerald-500/40 text-center shadow-[0_4px_24px_rgba(16,185,129,0.15),inset_0_1px_0_0_rgba(255,255,255,0.1)] group/node hover:border-emerald-400 transition-all shrink-0">
                    <div className="absolute -inset-1 rounded-2xl bg-emerald-500/20 blur-sm animate-pulse -z-10" />
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400/20 to-teal-500/10 border border-emerald-400/30 text-emerald-400 flex items-center justify-center mx-auto mb-1 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                      <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
                    </div>
                    <div className="text-[11px] font-sans font-semibold text-white tracking-tight">
                      Gemini 3.5
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400 mt-0.5 flex items-center justify-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                      <span>{currentCase.latency}</span>
                    </div>
                  </div>

                  {/* Center-to-Right Pipe: Gemini 3.5 -> Structured Record */}
                  <div className="flex-1 relative h-10 flex items-center">
                    <svg className="w-full h-6 overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="beamGradRight" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#34D399" stopOpacity="1" />
                          <stop offset="40%" stopColor="#10B981" stopOpacity="0.7" />
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0.1" />
                        </linearGradient>
                        <filter id="emeraldGlowRight" x="-30%" y="-30%" width="160%" height="160%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <line x1="0" y1="12" x2="100%" y2="12" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="3 3" />
                      <line 
                        x1="0" 
                        y1="12" 
                        x2="100%" 
                        y2="12" 
                        stroke="url(#beamGradRight)" 
                        strokeWidth="2.5" 
                        filter="url(#emeraldGlowRight)"
                        strokeDasharray="16 24"
                        className="animate-beam-right"
                      />
                    </svg>
                    {/* Dynamic Shooting Data Packet Particle (Center to Right) with 0.9s delay offset */}
                    <motion.div
                      animate={{ 
                        left: ['0%', '100%'],
                        opacity: [0.4, 1, 1, 0],
                        scale: [0.8, 1.2, 1, 0.7]
                      }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 1.8, 
                        delay: 0.9,
                        ease: "easeInOut" 
                      }}
                      className="absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 rounded-full bg-emerald-300 shadow-[0_0_12px_#34D399,0_0_24px_#10B981] pointer-events-none"
                    />
                  </div>

                </div>

                {/* Mobile / Tablet Vertical Flow Connector */}
                <div className="lg:hidden flex flex-col items-center gap-2 py-3 w-full">
                  <div className="w-[2px] h-6 bg-gradient-to-b from-transparent via-emerald-400 to-emerald-500 shadow-[0_0_8px_#10B981]" />
                  <div className="px-3 py-1.5 rounded-xl bg-[#0D1522] border border-emerald-500/30 flex items-center gap-2 text-xs text-white">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-semibold">Gemini 3.5</span>
                    <span className="font-mono text-emerald-400 text-[10px]">• {currentCase.latency}</span>
                  </div>
                  <div className="w-[2px] h-6 bg-gradient-to-b from-emerald-500 via-emerald-400 to-transparent shadow-[0_0_8px_#10B981]" />
                </div>

              </div>

              {/* ── RIGHT: Sleek Unpacked Floating Glass Card (Col 8-12) ──────── */}
              <div className="lg:col-span-5">
                
                <div className="flex items-center justify-between text-xs font-sans text-slate-400 mb-3">
                  <span className="font-medium">Structured Campaign Record</span>
                  <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                </div>

                {/* Sleek Floating Glass Card with Soft Hairline Dividers (No boxed cages) */}
                <div className="rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.08] backdrop-blur-xl p-5 shadow-2xl divide-y divide-white/[0.06]">
                  
                  {/* Top: Handle, Platform & Commercial */}
                  <div className="pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-slate-300">
                        {currentCase.platform === 'Instagram' ? (
                          <InstagramIcon className="w-4 h-4 text-pink-400" />
                        ) : (
                          <YoutubeIcon className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-mono font-semibold text-white">
                          {currentCase.handle}
                        </div>
                        <div className="text-xs font-sans text-slate-400">
                          {currentCase.platform} Creator
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-mono font-semibold text-emerald-400 tabular-nums">
                        {currentCase.commercial}
                      </div>
                      <div className="text-[10px] font-sans text-slate-400">
                        Agreed Fee
                      </div>
                    </div>
                  </div>

                  {/* Middle: Deliverables & Deadline as natural rows */}
                  <div className="py-3.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[11px] font-sans text-slate-400">Deliverables</div>
                      <div className="font-sans font-medium text-slate-200 mt-0.5">
                        {currentCase.deliverables}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] font-sans text-slate-400">Go-Live Deadline</div>
                      <div className="font-mono text-amber-300 tabular-nums mt-0.5">
                        {currentCase.deadline}
                      </div>
                    </div>
                  </div>

                  {/* Links Row: Magic Proof & Attribution Link */}
                  <div className="pt-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-sans text-slate-400 text-[11px]">Magic Proof Link</span>
                      <button
                        onClick={() => handleCopyLink(currentCase.magicToken)}
                        className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300 hover:text-white transition-colors"
                      >
                        {copiedToken ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span className="underline decoration-slate-700">/submit-proof/{currentCase.magicToken}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-sans text-slate-400 text-[11px]">Tracking Shortlink</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-emerald-400">
                          {currentCase.shortlink}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                          ({currentCase.clicks} clicks)
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="mt-3 flex items-center justify-between text-xs font-sans text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    48h WhatsApp Chaser: <strong className="text-slate-200 font-normal">Armed</strong>
                  </span>
                  <span>Turnaround: <strong className="font-mono text-emerald-400">{currentCase.latency}</strong></span>
                </div>

              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
