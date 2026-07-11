'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Joyride, EventData, STATUS, Step, TooltipRenderProps, ACTIONS, EVENTS } from 'react-joyride';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

export interface TourStep extends Step {
  requiresSidebar?: boolean;
  route?: string;
  delayBefore?: number;
}

interface GuidedTourContextType {
  isActive: boolean;
  startTour: () => void;
  stopTour: () => void;
  isSidebarForcedOpen: boolean;
}

const GuidedTourContext = createContext<GuidedTourContextType>({
  isActive: false,
  startTour: () => {},
  stopTour: () => {},
  isSidebarForcedOpen: false,
});

export const useGuidedTour = () => useContext(GuidedTourContext);

export function GuidedTourProvider({ children }: { children: ReactNode }) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSidebarForcedOpen, setIsSidebarForcedOpen] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setRun(true);
    setIsSidebarForcedOpen(false);
    if (pathname !== '/dashboard') {
      router.push('/dashboard');
    }
  }, [pathname, router]);

  const stopTour = useCallback(() => {
    setRun(false);
    setIsSidebarForcedOpen(false);
    if (userId) {
      localStorage.setItem(`collabo_tour_completed_${userId}`, 'true');
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const tourKey = `collabo_tour_completed_${userId}`;
    const tourCompleted = localStorage.getItem(tourKey);
    // Auto-start for new users if on dashboard
    if (!tourCompleted && pathname === '/dashboard') {
      const timer = setTimeout(() => {
        startTour();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [userId, pathname, startTour]);

  const steps: TourStep[] = [
    {
      target: 'body',
      title: 'Welcome to Collabo! 👋',
      content: "Let's organize your influencer campaigns, keep deadlines visible, and avoid missed follow-ups.",
      placement: 'center',
      disableBeacon: true,
      hideBackButton: true,
    },
    {
      target: '#load-sample-data-btn',
      title: 'See it in action',
      content: "The best way to learn is by seeing real data. Click 'Load Sample Data' to populate your dashboard with example campaigns. (If you don't see this, you already have data!)",
      placement: 'bottom',
      disableBeacon: true,
      delayBefore: 500,
    },
    {
      target: '#stat-total',
      title: 'Your command center',
      content: 'Now that we have data, you can track active campaigns, upcoming deadlines, and total spend at a glance.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour-target="copy-link-btn"]',
      title: 'Effortless content collection',
      content: 'Share this unique link with the creator. They can use it to securely upload their final posts or videos directly to Collabo.',
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour-target="approve-reject-actions"]',
      title: 'Content received!',
      content: 'When a creator uploads proof, the status updates to "Content Received". You can then review the link and quickly Approve or Reject it right here.',
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour-target="nav-influencers"]',
      title: 'Built-in creator database',
      content: 'Collabo automatically builds a CRM of every creator you work with, tracking their total deliverables and spend over time.',
      placement: 'right',
      disableBeacon: true,
      requiresSidebar: true,
    },
    {
      target: '[data-tour-target="nav-analytics"]',
      title: 'Measure success',
      content: 'Use Analytics to measure your return on investment, track spending trends, and see which platforms perform best.',
      placement: 'right',
      disableBeacon: true,
      requiresSidebar: true,
    },
    {
      target: '[data-tour-target="nav-calendar"]',
      title: 'Visual deadlines',
      content: 'Use the Calendar view to see all publishing dates in one place.',
      placement: 'right',
      disableBeacon: true,
      requiresSidebar: true,
    },
    {
      target: '[data-tour-target="nav-settings"]',
      title: 'Automate your workflow',
      content: 'Head to Settings to connect WhatsApp or Telegram, configure your notifications, and replay this tour anytime.',
      placement: 'right',
      disableBeacon: true,
      requiresSidebar: true,
    },
    {
      target: '[data-tour-target="ai-insight"]',
      title: 'Auto-fill with AI ✨',
      content: "Skip manual data entry! Just forward a DM screenshot to our bot and we'll fill in the details for you.",
      placement: 'right',
      disableBeacon: true,
      requiresSidebar: true,
    }
  ];

  const handleJoyrideCallback = (data: EventData) => {
    const { action, index, status, type } = data;

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      stopTour();
      return;
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      // Logic for handling next/prev steps
      const newIndex = action === ACTIONS.PREV ? index - 1 : index + 1;
      
      // If we go beyond bounds
      if (newIndex >= steps.length || newIndex < 0) {
        stopTour();
        return;
      }

      // Handle missing targets gracefully by skipping to the next available one
      if (type === EVENTS.TARGET_NOT_FOUND && action !== ACTIONS.PREV) {
        console.warn(`Tour target not found for step ${index}, skipping...`);
        setStepIndex(newIndex);
        return;
      }

      const nextStep = steps[newIndex];
      
      if (nextStep.requiresSidebar) {
        setIsSidebarForcedOpen(true);
      } else {
        setIsSidebarForcedOpen(false);
      }

      setIsWaiting(true);
      setStepIndex(newIndex);
      
      setTimeout(() => {
        setIsWaiting(false);
      }, nextStep.delayBefore || 400);
    }
  };

  const bgColor = resolvedTheme === 'dark' ? '#1e293b' : '#ffffff';

  return (
    <GuidedTourContext.Provider value={{ isActive: run, startTour, stopTour, isSidebarForcedOpen }}>
      {children}
      {!isWaiting && (
        <Joyride
          steps={steps}
          run={run}
          stepIndex={stepIndex}
          continuous
          scrollToFirstStep
          showProgress
          showSkipButton
          disableOverlayClose
          disableCloseOnEsc
          onEvent={handleJoyrideCallback}
          tooltipComponent={CustomTooltip}
          floaterProps={{ disableAnimation: true }}
          options={{
            zIndex: 10000,
            arrowColor: bgColor,
            primaryColor: '#10b981',
          }}
        />
      )}
    </GuidedTourContext.Provider>
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
}: TooltipRenderProps) => {
  return (
    <div
      {...tooltipProps}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-2xl rounded-3xl w-full max-w-[340px] overflow-hidden animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-500 ease-out"
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
      
      <div className="p-5 sm:p-6 space-y-3.5 relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        
        {step.title && (
          <h3 className="text-[17px] font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            {step.title}
          </h3>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
          {step.content}
        </p>

        <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 mt-4">
          {!isLastStep ? (
            <button
              {...skipProps}
              className="text-[13px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              Skip
            </button>
          ) : <div />}
          
          <div className="flex items-center gap-2">
            {index > 0 && !step.hideBackButton && (
              <button
                {...backProps}
                className="text-[13px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3 py-2 rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Back
              </button>
            )}
            <button
              {...primaryProps}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13px] font-bold px-4 py-2 rounded-xl transition-all shadow-md hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95"
            >
              {isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
