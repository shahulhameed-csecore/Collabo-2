import { redirect } from 'next/navigation';

/**
 * /signup route — redirect to the unified login/signup page.
 * The login page handles both login and new account creation via magic link.
 */
export default function SignupPage() {
  redirect('/login');
}
