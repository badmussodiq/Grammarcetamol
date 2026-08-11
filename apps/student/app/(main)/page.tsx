'use client';

import Link from 'next/link';
import { useFetch, Skeleton, Button } from '@grammarcetamol/utilities';
import { CourseCard } from '@/components/CourseCard';
import { FaqAccordion } from '@/components/FaqAccordion';
import { FAQ_ITEMS } from '@/lib/faqData';
import type { Course } from '@/lib/course.api';

const SERVICES = [
  { title: 'Grammar Fundamentals', description: 'Build a rock-solid foundation in English grammar, from tenses to sentence structure.' },
  { title: 'Business English', description: 'Communicate confidently in meetings, emails, and presentations at work.' },
  { title: 'IELTS / TOEFL Prep', description: 'Structured practice and strategy to hit your target score on standardized English exams.' },
  { title: 'Pronunciation Coaching', description: 'Sharpen your accent and clarity with focused speaking exercises.' },
  { title: 'Writing Workshops', description: 'Learn to write clearly and persuasively for essays, reports, and everyday communication.' },
  { title: 'Vocabulary Builder', description: 'Expand your active vocabulary with themed lessons you can use right away.' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Register', description: 'Create a free account in under a minute — no credit card required.' },
  { step: '2', title: 'Learn', description: 'Pick a course, work through structured lessons at your own pace.' },
  { step: '3', title: 'Master', description: 'Track your progress, review your work, and build real fluency.' },
];

const TESTIMONIALS = [
  { name: 'Amaka O.', role: 'Marketing Executive', quote: 'The Business English course completely changed how I run client meetings. I feel so much more confident now.' },
  { name: 'Tunde A.', role: 'University Student', quote: 'I went from struggling with grammar basics to writing full essays in a few months. The structure really works.' },
  { name: 'Ifeoma N.', role: 'Customer Support Lead', quote: 'Grammarcetamol fits around my schedule. I learn a lesson or two every evening and I can already see the difference.' },
  { name: 'Chidi E.', role: 'Software Engineer', quote: 'The pronunciation coaching helped me a lot for interviews and presentations at work.' },
  { name: 'Blessing K.', role: 'IELTS Candidate', quote: 'The exam prep course was exactly what I needed. Clear, focused, and easy to follow.' },
];

export default function Home() {
  const { data: featured, loading } = useFetch<Course[]>('/api/courses/featured?limit=6');

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 text-center py-24 border-b border-border">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-primary mb-4 leading-tight">
            Master English with Confidence
          </h1>
          <p className="text-text-secondary text-lg mb-8">
            Structured lessons, real practice, and expert instructors — everything you need to learn English and use it with confidence.
          </p>
          <div className="flex gap-4 justify-center flex-wrap mb-8">
            <Link href="/register">
              <Button size="lg">Start Learning</Button>
            </Link>
            <Link href="/courses">
              <Button size="lg" variant="secondary">Explore Courses</Button>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-text-muted flex-wrap">
            <span>10,000+ students</span>
            <span aria-hidden>•</span>
            <span>4.9/5 rating</span>
            <span aria-hidden>•</span>
            <span>Expert instructors</span>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-text-primary text-center mb-10">Our Flagship Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((service) => (
            <div key={service.title} className="rounded-lg border border-border bg-surface p-6 hover:shadow-lg transition-shadow duration-200">
              <h3 className="font-semibold text-text-primary mb-2">{service.title}</h3>
              <p className="text-sm text-text-secondary">{service.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Courses */}
      {(loading || (featured && featured.length > 0)) && (
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-text-primary">Popular Courses</h2>
            <Link href="/courses" className="text-primary text-sm font-medium hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-3">
                    <Skeleton variant="rect" height={160} />
                    <Skeleton variant="text" />
                  </div>
                ))
              : featured!.map((course) => <CourseCard key={course.id} course={course} />)}
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="bg-surface border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-text-primary text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg">
                  {item.step}
                </div>
                <h3 className="font-semibold text-text-primary">{item.title}</h3>
                <p className="text-sm text-text-secondary max-w-xs">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-text-primary text-center mb-10">What Our Students Say</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TESTIMONIALS.slice(0, 6).map((t) => (
            <div key={t.name} className="rounded-lg border border-border bg-surface p-6 flex flex-col gap-4">
              <p className="text-sm text-text-secondary italic">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3 mt-auto">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {t.name.slice(0, 1)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-surface border-y border-border">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-text-primary text-center mb-10">Frequently Asked Questions</h2>
          <FaqAccordion items={FAQ_ITEMS} />
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-primary">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Ready to Transform Your English?</h2>
          <Link href="/register">
            <Button size="lg" variant="secondary">
              Get Started for Free
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
