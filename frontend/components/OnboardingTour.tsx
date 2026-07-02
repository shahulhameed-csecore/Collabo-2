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

    {
      target: 'body',
      content: 'Welcome to Collabo! Let\'s take a quick tour to help you manage your micro-influencer campaigns effortlessly.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#new-campaign-header-btn',
      content: 'Click here to create a new campaign. Log the details to start tracking!',
      placement: 'bottom',
    },
    {
      target: '#stat-total',
      content: 'Dashboard Stats: Track your active campaigns, upcoming deadlines, and total spend at a glance.',
      placement: 'bottom',
    },
    {
      target: '#tour-ai-insight',
      content: 'AI Extraction: Forward your negotiation screenshots to our WhatsApp bot, and we\'ll instantly extract the details for you!',
      placement: 'right',
    },
    {
      target: '#tour-nav-settings',
      content: 'Sidebar Navigation: Access your calendar, influencer CRM, and settings. Don\'t forget to connect your WhatsApp!',
      placement: 'right',
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
