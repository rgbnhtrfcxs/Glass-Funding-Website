import React from 'react';

export default function Privacy() {
  return (
    <main className="container mx-auto px-4 py-10 pt-24">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p>This Privacy Policy describes how GLASS-Connect collects and uses information through our website.</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">1. Data We Collect</h2>
      <p>We collect information you submit through our contact form (name, email, and message). We do not use cookies or tracking technologies.</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. Use of Information</h2>
      <p>Your information is used only to respond to inquiries. We do not share it with third parties unless legally required.</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. Your Rights</h2>
      <p>In accordance with the GDPR, you have the right to access, correct, or delete your personal data by contacting us.</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">4. Contact</h2>
      <p>For privacy concerns, contact <a href="mailto:support@glass.demo" className="text-blue-600 underline">support@glass.demo</a>.</p>

      <p className="mt-10 text-sm text-gray-500">Last updated: July 2025</p>
    </main>
  );
}
