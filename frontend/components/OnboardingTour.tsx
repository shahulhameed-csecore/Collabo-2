'use client';

import { useState, useEffect } from 'react';
import { Joyride, EventData, STATUS, Step, TooltipRenderProps } from 'react-joyride';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase';

interface OnboardingTourProps {
  isReady?: boolean;
}

export default function OnboardingTour({ isReady = true }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (!isReady || !userId) return;
    
    // Check if user has already completed or skipped the tour
    const tourKey = `collabo_tour_completed_${userId}`;
    const tourCompleted = localStorage.getItem(tourKey);
    if (!tourCompleted) {
      // Delay slightly to ensure DOM elements are fully painted and hydrated
      const timer = setTimeout(() => {
        setRun(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isReady, userId]);

  const handleJoyrideCallback = (data: EventData) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      // Save to localStorage so it doesn't show again
      if (userId) {
        localStorage.setItem(`collabo_tour_completed_${userId}`, 'true');
      }
      setRun(false);
    }
  };

  const steps: Step[] = [
    {
      target: 'body',
      title: 'Welcome to Collabo! 👋',
      content: 'Let\'s take a quick tour to help you manage your micro-influencer campaigns effortlessly.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#new-campaign-header-btn',
      title: 'Create Campaigns',
      content: 'Click here to create a new campaign. Log the details, set deadlines, and start tracking!',
      placement: 'bottom',
    },
    {
      target: '#stat-total',
      title: 'Dashboard Stats',
      content: 'Track your active campaigns, upcoming deadlines, and total spend at a glance.',
      placement: 'bottom',
    },
    {
      target: '#tour-nav-dashboard',
      title: 'Your Dashboard',
      content: 'The central hub for all your ongoing campaigns and quick actions.',
      placement: 'right',
    },
    {
      target: '#tour-nav-calendar',
      title: 'Calendar Overview',
      content: 'Visually track all your deadlines and publishing dates in one place.',
      placement: 'right',
    },
    {
      target: '#tour-nav-influencers',
      title: 'Influencers CRM',
      content: 'Automatically builds a database of all creators you work with.',
      placement: 'right',
    },
    {
      target: '#tour-nav-analytics',
      title: 'Analytics',
      content: 'Measure your ROI, track spending trends, and see which platforms perform best.',
      placement: 'right',
    },
    {
      target: '#tour-nav-settings',
      title: 'Settings',
      content: 'Connect your WhatsApp or Telegram to receive instant AI alerts and reminders.',
      placement: 'right',
    },
    {
      target: '#tour-nav-billing',
      title: 'Billing & Upgrade',
      content: 'Manage your subscription to unlock premium features and unlimited campaigns.',
      placement: 'right',
    },
    {
      target: '#tour-ai-insight',
      title: 'AI Extraction ✨',
      content: 'Just forward a negotiation screenshot to our bot, and we\'ll do the rest! You\'re all set to go.',
      placement: 'top',
    }
  ];

  const bgColor = resolvedTheme === 'dark' ? '#1e293b' : '#ffffff';
  const textColor = resolvedTheme === 'dark' ? '#f1f5f9' : '#0f172a';
  const primaryColor = '#10b981'; // Emerald 500

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleJoyrideCallback}
      tooltipComponent={CustomTooltip}
      floaterProps={{
        disableAnimation: true, // We handle animation in the custom tooltip
      }}
      options={{
        zIndex: 1000,
        arrowColor: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff', // Match slate-900 or white
      }}
    />
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
      {/* Top Accent Line */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
      
      <div className="p-5 sm:p-6 space-y-3.5 relative">
        {/* Glow effect */}
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
            {index > 0 && (
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
              {isLastStep ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
