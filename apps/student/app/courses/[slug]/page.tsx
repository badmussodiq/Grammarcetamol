'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useFetch, Skeleton, Button, Badge, cn } from '@grammarcetamol/utilities';
import { useAuth } from '../../../contexts/AuthContext';
import type { CourseDetailResponse, LessonResponse } from '../../../lib/course.api';

function formatPrice(price: number, currency: string): string {
  if (price === 0) return 'Free';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}

function formatMinutes(minutes: number | null): string {
  if (!minutes) return '';
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatSeconds(seconds: number | null): string {
  if (!seconds) return '';
  return formatMinutes(Math.round(seconds / 60));
}

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

export default function CourseDetailPage() {
  const params = useParams<{ slug: string }>();
  const { data, loading, error } = useFetch<CourseDetailResponse>(`/api/courses/${params.slug}`);
  const { user } = useAuth();
  // Cookies aren't port-scoped on localhost, so an admin-portal session cookie is visible here
  // too — isAuthenticated alone would show "Coming soon" for a logged-in admin browsing the
  // student catalog. Only a genuine STUDENT session should see the student-facing enroll state.
  const isStudent = !!user?.roles?.includes('STUDENT');

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          <Skeleton variant="rect" height={280} />
          <Skeleton variant="text" width="60%" height={32} />
          <Skeleton variant="text" width="90%" />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6 py-10 text-center">
        <div>
          <p className="text-text-primary font-medium mb-2">Course not found</p>
          <Link href="/courses" className="text-primary hover:underline">Back to all courses</Link>
        </div>
      </main>
    );
  }

  const { course, modules } = data;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
        <div className="flex flex-col gap-8">
          <div>
            <div className="aspect-video bg-surface border border-border rounded-lg overflow-hidden mb-6 flex items-center justify-center">
              {course.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.coverImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-text-muted text-sm">No cover image</span>
              )}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="neutral" size="sm">{course.difficulty}</Badge>
              {course.avgRating != null && (
                <span className="text-sm text-text-secondary">★ {course.avgRating.toFixed(1)} ({course.reviewCount} reviews)</span>
              )}
              <span className="text-sm text-text-secondary">{course.enrollmentCount} students</span>
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">{course.title}</h1>
            {course.subtitle && <p className="text-lg text-text-secondary">{course.subtitle}</p>}
          </div>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">About this course</h2>
            <p className="text-text-secondary whitespace-pre-line">{course.description}</p>
          </section>

          {course.learningObjectives.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-text-primary mb-3">What you&apos;ll learn</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {course.learningObjectives.map((objective, i) => (
                  <li key={i} className="flex gap-2 text-text-secondary text-sm">
                    <span className="text-success">✓</span>
                    {objective}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(course.targetAudience || course.prerequisites) && (
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {course.targetAudience && (
                <div>
                  <h3 className="font-semibold text-text-primary mb-1">Who this is for</h3>
                  <p className="text-sm text-text-secondary">{course.targetAudience}</p>
                </div>
              )}
              {course.prerequisites && (
                <div>
                  <h3 className="font-semibold text-text-primary mb-1">Prerequisites</h3>
                  <p className="text-sm text-text-secondary">{course.prerequisites}</p>
                </div>
              )}
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Curriculum</h2>
            <Curriculum modules={modules} />
          </section>

          <section className="flex items-center gap-3 pt-4 border-t border-border">
            {course.instructorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.instructorAvatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {course.instructorName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-text-primary">{course.instructorName}</p>
              {course.instructorBio && <p className="text-sm text-text-secondary max-w-xl">{course.instructorBio}</p>}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-10 h-fit rounded-lg border border-border bg-surface p-6 flex flex-col gap-4">
          <p className="text-3xl font-bold text-text-primary">{formatPrice(course.discountPrice ?? course.price, course.currency)}</p>
          {course.discountPrice != null && course.discountPrice < course.price && (
            <p className="text-sm text-text-secondary line-through">{formatPrice(course.price, course.currency)}</p>
          )}
          <EnrollButton slug={course.slug} isStudent={isStudent} />
          <dl className="text-sm text-text-secondary flex flex-col gap-1 pt-4 border-t border-border">
            <div className="flex justify-between"><dt>Modules</dt><dd>{modules.length}</dd></div>
            <div className="flex justify-between">
              <dt>Lessons</dt><dd>{modules.reduce((sum, m) => sum + m.lessons.length, 0)}</dd>
            </div>
            {course.estimatedDuration != null && (
              <div className="flex justify-between"><dt>Duration</dt><dd>{formatMinutes(course.estimatedDuration)}</dd></div>
            )}
            <div className="flex justify-between"><dt>Language</dt><dd>{course.language.toUpperCase()}</dd></div>
          </dl>
        </aside>
      </div>
    </main>
  );
}

function EnrollButton({ slug, isStudent }: { slug: string; isStudent: boolean }) {
  if (!isStudent) {
    return (
      <Link href={`/login?returnUrl=/courses/${slug}`}>
        <Button className="w-full">Enroll now</Button>
      </Link>
    );
  }
  return (
    <Button className="w-full" disabled title="Enrollment is coming soon">
      Coming soon
    </Button>
  );
}

function Curriculum({ modules }: { modules: CourseDetailResponse['modules'] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(modules[0] ? [modules[0].id] : []));

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (modules.length === 0) {
    return <p className="text-sm text-text-secondary">Curriculum is being finalized.</p>;
  }

  return (
    <div className="flex flex-col border border-border rounded-lg divide-y divide-border overflow-hidden">
      {modules.map((module, i) => {
        const isOpen = openIds.has(module.id);
        return (
          <div key={module.id}>
            <button
              type="button"
              onClick={() => toggle(module.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left bg-surface hover:bg-background transition-colors"
            >
              <span className="font-medium text-text-primary">
                Module {i + 1}: {module.title}
              </span>
              <span className="flex items-center gap-3 text-sm text-text-secondary">
                {module.lessons.length} lesson{module.lessons.length === 1 ? '' : 's'}
                <span className={cn('transition-transform', isOpen && 'rotate-180')}>⌄</span>
              </span>
            </button>
            {isOpen && (
              <ul className="bg-background">
                {module.lessons.map((lesson) => (
                  <LessonRow key={lesson.id} lesson={lesson} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LessonRow({ lesson }: { lesson: LessonResponse }) {
  return (
    <li className="flex items-center justify-between px-4 py-2.5 text-sm border-t border-border/60">
      <span className="flex items-center gap-2 text-text-secondary">
        <span className={lesson.preview ? 'text-primary' : 'text-text-muted'}>
          {lesson.preview ? <PlayIcon /> : <LockIcon />}
        </span>
        {lesson.title}
        {lesson.preview && <Badge variant="info" size="sm">Preview</Badge>}
      </span>
      {lesson.duration != null && <span className="text-text-muted">{formatSeconds(lesson.duration)}</span>}
    </li>
  );
}
