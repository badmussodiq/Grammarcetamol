import Link from 'next/link';
import {Button} from '@grammarcetamol/utilities';

const STATS = [
  { value: '10,000+', label: 'Students' },
  { value: '4.9/5', label: 'Average rating' },
  { value: '20+', label: 'Courses' },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-text-primary mb-4">About Grammarcetamol</h1>
        <p className="text-text-secondary text-lg">
          Grammarcetamol is an English language learning platform built to help students at every level speak, write,
          and understand English with confidence. We believe learning a language should be structured, practical,
          and genuinely enjoyable.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        {STATS.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-surface p-6">
            <p className="text-2xl font-bold text-primary mb-1">{stat.value}</p>
            <p className="text-sm text-text-secondary">{stat.label}</p>
          </div>
        ))}
      </section>

      <section className="bg-surface border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Why Grammarcetamol</h2>
          <p className="text-text-secondary mb-4">
            Every course on our platform is built around real-world outcomes — whether that&apos;s passing an exam,
            writing better at work, or simply speaking more confidently in everyday conversations.
          </p>
          <p className="text-text-secondary">
            Our instructors focus on practical, structured lessons rather than generic content, so the time you put
            in translates directly into progress you can measure.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-text-primary mb-6">Ready to get started?</h2>
        <Link href="/register">
          <Button size="lg">Create your free account</Button>
        </Link>
      </section>
    </main>
  );
}
