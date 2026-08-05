'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useFetch, Skeleton, Button, ProgressBar, Mapping } from '@grammarcetamol/utilities';
import { useAuth } from '@/contexts/AuthContext';
import { useMyCourses } from '@/hooks/useMyCourses';
import { EnrolledCourseCard } from '@/components/EnrolledCourseCard';
import { CourseCard } from '@/components/CourseCard';
import { greetingForHour } from '@/lib/dashboard';
import type { Paged, Course } from '@/lib/course.api';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: myCourses, loading: myCoursesLoading } = useMyCourses();
  const { data: recommended } = useFetch<Paged<Course>>('/api/courses?sort=enrollment_count&limit=6');

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const displayName = user?.fullName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there';

  const continueLearning = myCourses?.find((item) => item.enrollment.status === 'active');
  const enrolledIds = new Set((myCourses ?? []).map((item) => item.course.id));
  const recommendedCourses = (recommended?.items ?? []).filter((c) => !enrolledIds.has(c.id)).slice(0, 6);

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-6xl mx-auto flex flex-col gap-10">
        <section className="rounded-lg bg-primary text-white p-8">
          <h1 className="text-2xl font-bold mb-1">{greeting}, {displayName}! 👋</h1>
          <p className="text-white/80">Ready to keep building your English skills today?</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text-primary mb-4">Continue Learning</h2>
          {myCoursesLoading ? (
            <Skeleton variant="rect" height={120} />
          ) : continueLearning ? (
            <Link
              href={`/my-courses/${continueLearning.course.id}`}
              className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="w-48 aspect-video bg-background rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center">
                {continueLearning.course.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={continueLearning.course.coverImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-text-muted text-xs">No cover</span>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <p className="font-semibold text-text-primary">{continueLearning.course.title}</p>
                <ProgressBar value={continueLearning.completionPct} showLabel color="#F59E0B" />
              </div>
              <Button>Resume</Button>
            </Link>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-6 text-center">
              <p className="text-text-secondary mb-4">You haven&apos;t started a course yet.</p>
              <Link href="/courses"><Button>Browse Courses</Button></Link>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-text-primary">My Courses</h2>
            <Link href="/my-courses" className="text-sm text-primary hover:underline">View All</Link>
          </div>
          {myCoursesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[0, 1, 2].map((i) => <Skeleton key={i} variant="rect" height={220} />)}
            </div>
          ) : myCourses && myCourses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Mapping array={myCourses.slice(0, 3)} keyExtractor={(item) => item.enrollment.id}>
                {(item) => <EnrolledCourseCard item={item} />}
              </Mapping>
            </div>
          ) : (
            <p className="text-text-secondary text-sm">No enrollments yet — browse the catalog to get started.</p>
          )}
        </section>

        {recommendedCourses.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-4">Recommended Courses</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <Mapping array={recommendedCourses} keyExtractor={(c) => c.id}>
                {(course) => <CourseCard course={course} />}
              </Mapping>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
