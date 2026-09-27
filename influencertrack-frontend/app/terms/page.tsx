'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden">
      
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo variant="full" size={32} href="/" />
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl">
          <h1 className="text-4xl font-extrabold text-white mb-4">Terms and Conditions</h1>
          <p className="text-slate-400 mb-12"><strong>Last Updated:</strong> June 2026</p>

          <div className="space-y-10 text-slate-300 leading-relaxed">
            <section>
              <p>
                Welcome to <strong>Collabo</strong> (mycollabo.online). These Terms and Conditions ("Terms") govern your access to and use of the Collabo SaaS platform, WhatsApp Bot, and related services (collectively, the "Services").
              </p>
              <p className="mt-4">
                By registering for an account or using our Services, you agree to be bound by these Terms. If you do not agree, do not use the Services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Description of Service</h2>
              <p className="mb-4">Collabo is a micro-influencer campaign management SaaS designed for D2C brands. Our features include:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>AI-driven extraction of campaign briefs via WhatsApp, images, and voice notes.</li>
                <li>Automated deadline reminders via Email and WhatsApp.</li>
                <li>Influencer CRM and Campaign tracking workflows.</li>
                <li>Tracking links with click analytics.</li>
                <li>Magic links for influencer proof-of-posting uploads.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Account Registration and Responsibilities</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li><strong>Eligibility:</strong> You must be at least 18 years old and capable of forming a binding contract to use Collabo.</li>
                <li><strong>Account Security:</strong> You are responsible for safeguarding your login credentials. You must immediately notify us of any unauthorized use of your account.</li>
                <li><strong>Accurate Information:</strong> You agree to provide accurate and complete information during registration and keep it updated.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Acceptable Use and Restrictions</h2>
              <p className="mb-4">You agree <strong>not</strong> to use the Services to:</p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Violate any local, state, national, or international law, including privacy laws and advertising regulations (e.g., ASCI guidelines in India, FTC in the US).</li>
                <li>Upload, share, or transmit any malicious code, viruses, or illegal content.</li>
                <li>Abuse the WhatsApp integration by sending spam, harassing influencers, or attempting to extract data that does not belong to you.</li>
                <li>Attempt to bypass, exploit, or reverse-engineer our security measures, rate limits, or AI extraction endpoints.</li>
                <li>Use the tracking links to distribute malware, phishing campaigns, or engage in any form of malicious redirection.</li>
              </ol>
              <p className="mt-4 text-emerald-400 italic">
                *We reserve the right to suspend or terminate accounts that violate these restrictions without prior notice.*
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. User Content and Intellectual Property</h2>
              
              <h3 className="text-xl font-semibold text-emerald-400 mb-2 mt-6">4.1 Your Content</h3>
              <p>You retain all ownership rights to the data you upload to Collabo, including campaign briefs, influencer lists, and uploaded proofs ("User Content"). By uploading User Content, you grant us a non-exclusive, worldwide, royalty-free license to host, process, and display this data solely for the purpose of providing the Services to you.</p>

              <h3 className="text-xl font-semibold text-emerald-400 mb-2 mt-6">4.2 Collabo's Intellectual Property</h3>
              <p>The Services, including the software, UI/UX, logos, and underlying AI extraction logic, are the exclusive property of Collabo and its licensors. You may not copy, modify, or distribute our intellectual property without express written consent.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Third-Party Integrations</h2>
              <p className="mb-4">Our Services utilize third-party APIs, including <strong>Meta (WhatsApp Cloud API)</strong> and <strong>Google Gemini AI</strong>.</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your use of the WhatsApp features is subject to Meta's Business Messaging Policies.</li>
                <li>AI extractions are generated by machine learning models. While we strive for accuracy, Collabo is not responsible for errors in AI-extracted data. You are responsible for reviewing and approving all campaign details before activation.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Payments, Billing, and Subscriptions</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li><strong>Subscription Fees:</strong> Access to premium features requires a paid subscription. Fees are billed in advance on a recurring basis (monthly or annually) depending on your selected plan.</li>
                <li><strong>No Refunds:</strong> All payments are non-refundable unless legally required.</li>
                <li><strong>Usage Limits:</strong> Free and certain premium tiers have usage limits (e.g., monthly campaigns, AI extractions). Exceeding these limits may require an upgrade or incur overage charges.</li>
                <li><strong>Cancellation:</strong> You may cancel your subscription at any time. Your premium access will continue until the end of your current billing cycle.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Limitation of Liability</h2>
              <p className="mb-4">To the maximum extent permitted by law, Collabo and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising from:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your use or inability to use the Services.</li>
                <li>Any errors or inaccuracies in the AI extraction process.</li>
                <li>Any disputes between you and the influencers you manage through our platform.</li>
                <li>Unauthorized access to your account due to your failure to secure your credentials.</li>
              </ul>
              <p className="mt-4">
                <strong>Total Liability:</strong> In no event shall Collabo's total liability exceed the amount you paid us in the twelve (12) months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Data Privacy</h2>
              <p>Your use of Collabo is also governed by our <Link href="/privacy" className="text-emerald-400 hover:underline">Privacy Policy</Link>, which details how we collect, store, and process your data in compliance with the DPDP Act (India) and GDPR.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. Termination</h2>
              <p>We may terminate or suspend your access to the Services immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">10. Governing Law and Dispute Resolution</h2>
              <p>These Terms shall be governed by and construed in accordance with the laws of <strong>India</strong>. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts in <strong>New Delhi, India</strong>.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">11. Changes to Terms</h2>
              <p>We reserve the right to modify these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. By continuing to use the Services after revisions become effective, you agree to be bound by the updated Terms.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
              <p>If you have any questions regarding these Terms, please contact us at <strong>legal@collabo.app</strong>.</p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#020617] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50 grayscale">
            <Logo variant="full" size={24} href="" className="grayscale opacity-50" />
          </div>
          <div className="flex gap-8 text-sm">
            <Link href="/privacy" className="text-slate-400 hover:text-emerald-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-emerald-400 transition-colors">Terms of Service</Link>
            <a href="mailto:support@collabo.app" className="text-slate-400 hover:text-emerald-400 transition-colors">Contact</a>
          </div>
          <p className="text-sm text-slate-600">
            © {new Date().getFullYear()} Collabo. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
