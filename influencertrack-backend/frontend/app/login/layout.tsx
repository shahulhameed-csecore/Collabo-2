import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In — Collabo | AI Influencer CRM',
  description: 'Sign in to your Collabo workspace to automate your creator campaigns, payments, and deliverables.',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
