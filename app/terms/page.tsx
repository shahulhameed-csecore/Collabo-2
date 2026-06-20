import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsOfServicePage() {
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
            <FileText className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Terms of Service</h1>
        </div>

        <div className="prose prose-invert prose-emerald max-w-none space-y-8">
          <section>
            <p className="text-sm text-slate-400 mb-6">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p>
              Welcome to Collabo! By accessing or using our platform, WhatsApp bot, and services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">1. Description of Service</h2>
            <p>
              Collabo is a SaaS platform designed to help users manage micro-influencer campaigns. We provide a web dashboard and a WhatsApp Business integration that allows you to forward negotiation chats, voice notes, and images to our automated Bot. Our system processes these inputs to draft campaign records for your approval.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">2. AI Processing Disclaimer</h2>
            <p>
              Our platform utilizes Artificial Intelligence (specifically Google Gemini) to parse and extract information from the media and text you forward to our WhatsApp Bot. While we strive for high accuracy, <strong>AI-generated drafts may contain errors, omissions, or misinterpretations</strong>. 
            </p>
            <p className="mt-2 text-amber-400 font-semibold">
              You acknowledge that it is your sole responsibility to review, verify, and edit all AI-generated campaign drafts in your Collabo Dashboard before relying on them for business decisions or payments.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">3. Acceptable Use Policy</h2>
            <p className="mb-2">When using Collabo, specifically our WhatsApp integration, you agree NOT to:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Spam, harass, or abuse our WhatsApp Bot.</li>
              <li>Attempt to reverse-engineer our systems or bypass rate limits.</li>
              <li>Forward illegal, explicit, or highly sensitive personal data (e.g., SSNs, credit card numbers) to the Bot.</li>
              <li>Use the service for anything other than influencer campaign management.</li>
            </ul>
            <p className="mt-2 text-sm text-slate-400">Violation of these rules may result in immediate suspension or termination of your account and linked WhatsApp access.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">4. User Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must ensure that the WhatsApp number you link to your Collabo account is legally yours or you have authorized access to it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">5. Limitation of Liability</h2>
            <p>
              Collabo is provided "AS IS" and "AS AVAILABLE". To the maximum extent permitted by law, Collabo shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use or inability to use the service, including but not limited to lost profits, lost data, or business interruptions caused by AI inaccuracies or third-party service downtime (e.g., WhatsApp outages).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">6. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of significant changes via email or an in-app notice. Continued use of the platform after changes constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">7. Contact Us</h2>
            <p>
              For legal inquiries, support, or questions regarding these Terms, please contact us at <a href="mailto:support@collabo.app" className="text-emerald-400 hover:underline">support@collabo.app</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
