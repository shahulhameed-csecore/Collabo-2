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
        <p className="mb-4">Manage influencer campaigns in minutes, not spreadsheets.</p>
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
        <p className="mb-3">Start your influencer campaign with just a few clicks.</p>
        <p className="mb-2">Add:</p>
        <ul className="list-disc pl-4 mb-3 space-y-1">
          <li>Deliverables</li>
          <li>Payments</li>
          <li>Deadlines</li>
          <li>Creators</li>
        </ul>
        <p>Everything stays organized from day one.</p>
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
        <p className="mb-3">Forward a WhatsApp chat, screenshot or campaign brief.</p>
        <p className="mb-2">Collabo automatically extracts:</p>
        <ul className="list-disc pl-4 mb-3 space-y-1">
          <li>Deliverables</li>
          <li>Deadlines</li>
          <li>Payment details</li>
          <li>Creator information</li>
        </ul>
        <p className="font-semibold text-emerald-600 dark:text-emerald-400">Save up to 20 minutes on every campaign.</p>
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
        <p className="mb-3">Track every campaign in real time.</p>
        <p className="mb-2">Monitor:</p>
        <ul className="list-disc pl-4 mb-3 space-y-1">
          <li>Pending campaigns</li>
          <li>Active campaigns</li>
          <li>Payments</li>
          <li>Deliverables</li>
        </ul>
        <p>Stay updated without opening multiple tools.</p>
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
        <p className="mb-3">Stay on top of campaign schedules and payment due dates.</p>
        <p>Collabo keeps everything organized automatically.</p>
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
        <p className="mb-3">Manage all your creators in one place.</p>
        <p className="mb-2">Track:</p>
        <ul className="list-disc pl-4 mb-3 space-y-1">
          <li>Creator details</li>
          <li>Campaign history</li>
          <li>Performance</li>
        </ul>
        <p>No more spreadsheets or scattered notes.</p>
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
        <p className="mb-4">Collabo helps brands go from receiving a creator's message to managing an entire influencer campaign in seconds.</p>
        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Recommended next steps:</p>
        <ul className="list-none space-y-2 mb-4">
          <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Check className="w-3.5 h-3.5 text-emerald-500" /> Create your first campaign
          </li>
          <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Check className="w-3.5 h-3.5 text-emerald-500" /> Try AI Extraction
          </li>
          <li className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Check className="w-3.5 h-3.5 text-emerald-500" /> Connect WhatsApp
          </li>
        </ul>
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
            className="relative bg-white dark:bg-slate-900/95 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-6 max-w-[380px] w-full mx-4 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
            
            <div className="relative z-10 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20 text-white">
                <currentStep.icon className="w-6 h-6" />
              </div>
              
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                {currentStep.title}
              </h2>
              
              <div className="text-[13px] text-slate-600 dark:text-slate-400 font-medium mb-6 leading-relaxed">
                {currentStep.content}
              </div>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleNext}
                  className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center text-sm"
                >
                  Start Tour
                </button>
                <button
                  onClick={handleFinish}
                  className="w-full bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-semibold py-2.5 rounded-xl transition-colors text-sm"
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
            className="absolute bg-white dark:bg-slate-900/95 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl w-[350px] overflow-hidden"
            style={tooltipStyle}
          >
            <div className="p-5">
              <div className="mb-4">
                <p className="text-[11px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-1">
                  Step {stepIndex} of {TOUR_STEPS.length - 1}
                </p>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
                  <currentStep.icon className="w-4 h-4 text-slate-900 dark:text-white" />
                  {currentStep.title}
                </h3>
              </div>
              
              <div className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium mb-6">
                {currentStep.content}
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={handleFinish}
                  className="text-[13px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  Skip Tour
                </button>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrev}
                    className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13px] font-bold px-3.5 py-1.5 rounded-lg transition-all shadow-sm active:scale-95"
                  >
                    Next <ArrowRight className="w-3.5 h-3.5" />
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
            className="relative bg-white dark:bg-slate-900/95 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-6 max-w-[380px] w-full mx-4 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
            
            <div className="relative z-10 text-center">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-5 shadow-inner border border-emerald-500/20">
                <currentStep.icon className="w-6 h-6" />
              </div>
              
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                {currentStep.title}
              </h2>
              
              <div className="text-[13px] text-slate-600 dark:text-slate-400 font-medium mb-6 text-left leading-relaxed">
                {currentStep.content}
              </div>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    handleFinish();
                    openModal();
                  }}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-2.5 rounded-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center text-sm"
                >
                  Create Campaign
                </button>
                <button
                  onClick={handleFinish}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold py-2.5 rounded-xl transition-colors text-sm"
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
