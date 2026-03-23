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
          <p className="text-[var(--ncx-text-muted)] text-xs mb-4">Last updated: March 2026</p>
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
              <h3 className="font-semibold text-[var(--ncx-text-primary)]">Usage Data</h3>
              <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
                We automatically collect information about your interactions with the App, including
                pages viewed, features used, and timestamps of your activity.
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
            <li>• Deliver and manage push notifications</li>
            <li>• Improve and optimize App functionality</li>
            <li>• Personalize your experience</li>
            <li>• Analyze usage trends and user behavior</li>
            <li>• Maintain security and prevent fraud</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">4. Information Sharing</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            We do not sell your personal information. We may share information with:
          </p>
          <ul className="space-y-2 text-[var(--ncx-text-primary)]/80 leading-relaxed mt-3">
            <li>• Service providers who assist in operating the App</li>
            <li>• Discord for authentication purposes</li>
            <li>• When required by law or regulation</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">5. Data Security</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            We implement appropriate technical and organizational measures to protect your personal
            information from unauthorized access, alteration, disclosure, or destruction.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">6. Your Rights</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            Depending on your location, you may have certain rights regarding your personal
            information, including the right to access, correct, or delete your data. Contact us
            to exercise these rights.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">7. Changes to This Policy</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any material
            changes by updating the "Last updated" date above.
          </p>
        </section>

        <section className="border-t border-[var(--ncx-border)] pt-6">
          <h2 className="text-lg font-semibold mb-3">8. Contact Us</h2>
          <p className="text-[var(--ncx-text-primary)]/80 leading-relaxed">
            If you have questions about this Privacy Policy or our privacy practices, please contact us.
          </p>
        </section>

        <div className="pb-12" />
      </div>
    </div>
  );
}
