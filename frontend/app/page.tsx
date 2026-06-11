import { redirect } from 'next/navigation';

// Root path redirects straight to dashboard.
// DashboardLayout handles the auth check and will redirect to /login if needed.
export default function Home() {
  redirect('/dashboard');
}
