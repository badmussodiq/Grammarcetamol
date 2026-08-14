'use client';

import {useState} from 'react';
import Link from 'next/link';
import {Button, Mapping, Skeleton, Tabs} from '@grammarcetamol/utilities';
import {useMyCourses} from '@/hooks/useMyCourses';
import {EnrolledCourseCard} from '@/components/EnrolledCourseCard';

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'In Progress', value: 'active' },
  { label: 'Completed', value: 'completed' },
];

export default function MyCoursesPage() {
  const { data, loading, error } = useMyCourses();
  const [tab, setTab] = useState('all');

  const filtered = data?.filter((item) => tab === 'all' || item.enrollment.status === tab) ?? [];

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-text-primary">My Courses</h1>
        <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => <Skeleton key={i} variant="rect" height={260} />)}
          </div>
        )}

        {error && <p className="text-error">Could not load your courses. Try refreshing.</p>}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-text-secondary">
              {data && data.length > 0 ? 'No courses in this category yet.' : "You haven't enrolled in a course yet."}
            </p>
            <Link href="/courses"><Button>Browse Courses</Button></Link>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Mapping array={filtered} keyExtractor={(item) => item.enrollment.id}>
              {(item) => <EnrolledCourseCard item={item} />}
            </Mapping>
          </div>
        )}
      </div>
    </main>
  );
}
