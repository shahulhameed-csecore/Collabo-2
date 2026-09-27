'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function PrivacyPolicy() {
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
          <h1 className="text-4xl font-extrabold text-white mb-4">Privacy Policy</h1>
          <p className="text-slate-400 mb-12"><strong>Last Updated:</strong> June 2026</p>

          <div className="space-y-10 text-slate-300 leading-relaxed">
            <section>
              <p>
                Welcome to <strong>Collabo</strong> (mycollabo.online). We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our SaaS platform, WhatsApp Bot, and related services (collectively, the "Services").
              </p>
              <p className="mt-4">
                This policy is designed to comply with the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act) of India</strong> and the <strong>General Data Protection Regulation (GDPR)</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Data We Collect</h2>
              <p className="mb-4">We collect information that identifies, relates to, or could reasonably be linked to you ("Personal Data").</p>
              
              <h3 className="text-xl font-semibold text-emerald-400 mb-2 mt-6">1.1 Information You Provide Directly</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account Information:</strong> Name, email address, password (encrypted), and company/brand details.</li>
                <li><strong>Billing Information:</strong> Processed securely via our payment gateways (e.g., Stripe, Razorpay). We do not store full credit card numbers on our servers.</li>
                <li><strong>Campaign Data:</strong> Influencer names, social media handles, campaign deliverables, deadlines, and payment amounts.</li>
                <li><strong>User Communications:</strong> Support requests, feedback, and emails sent to us.</li>
              </ul>

              <h3 className="text-xl font-semibold text-emerald-400 mb-2 mt-6">1.2 Information Collected via WhatsApp Integration</h3>
              <p className="mb-2">When you use our WhatsApp Bot to forward chats, voice notes, screenshots, or PDFs:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Media and Text:</strong> We process the text, images, and voice notes you send to extract campaign details.</li>
                <li><strong>Phone Numbers:</strong> Your WhatsApp phone number is used for authentication and sending automated reminders.</li>
              </ul>

              <h3 className="text-xl font-semibold text-emerald-400 mb-2 mt-6">1.3 Information Collected Automatically (Cookies & Tracking)</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Usage Data:</strong> Browser type, IP address, device type, and time spent on pages.</li>
                <li><strong>Link Tracking:</strong> For our Internal Link Tracker, we collect basic metadata when a user clicks a short link (e.g., IP address, user agent, referrer, and timestamp) to provide click analytics.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Your Data</h2>
              <p className="mb-4">We use your data for the following legitimate business purposes:</p>
              <ol className="list-decimal pl-6 space-y-2">
                <li><strong>Service Delivery:</strong> To create campaigns, process AI extractions, and manage your Influencer CRM.</li>
                <li><strong>Automated Reminders:</strong> To send email and WhatsApp reminders to influencers regarding deadlines.</li>
                <li><strong>Analytics:</strong> To track campaign link performance and calculate ROI for your brand.</li>
                <li><strong>Service Improvement:</strong> To analyze how the platform is used and fix bugs.</li>
                <li><strong>Security:</strong> To detect and prevent fraud, abuse, and security incidents.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Third-Party Services and Data Sharing</h2>
              <p className="mb-4">To provide our Services, we rely on trusted third-party sub-processors. We do not sell your personal data to advertisers.</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Google Gemini AI:</strong> Used to extract structured campaign data from the unstructured text, images, and voice notes you forward to us. Data sent to Gemini is strictly for processing your request and is not used to train Google's public models.</li>
                <li><strong>Meta (WhatsApp Cloud API):</strong> Used to receive your forwarded briefs and to send automated reminders to influencers.</li>
                <li><strong>Supabase:</strong> Our primary PostgreSQL database and authentication provider. Data is stored securely with Row Level Security (RLS) enforcement.</li>
                <li><strong>Render / Vercel:</strong> Our cloud hosting infrastructure providers.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Data Security and Retention</h2>
              
              <h3 className="text-xl font-semibold text-emerald-400 mb-2 mt-6">4.1 Security Measures</h3>
              <p className="mb-2">We implement enterprise-grade security, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Encryption:</strong> Data in transit (TLS/SSL) and data at rest (AES-256).</li>
                <li><strong>Access Controls:</strong> Strict Row Level Security (RLS) ensuring users can only access their own campaign data.</li>
                <li><strong>Data Sanitization:</strong> Strict upload limits and validation to prevent malicious file uploads.</li>
              </ul>

              <h3 className="text-xl font-semibold text-emerald-400 mb-2 mt-6">4.2 Retention Policy</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account Data:</strong> Kept as long as your account is active.</li>
                <li><strong>Proof Uploads & Media:</strong> Files uploaded by influencers are retained to provide historical CRM data unless you explicitly delete the campaign.</li>
                <li><strong>WhatsApp Messages:</strong> Raw messages and media forwarded to our bot are processed for extraction and are not retained longer than necessary to create the campaign entry.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Your Rights (DPDP Act & GDPR)</h2>
              <p className="mb-4">Depending on your jurisdiction, you have the right to:</p>
              <ol className="list-decimal pl-6 space-y-2">
                <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
                <li><strong>Erasure (Right to be Forgotten):</strong> Request deletion of your account and associated data.</li>
                <li><strong>Data Portability:</strong> Request your data in a structured, commonly used, machine-readable format.</li>
                <li><strong>Withdraw Consent:</strong> Opt-out of marketing communications or WhatsApp reminders at any time.</li>
              </ol>
              <p className="mt-4">To exercise these rights, please contact us at <strong>privacy@collabo.app</strong>.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Cookies and Tracking Technologies</h2>
              <p>We use cookies and similar technologies (like local storage) to manage sessions, remember your preferences, and track analytics. You can control cookie preferences through your browser settings, though disabling them may affect platform functionality.</p>
            </section>

            <section id="refund">
              <h2 className="text-2xl font-bold text-white mb-4">7. Refund and Cancellation Policy</h2>
              <p className="mb-4">We strive to provide the best experience for all Collabo users. Our refund and cancellation terms are as follows:</p>
              
              <h3 className="text-xl font-semibold text-emerald-400 mb-2 mt-6">7.1 Subscription Cancellations</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>You may cancel your subscription at any time through your Billing dashboard.</li>
                <li>Upon cancellation, you will retain access to Pro features until the end of your current billing cycle.</li>
                <li>We do not offer pro-rated refunds for mid-cycle cancellations.</li>
              </ul>

              <h3 className="text-xl font-semibold text-emerald-400 mb-2 mt-6">7.2 Refund Eligibility</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Trial Periods:</strong> If you cancel during a free trial, you will not be charged.</li>
                <li><strong>Accidental Charges:</strong> If you believe you were charged in error, please contact us within 7 days of the charge date.</li>
                <li><strong>Service Unavailability:</strong> If the Collabo platform is unavailable for an extended period preventing you from managing campaigns, you may be eligible for a partial refund or service credit at our discretion.</li>
              </ul>

              <h3 className="text-xl font-semibold text-emerald-400 mb-2 mt-6">7.3 Failed Payments (Razorpay)</h3>
              <p>If a payment fails, your account will temporarily downgrade to the Free Tier until the payment is successfully processed. You will not lose any historical data during this period.</p>

              <h3 className="text-xl font-semibold text-emerald-400 mb-2 mt-6">7.4 Contacting Us for Refunds</h3>
              <p>To request a refund under the eligible criteria, please email <strong>billing@collabo.app</strong> with your account email and transaction ID. We process eligible requests within 5-7 business days.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Changes to This Privacy Policy</h2>
              <p>We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. Contact Us</h2>
              <p>If you have any questions or concerns about this Privacy Policy, please contact our Data Protection Officer at:</p>
              <p className="mt-2">
                <strong>Email:</strong> privacy@collabo.app<br/>
                <strong>Website:</strong> mycollabo.online
              </p>
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
            <Link href="/privacy" className="text-emerald-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-slate-400 hover:text-emerald-400 transition-colors">Terms of Service</Link>
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
