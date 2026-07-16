'use client';

import { useState, useEffect } from 'react';
import { Joyride, STATUS, Step, TooltipRenderProps, EVENTS, ACTIONS } from 'react-joyride';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import { ArrowRight, ArrowLeft, Check, Sparkles, X } from 'lucide-react';

interface OnboardingTourProps {
  setMobileSidebarOpen: (open: boolean) => void;
  setDesktopSidebarOpen: (open: boolean) => void;
  desktopSidebarOpen: boolean;
}

interface CustomStep extends Step {
  requiresSidebar?: boolean;
}

export default function OnboardingTour({ setMobileSidebarOpen, setDesktopSidebarOpen, desktopSidebarOpen }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();

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
    
    // Do not run the onboarding tour on mobile devices
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return;
    }
    
    // Check if user has already completed or skipped the tour
    const tourKey = `collabo_tour_completed_${userId}`;
    const tourCompleted = localStorage.getItem(tourKey);
    if (!tourCompleted) {
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [userId, pathname]);

  const getTarget = (baseId: string) => {
    if (typeof window === 'undefined') return 'body';
    return window.innerWidth < 1024 ? `#${baseId}-mobile` : `#${baseId}-desktop`;
  };

  const steps: CustomStep[] = [
    {
      target: 'body',
      title: 'Welcome to Collabo! 👋',
      content: 'Let\'s take a quick tour to see how you can save hours every week managing your influencer campaigns.',
      placement: 'center',
    },
    {
      target: getTarget('tour-new-campaign-sidebar'),
      title: '1. Launch a Campaign',
      content: 'Start here. You can manually enter campaign details like influencer handles, deliverables, and deadlines.',
      placement: 'right',
      requiresSidebar: true,
    },
    {
      target: getTarget('tour-ai-insight'),
      title: '2. Auto-fill with AI ✨',
      content: 'Skip manual entry! Forward a WhatsApp or Telegram DM to our bot, and we\'ll extract all the details for you instantly.',
      placement: 'right',
      requiresSidebar: true,
    },
    {
      target: getTarget('tour-nav-calendar'),
      title: '3. Automated Reminders',
      content: 'We visually map your deadlines and send you automated reminders so you never miss a post or a payment.',
      placement: 'right',
      requiresSidebar: true,
    },
    {
      target: getTarget('tour-nav-influencers'),
      title: '4. Creator CRM',
      content: 'Every creator you work with is automatically added to your built-in CRM for easy future collaborations.',
      placement: 'right',
      requiresSidebar: true,
    },
    {
      target: getTarget('tour-nav-dashboardanalytics'),
      title: '5. Measure Success',
      content: 'Track your spending, ROI, and see which platforms and campaigns perform best in real-time.',
      placement: 'right',
      requiresSidebar: true,
    },
    {
      target: getTarget('tour-nav-settings'),
      title: '6. Magic Links',
      content: 'Set up your profile here. We use "Magic Links" so creators can securely upload content directly to Collabo for your approval.',
      placement: 'right',
      requiresSidebar: true,
    },
    {
      target: getTarget('tour-nav-billing'),
      title: '7. Unlock Premium',
      content: 'Ready to scale? Upgrade your plan to unlock unlimited campaigns, advanced AI features, and priority support.',
      placement: 'right',
      requiresSidebar: true,
    }
  ];

  const handleJoyrideCallback = (data: any) => {
    const { action, index, status, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      if (userId) {
        localStorage.setItem(`collabo_tour_completed_${userId}`, 'true');
      }
      setRun(false);
      setMobileSidebarOpen(false);
      return;
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const newIndex = action === ACTIONS.PREV ? index - 1 : index + 1;
      
      if (newIndex >= steps.length || newIndex < 0) {
        setRun(false);
        setMobileSidebarOpen(false);
        return;
      }

      if (type === EVENTS.TARGET_NOT_FOUND && action !== ACTIONS.PREV) {
        // We do not return here so that the sidebar logic below can execute
        // for the new skipped step, preventing a cascading failure of missing targets.
      }

      const nextStep = steps[newIndex];
      const isMobile = window.innerWidth < 1024;
      
      if (nextStep.requiresSidebar) {
        if (isMobile) {
          setMobileSidebarOpen(true);
          setIsWaiting(true);
          setTimeout(() => {
            setStepIndex(newIndex);
            setIsWaiting(false);
          }, 300);
        } else if (!desktopSidebarOpen) {
          setDesktopSidebarOpen(true);
          setIsWaiting(true);
          setTimeout(() => {
            setStepIndex(newIndex);
            setIsWaiting(false);
          }, 300);
        } else {
          setStepIndex(newIndex);
        }
      } else {
        if (isMobile && !nextStep.requiresSidebar) {
          setMobileSidebarOpen(false);
        }
        setStepIndex(newIndex);
      }
    }
  };


  return (
    <>
      {!isWaiting && (
        <Joyride
          steps={steps}
          run={run}
          stepIndex={stepIndex}
          continuous
          scrollToFirstStep
          // @ts-ignore
          callback={handleJoyrideCallback}
          tooltipComponent={CustomTooltip}
          styles={{
            options: {
              zIndex: 10000,
              arrowColor: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff',
              primaryColor: '#10b981',
            },
          } as any}
        />
      )}
    </>
  );
}

// ─── Custom Tooltip Component ───
const CustomTooltip = ({
  index,
  step,
  backProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
  size,
}: TooltipRenderProps) => {
  return (
    <div
      {...tooltipProps}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl w-full max-w-[350px] overflow-hidden animate-in zoom-in-95 fade-in duration-300 ease-out"
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />
      
      <div className="p-5 relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        
        {/* Header */}
        <div className="flex items-start justify-between mb-3 relative z-10">
          {step.title && (
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              {index === 0 && <Sparkles className="w-4 h-4 text-emerald-500" />}
              {step.title}
            </h3>
          )}
          <button
            {...skipProps}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
            aria-label="Skip tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Content */}
        <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium mb-5 relative z-10">
          {step.content}
        </p>

        {/* Progress & Actions */}
        <div className="flex items-center justify-between pt-1 relative z-10">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: size }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index
                    ? 'w-4 bg-emerald-500'
                    : i < index
                    ? 'w-1.5 bg-emerald-500/40'
                    : 'w-1.5 bg-slate-200 dark:bg-slate-800'
                }`}
              />
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                {...backProps}
                className="flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <button
              {...primaryProps}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13px] font-bold px-4 py-2 rounded-xl transition-all shadow-md hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95"
            >
              {isLastStep ? 'Get Started' : 'Next'}
              {isLastStep ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

