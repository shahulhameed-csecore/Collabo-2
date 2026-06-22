'use client';

import { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useTheme } from 'next-themes';

export default function OnboardingTour() {
  const [run, setRun] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // Check if user has already completed or skipped the tour
    const tourCompleted = localStorage.getItem('collabo_tour_completed');
    if (!tourCompleted) {
      setRun(true);
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
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
      content: 'Click here to create a new campaign. You can upload WhatsApp screenshots and our AI will extract all the details for you!',
      placement: 'bottom',
    },
    {
      target: '#tour-csv-export',
      content: 'Export your filtered campaigns into a clean CSV file with a single click.',
      placement: 'bottom',
    },
    {
      target: '#tour-ai-insight',
      content: 'Collabo uses Gemini AI to auto-fill deliverables, deadlines, and payments from screenshots or voice notes.',
      placement: 'right',
    },
    {
      target: '#tour-nav-settings',
      content: 'Make sure to visit Settings to link your WhatsApp number so the Collabo Assistant can receive your forwarded DMs.',
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
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          arrowColor: bgColor,
          backgroundColor: bgColor,
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          primaryColor: primaryColor,
          textColor: textColor,
          zIndex: 1000,
        },
        buttonClose: {
          display: 'none',
        },
        buttonSkip: {
          color: resolvedTheme === 'dark' ? '#94a3b8' : '#64748b',
          fontSize: '14px',
        },
        buttonNext: {
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
