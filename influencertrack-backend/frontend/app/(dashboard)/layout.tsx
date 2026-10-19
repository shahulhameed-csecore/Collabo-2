import DashboardLayout from '@/components/DashboardLayout';
import AutoLogoutProvider from '@/components/providers/AutoLogoutProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AutoLogoutProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </AutoLogoutProvider>
  );
}
