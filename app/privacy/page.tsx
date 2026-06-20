import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Privacy Policy</h1>
        </div>

        <div className="prose prose-invert prose-emerald max-w-none space-y-8">
          <section>
            <p className="text-sm text-slate-400 mb-6">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p>
              Welcome to Collabo. We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your information when you use our SaaS platform and WhatsApp integration for managing micro-influencer campaigns.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">1. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li><strong>Account Information:</strong> When you sign up, we collect your email address and authentication credentials.</li>
              <li><strong>WhatsApp Information:</strong> If you link your WhatsApp account, we store your phone number to securely identify and route your messages.</li>
              <li><strong>Campaign Data:</strong> We collect the text, images, and voice notes you forward to our WhatsApp Bot or upload to the dashboard.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">2. How We Process Your Data (AI & Third Parties)</h2>
            <p className="mb-4">To provide our core automation features, your data interacts with the following trusted third-party services:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li><strong>Meta (WhatsApp):</strong> Messages sent to our Bot are routed through the official Meta Cloud API.</li>
              <li><strong>Google Gemini AI:</strong> When you forward screenshots, text, or voice notes, we securely pass this media to Google Gemini to automatically extract campaign details (like influencer names, platforms, and deadlines). We do not use your data to train public AI models.</li>
              <li><strong>Supabase:</strong> Your account information and campaign data are securely stored in our cloud database hosted by Supabase.</li>
              <li><strong>Resend:</strong> We use Resend to send you automated email reminders for campaign deadlines.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">3. How We Use Your Information</h2>
            <p className="mb-2">We use the collected information strictly to:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Provide, maintain, and improve the Collabo platform.</li>
              <li>Process your WhatsApp messages into structured campaign drafts.</li>
              <li>Send you automated reminders for upcoming or overdue campaigns.</li>
              <li>Prevent fraud, abuse, and ensure security.</li>
            </ul>
            <p className="mt-4 font-semibold text-emerald-400">We will never sell your personal data or campaign insights to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">4. Data Security & Retention</h2>
            <p>
              We implement industry-standard security measures, including Row-Level Security (RLS) in our database, to ensure your campaign data is isolated and only accessible by you. We retain your data only for as long as your account is active. You may request account deletion at any time, which will permanently wipe your data from our servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">5. Your Rights</h2>
            <p>
              Depending on your location, you have the right to access, correct, or delete your personal data. If you wish to exercise these rights, or if you want to unlink your WhatsApp number, you can do so directly from your Collabo Settings dashboard or by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">6. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us at <a href="mailto:privacy@collabo.app" className="text-emerald-400 hover:underline">privacy@collabo.app</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
