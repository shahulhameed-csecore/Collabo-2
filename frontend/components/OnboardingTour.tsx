'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Sparkles, ArrowRight, ArrowLeft, Check, X, Plus, MessageSquare, LayoutDashboard } from 'lucide-react';
import { useCampaignModal } from '@/contexts/CampaignModalContext';

interface OnboardingTourProps {
  setMobileSidebarOpen: (open: boolean) => void;
  setDesktopSidebarOpen: (open: boolean) => void;
  desktopSidebarOpen: boolean;
}

type StepConfig = {
  id: string;
  targetId?: string;
  title: string;
  content: string;
  requiresSidebar?: boolean;
};

const TOUR_STEPS: StepConfig[] = [
  {
    id: 'welcome',
    title: 'Welcome to Collabo. 👋',
    content: 'The ultimate AI-powered operating system for your influencer campaigns.',
  },
  {
    id: 'create-campaign',
    targetId: 'tour-new-campaign-sidebar',
    title: 'Create Campaigns',
    content: 'Start here. You can manually create a campaign or add deliverables and deadlines in one click.',
    requiresSidebar: true,
  },
  {
    id: 'ai-extraction',
    targetId: 'tour-ai-insight',
    title: 'AI Extraction',
    content: 'Upload screenshots or forward chats. Collabo automatically extracts campaign details instantly.',
    requiresSidebar: true,
  },
  {
    id: 'dashboard',
    targetId: 'tour-nav-dashboard',
    title: 'Campaign Dashboard',
    content: 'Track campaign status, monitor payments, and keep an eye on all your upcoming deadlines.',
    requiresSidebar: true,
  },
  {
    id: 'influencers',
    targetId: 'tour-nav-influencers',
    title: 'Creator CRM',
    content: 'Manage creator relationships and track their performance data all in one unified CRM.',
    requiresSidebar: true,
  },
  {
    id: 'calendar',
    targetId: 'tour-nav-calendar',
    title: 'Calendar & Deadlines',
    content: 'Never miss payment or campaign deadlines with automated WhatsApp and Email reminders.',
    requiresSidebar: true,
  },
  {
    id: 'final',
    title: "You're ready to use Collabo.",
    content: 'Suggested next actions:',
  }
];

export default function OnboardingTour({ setMobileSidebarOpen, setDesktopSidebarOpen, desktopSidebarOpen }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { openModal } = useCampaignModal();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (!userId || pathname !== '/dashboard') return;
    
    const tourKey = `collabo_tour_completed_${userId}`;
    const tourCompleted = localStorage.getItem(tourKey);
    if (!tourCompleted) {
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [userId, pathname]);

  const updateTargetRect = useCallback(() => {
    const currentStep = TOUR_STEPS[stepIndex];
    if (currentStep.targetId) {
      const isMobile = window.innerWidth < 1024;
      const el = document.getElementById(`${currentStep.targetId}-${isMobile ? 'mobile' : 'desktop'}`) || document.getElementById(currentStep.targetId);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [stepIndex]);

  useEffect(() => {
    if (!run) return;

    const currentStep = TOUR_STEPS[stepIndex];
    
    if (currentStep.requiresSidebar) {
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        setMobileSidebarOpen(true);
      } else if (!desktopSidebarOpen) {
        setDesktopSidebarOpen(true);
      }
    }

    const timer = setTimeout(() => {
      updateTargetRect();
    }, 350);

    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect);
    };
  }, [stepIndex, run, desktopSidebarOpen, setDesktopSidebarOpen, setMobileSidebarOpen, updateTargetRect]);

  const handleFinish = () => {
    if (userId) {
      localStorage.setItem(`collabo_tour_completed_${userId}`, 'true');
    }
    setRun(false);
    setMobileSidebarOpen(false);
  };

  const handleNext = () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  if (!run) return null;

  const currentStep = TOUR_STEPS[stepIndex];
  const isWelcome = stepIndex === 0;
  const isFinal = stepIndex === TOUR_STEPS.length - 1;
  const isTooltip = !isWelcome && !isFinal;

  let tooltipStyle: React.CSSProperties = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  if (isTooltip && targetRect) {
    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      tooltipStyle = {
        top: targetRect.bottom + 16,
        left: Math.max(16, targetRect.left + (targetRect.width / 2) - 175),
      };
    } else {
      tooltipStyle = {
        top: Math.max(16, targetRect.top + (targetRect.height / 2) - 100),
        left: targetRect.right + 24,
      };
    }
  }

  const progressPercentage = (stepIndex / (TOUR_STEPS.length - 1)) * 100;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {!isWelcome && !isFinal && targetRect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}
          >
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className="absolute bg-transparent rounded-xl pointer-events-none"
              style={{
                top: targetRect.top - 8,
                left: targetRect.left - 8,
                width: targetRect.width + 16,
                height: targetRect.height + 16,
                boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.4), inset 0 0 0 1px rgba(255,255,255,0.2)',
                background: 'transparent',
              }}
            />
          </motion.div>
        )}
        
        {(isWelcome || isFinal || !targetRect) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isWelcome && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-white dark:bg-slate-900/90 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl p-8 max-w-md w-full mx-4 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20 text-white">
                <Sparkles className="w-8 h-8" />
              </div>
              
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
                {currentStep.title}
              </h2>
              
              <p className="text-slate-600 dark:text-slate-400 font-medium mb-6 leading-relaxed">
                {currentStep.content}
              </p>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-full border border-emerald-100 dark:border-emerald-500/20 mb-8">
                <Check className="w-3.5 h-3.5" /> 2 minute setup
              </div>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleNext}
                  className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Start Tour <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleFinish}
                  className="w-full bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-semibold py-3 rounded-xl transition-colors"
                >
                  Skip Tour
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {isTooltip && targetRect && (
          <motion.div
            key={`tooltip-${stepIndex}`}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 250, damping: 25 }}
            className="absolute bg-white dark:bg-slate-900/95 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl w-[320px] overflow-hidden"
            style={tooltipStyle}
          >
            <div className="w-full h-1 bg-slate-100 dark:bg-slate-800">
              <motion.div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <div className="p-5 relative">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  {currentStep.title}
                </h3>
                <button
                  onClick={handleFinish}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium mb-5">
                {currentStep.content}
              </p>

              <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                <span className="text-xs font-bold text-slate-400">
                  {stepIndex} of {TOUR_STEPS.length - 1}
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrev}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-md active:scale-95"
                  >
                    Next <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {isFinal && (
          <motion.div
            key="final"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-white dark:bg-slate-900/90 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl p-8 max-w-md w-full mx-4 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
            
            <div className="relative z-10 text-center">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-emerald-500/5">
                <Check className="w-8 h-8" />
              </div>
              
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                {currentStep.title}
              </h2>
              
              <p className="text-slate-500 font-medium mb-6 text-sm">
                {currentStep.content}
              </p>
              
              <div className="space-y-3 mb-8 text-left">
                {[
                  { icon: Plus, title: 'Create your first campaign', desc: 'Add deliverables and influencers manually.' },
                  { icon: MessageSquare, title: 'Connect WhatsApp', desc: 'Forward chats to instantly extract campaign data.' },
                  { icon: LayoutDashboard, title: 'Try AI Extraction', desc: 'Upload a screenshot on the dashboard to test it out.' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <div className="p-2 bg-white dark:bg-slate-700 rounded-lg text-emerald-500 shadow-sm border border-slate-200 dark:border-slate-600">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</p>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    handleFinish();
                    openModal();
                  }}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-emerald-500/25 hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create First Campaign
                </button>
                <button
                  onClick={handleFinish}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold py-3.5 rounded-xl transition-colors"
                >
                  Go To Dashboard
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
