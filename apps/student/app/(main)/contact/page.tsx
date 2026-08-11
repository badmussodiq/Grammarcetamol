import Link from 'next/link';
import { Button } from '@grammarcetamol/utilities';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="max-w-lg mx-auto text-center">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Get in Touch</h1>
        <p className="text-text-secondary mb-8">
          Have a question about a course, a payment, or anything else? Send us an enquiry and our team
          will follow up by email — usually within one business day.
        </p>
        <div className="rounded-lg border border-border bg-surface p-6 mb-8 text-left">
          <p className="text-sm font-semibold text-text-primary mb-1">Email</p>
          <p className="text-sm text-text-secondary mb-4">support@grammarcetamol.com</p>
          <p className="text-sm font-semibold text-text-primary mb-1">Response time</p>
          <p className="text-sm text-text-secondary">Usually within 1 business day</p>
        </div>
        <Link href="/support">
          <Button size="lg">Open a Support Ticket</Button>
        </Link>
      </div>
    </main>
  );
}
