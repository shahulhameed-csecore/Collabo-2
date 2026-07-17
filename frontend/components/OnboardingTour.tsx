'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { 
  Sparkles, ArrowRight, Check, Plus, MessageSquare, LayoutDashboard, 
  Rocket, BarChart2, Calendar, Users, PartyPopper 
} from 'lucide-react';
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
  content: React.ReactNode;
  icon: React.ElementType;
  requiresSidebar?: boolean;
};

const TOUR_STEPS: StepConfig[] = [
  {
    id: 'welcome',
    title: 'Welcome to Collabo',
    icon: Rocket,
    content: (
      <>
        <p className="mb-2">Manage influencer campaigns in minutes, not spreadsheets.</p>
        <p>Let's take a quick 45-second tour.</p>
      </>
    ),
  },
  {
    id: 'create-campaign',
    targetId: 'tour-new-campaign-sidebar',
    title: 'Create Campaigns',
    icon: Rocket,
    content: (
      <>
        <p className="mb-2">Launch your influencer campaigns with just a few clicks.</p>
        <p>Deliverables, creators, and payments stay perfectly organized from day one.</p>
      </>
    ),
    requiresSidebar: true,
  },
  {
    id: 'ai-extraction',
    targetId: 'tour-ai-insight',
    title: 'AI Campaign Extraction',
    icon: Sparkles,
    content: (
      <>
        <p className="mb-2">Forward a WhatsApp chat or screenshot, and we instantly extract all campaign details.</p>
        <p className="font-semibold text-emerald-600 dark:text-emerald-400">Save 20 minutes on every campaign.</p>
      </>
    ),
    requiresSidebar: true,
  },
  {
    id: 'dashboard',
    targetId: 'tour-nav-dashboard',
    title: 'Campaign Tracking',
    icon: BarChart2,
    content: (
      <>
        <p className="mb-2">Track active campaigns, deliverables, and payments in real time.</p>
        <p>Stay entirely updated without ever opening another spreadsheet.</p>
      </>
    ),
    requiresSidebar: true,
  },
  {
    id: 'calendar',
    targetId: 'tour-nav-calendar',
    title: 'Never Miss Deadlines',
    icon: Calendar,
    content: (
      <>
        <p className="mb-2">Stay effortlessly on top of all schedules and payment due dates.</p>
        <p>Never miss a deadline again with our automated reminders.</p>
      </>
    ),
    requiresSidebar: true,
  },
  {
    id: 'influencers',
    targetId: 'tour-nav-influencers',
    title: 'Creator Management',
    icon: Users,
    content: (
      <>
        <p className="mb-2">Manage all creator relationships, campaign history, and performance data natively.</p>
        <p>Replace scattered notes with a unified Creator CRM.</p>
      </>
    ),
    requiresSidebar: true,
  },
  {
    id: 'final',
    title: "You're All Set!",
    icon: PartyPopper,
    content: (
      <>
        <p className="mb-3">Go from a creator's message to an entire campaign in seconds.</p>
        <p className="mb-3">We recommend connecting WhatsApp and trying AI Extraction first.</p>
        <p className="font-semibold text-emerald-600 dark:text-emerald-400">Let's build your first campaign.</p>
      </>
    ),
  }
];

export default function OnboardingTour({ setMobileSidebarOpen, setDesktopSidebarOpen, desktopSidebarOpen }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const pathname = usePathname();
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
      const checkInterval = setInterval(() => {
        const desktopEl = document.getElementById('tour-new-campaign-sidebar-desktop');
        const mobileEl = document.getElementById('tour-new-campaign-sidebar-mobile');
        if (desktopEl || mobileEl) {
          clearInterval(checkInterval);
          setRun(true);
        }
      }, 200);
      return () => clearInterval(checkInterval);
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
        left: Math.max(16, targetRect.left + (targetRect.width / 2) - 170),
      };
    } else {
      tooltipStyle = {
        top: Math.max(16, targetRect.top + (targetRect.height / 2) - 80),
        left: targetRect.right + 24,
      };
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {!isWelcome && !isFinal && targetRect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}
          >
            <motion.div
              layout
              transition={{ duration: 0.2, ease: "easeOut" }}
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
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isWelcome && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, scale: 0.98, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 5 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative bg-white dark:bg-slate-900/95 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-5 max-w-[340px] max-h-[280px] w-full mx-4 flex flex-col overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
            
            <div className="relative z-10 flex flex-col h-full text-center">
              <div>
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20 text-white">
                  <currentStep.icon className="w-5 h-5" />
                </div>
                
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                  {currentStep.title}
                </h2>
                
                <div className="text-[13px] text-slate-600 dark:text-slate-400 font-medium mb-4 leading-relaxed">
                  {currentStep.content}
                </div>
              </div>
              
              <div className="flex flex-col gap-2 mt-auto">
                <button
                  onClick={handleNext}
                  className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-2 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center text-xs"
                >
                  Start Tour
                </button>
                <button
                  onClick={handleFinish}
                  className="w-full bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-semibold py-2 rounded-xl transition-colors text-xs"
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
            initial={{ opacity: 0, scale: 0.98, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 5 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bg-white dark:bg-slate-900/95 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl w-[320px] max-w-[340px] max-h-[280px] flex flex-col overflow-hidden"
            style={tooltipStyle}
          >
            <div className="p-4 flex flex-col h-full">
              <div>
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-1">
                    Step {stepIndex} of {TOUR_STEPS.length - 1}
                  </p>
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-[15px]">
                    <currentStep.icon className="w-4 h-4 text-slate-900 dark:text-white" />
                    {currentStep.title}
                  </h3>
                </div>
                
                <div className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium mb-3">
                  {currentStep.content}
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto pt-2">
                <button
                  onClick={handleFinish}
                  className="text-[12px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  Skip Tour
                </button>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handlePrev}
                    className="text-[12px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white px-2 py-1.5 rounded-lg transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[12px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95"
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
            initial={{ opacity: 0, scale: 0.98, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 5 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative bg-white dark:bg-slate-900/95 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-5 max-w-[340px] w-full mx-4 flex flex-col overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
            
            <div className="relative z-10 flex flex-col h-full text-center">
              <div>
                <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-inner border border-emerald-500/20">
                  <currentStep.icon className="w-5 h-5" />
                </div>
                
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                  {currentStep.title}
                </h2>
                
                <div className="text-[13px] text-slate-600 dark:text-slate-400 font-medium mb-4 text-center leading-relaxed">
                  {currentStep.content}
                </div>
              </div>
              
              <div className="flex flex-col gap-2 mt-auto">
                <button
                  onClick={() => {
                    handleFinish();
                    openModal();
                  }}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-2 rounded-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center text-xs"
                >
                  Create Campaign
                </button>
                <button
                  onClick={handleFinish}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold py-2 rounded-xl transition-colors text-xs"
                >
                  Explore Dashboard
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
