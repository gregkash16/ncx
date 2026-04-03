"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--ncx-bg-start)] text-[var(--ncx-text-primary)]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[var(--ncx-border)] bg-[var(--ncx-bg-panel)] px-4 py-3">
        <Link
          href="/m"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ncx-primary)] hover:opacity-80"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </Link>
      </div>

      {/* Content */}
      <div className="max-w-2xl space-y-6 px-4 py-6 text-sm">
        <div>
          <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-[var(--ncx-text-muted)] text-xs mb-4">Last updated: April 2026</p>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-3">1. Introduction</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            This Privacy Policy ("Policy") describes how NCX ("we," "us," "our," or "Company")
            collects, uses, and shares information when you use our mobile application and related
            services (the "App"). We are committed to protecting your privacy and ensuring you have
            a positive experience on our App.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">2. Information We Collect</h2>
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-[var(--ncx-text-primary)]">Discord Account Information</h3>
              <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
                When you log in through Discord OAuth, we collect your Discord username, user ID,
                and avatar for authentication and personalization purposes.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--ncx-text-primary)]">League Statistics Data</h3>
              <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
                We collect your name and email address for the purposes of maintaining and managing
                league statistics and player records.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--ncx-text-primary)]">Device Information</h3>
              <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
                We collect information about your device, including device type, operating system,
                and unique device identifiers for push notification delivery.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--ncx-text-primary)]">Push Notification Tokens</h3>
              <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
                We collect and store push notification tokens to deliver timely updates about league
                activity and gameplay.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">3. How We Use Your Information</h2>
          <ul className="space-y-2 text-[var(--ncx-text-primary)]/80 leading-relaxed">
            <li>• Authenticate and authorize access to the App</li>
            <li>• Deliver and manage push notifications (opt-in only)</li>
            <li>• Improve and optimize App functionality</li>
            <li>• Personalize your experience</li>
            <li>• Maintain league statistics and player records</li>
            <li>• Maintain security and prevent fraud</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">4. Push Notifications</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            Push notifications are opt-in only. You must explicitly authorize push notifications when
            prompted by the App. You can disable push notifications at any time through your device settings
            or the App settings without affecting your ability to use other features.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">5. Information Sharing & Third-Party Services</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            We do not sell your personal information. We use the following third-party services
            to operate the App:
          </p>
          <ul className="space-y-2 text-[var(--ncx-text-primary)]/80 leading-relaxed mt-3">
            <li>• <strong>Discord</strong> — Authentication (OAuth2 login)</li>
            <li>• <strong>Vercel</strong> — Application hosting and serverless functions</li>
            <li>• <strong>Neon</strong> — Database hosting for league data</li>
            <li>• <strong>Railway</strong> — Database hosting for league data</li>
            <li>• <strong>Apple Push Notification Service (APNs)</strong> — Push notification delivery for iOS</li>
            <li>• <strong>Firebase Cloud Messaging (FCM)</strong> — Push notification delivery for Android</li>
          </ul>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed mt-3">
            These services may process your data as described in their respective privacy policies.
            We only share the minimum information necessary for each service to function. Your information
            may also be disclosed when required by law or regulation.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">6. Data Security</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            We implement appropriate technical and organizational measures to protect your personal
            information from unauthorized access, alteration, disclosure, or destruction.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">7. Data Retention & Account Deletion</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            We retain your personal information indefinitely for the purpose of maintaining league
            statistics and player records.
          </p>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed mt-3">
            You may request deletion of your account and all associated personal data at any time by
            emailing <span className="font-semibold text-[var(--ncx-primary)]">gregkash@gmail.com</span> with
            the subject line "Account Deletion Request." We will process your request within 30 days and
            confirm deletion via email. Upon deletion, your Discord authentication data, push notification
            tokens, and device information will be permanently removed. Anonymized league statistics
            (win/loss records, game scores) may be retained for historical league integrity.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">8. Children's Privacy (COPPA Compliance)</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            The App is not directed to children under 13 years of age. We do not knowingly collect
            personal information from children under 13. If we become aware that a child under 13 has
            provided us with personal information, we will promptly delete such information and terminate
            the child's account. Parents or guardians who believe their child has provided information to
            us should contact us immediately at the email address provided below.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">9. Your Privacy Rights</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            Depending on your location, you may have certain rights regarding your personal information:
          </p>
          <ul className="space-y-2 text-[var(--ncx-text-primary)]/80 leading-relaxed mt-3">
            <li>
              <strong>Right to Access:</strong> You can request access to the personal information we hold about you.
            </li>
            <li>
              <strong>Right to Correct:</strong> You can request that we correct inaccurate personal information.
            </li>
            <li>
              <strong>Right to Delete:</strong> You can request deletion of your personal information, subject to legal obligations.
            </li>
            <li>
              <strong>Right to Data Portability:</strong> You can request a copy of your personal information in a portable format.
            </li>
            <li>
              <strong>Right to Opt-Out:</strong> You can opt out of push notifications at any time.
            </li>
          </ul>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed mt-3">
            Contact us to exercise any of these rights.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">10. Changes to This Policy</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any material
            changes by updating the "Last updated" date above.
          </p>
        </section>

        <section className="border-t border-[var(--ncx-border)] pt-6">
          <h2 className="text-lg font-semibold mb-3">11. Contact Us</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            If you have questions about this Privacy Policy or our privacy practices, please contact us at:
          </p>
          <p className="mt-3 font-semibold text-[var(--ncx-primary)]">
            gregkash@gmail.com
          </p>
        </section>

        <div className="pb-12" />
      </div>
    </div>
  );
}
