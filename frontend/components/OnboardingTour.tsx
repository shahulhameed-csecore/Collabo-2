'use client';

import { useState, useEffect } from 'react';
import { Joyride, EventData, STATUS, Step } from 'react-joyride';
import { useTheme } from 'next-themes';

interface OnboardingTourProps {
  isReady?: boolean;
}

export default function OnboardingTour({ isReady = true }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!isReady) return;
    
    // Check if user has already completed or skipped the tour
    const tourCompleted = localStorage.getItem('collabo_tour_completed');
    if (!tourCompleted) {
      // Delay slightly to ensure DOM elements are fully painted and hydrated
      const timer = setTimeout(() => {
        setRun(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  const handleJoyrideCallback = (data: EventData) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      // Save to localStorage so it doesn't show again
      localStorage.setItem('collabo_tour_completed', 'true');
      setRun(false);
    }
  };

  const steps: Step[] = [
    {
      target: 'body',
      content: 'Welcome to Collabo! Let\'s take a quick tour to help you manage your micro-influencer campaigns effortlessly.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#new-campaign-header-btn',
      content: 'Click here to create a new campaign. Log the details, set deadlines, and start tracking!',
      placement: 'bottom',
    },
    {
      target: '#stat-total',
      content: 'Dashboard Stats: Track your active campaigns, upcoming deadlines, and total spend at a glance.',
      placement: 'bottom',
    },
    {
      target: '#tour-nav-dashboard',
      content: 'Your Dashboard: The central hub for all your ongoing campaigns and quick actions.',
      placement: 'right',
    },
    {
      target: '#tour-nav-calendar',
      content: 'Calendar Overview: Visually track all your deadlines and publishing dates in one place.',
      placement: 'right',
    },
    {
      target: '#tour-nav-influencers',
      content: 'Influencers CRM: Automatically builds a database of all creators you work with.',
      placement: 'right',
    },
    {
      target: '#tour-nav-analytics',
      content: 'Analytics: Measure your ROI, track spending trends, and see which platforms perform best.',
      placement: 'right',
    },
    {
      target: '#tour-nav-settings',
      content: 'Settings: Connect your WhatsApp or Telegram to receive instant AI alerts and reminders.',
      placement: 'right',
    },
    {
      target: '#tour-nav-billing',
      content: 'Billing & Upgrade: Manage your subscription to unlock premium features and unlimited campaigns.',
      placement: 'right',
    },
    {
      target: '#tour-ai-insight',
      content: 'AI Extraction: Just forward a negotiation screenshot to our bot, and we\'ll do the rest! You\'re all set to go.',
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
      options={{
        arrowColor: bgColor,
        backgroundColor: bgColor,
        overlayColor: 'rgba(0, 0, 0, 0.6)',
        primaryColor: primaryColor,
        textColor: textColor,
        zIndex: 1000,
        showProgress: true,
        buttons: ['back', 'close', 'primary', 'skip'],
      }}
      styles={{
        buttonClose: {
          display: 'none',
        },
        buttonSkip: {
          color: resolvedTheme === 'dark' ? '#94a3b8' : '#64748b',
          fontSize: '14px',
        },
        buttonPrimary: {
          backgroundColor: primaryColor,
          borderRadius: '8px',
          padding: '8px 16px',
        },
        buttonBack: {
          color: resolvedTheme === 'dark' ? '#94a3b8' : '#64748b',
          marginRight: '8px',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        tooltipTitle: {
          fontWeight: 'bold',
          marginBottom: '8px',
        }
      }}
    />
  );
}
