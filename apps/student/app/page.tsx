'use client';

import Link from 'next/link';
import { useFetch, Skeleton } from '@grammarcetamol/utilities';
import { CourseCard } from '../components/CourseCard';
import type { Course } from '../lib/course.api';

export default function Home() {
  const { data: featured, loading } = useFetch<Course[]>('/api/courses/featured?limit=6');

  return (
    <main className="min-h-screen bg-background">
      <section className="flex flex-col items-center justify-center p-8 text-center py-24">
        <div className="max-w-lg">
          <h1 className="text-4xl font-bold text-primary mb-4">Grammarcetamol</h1>
          <p className="text-[#64748B] text-lg mb-8">
            Master English with structured lessons, live classes, and expert instructors.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/courses"
              className="px-6 py-3 bg-primary text-white rounded-md font-medium hover:bg-primary-light transition-colors duration-150">
              Browse Courses
            </Link>
            <Link href="/register"
              className="px-6 py-3 bg-surface border border-primary text-primary rounded-md font-medium hover:bg-background transition-colors duration-150">
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {(loading || (featured && featured.length > 0)) && (
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-text-primary">Featured Courses</h2>
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
    </main>
  );
}
