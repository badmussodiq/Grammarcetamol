'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@grammarcetamol/utilities';
import { enrollmentApi } from '@/lib/enrollment.api';
import type { Enrollment } from '@/lib/enrollment.api';
import type { Course } from '@/lib/course.api';

export interface EnrolledCourse {
  enrollment: Enrollment;
  course: Course;
  completionPct: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Combines GET /api/enrollments/mine with a per-enrollment course-detail + learn-state fetch —
 * there's no single endpoint that returns "my courses with progress" pre-joined. Acceptable
 * fan-out at the scale a student's own enrollment list actually reaches; not something to
 * optimize before it's a real problem.
 */
export function useMyCourses() {
  const [data, setData] = useState<EnrolledCourse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data: enrollments } = await enrollmentApi.getMyEnrollments();
        const withDetails = await Promise.all(
          enrollments.map(async (enrollment): Promise<EnrolledCourse> => {
            const [courseRes, learnRes] = await Promise.all([
              apiFetch<ApiResponse<{ course: Course }>>(`/api/courses/${enrollment.courseId}`),
              apiFetch<ApiResponse<{ completionPct: number }>>(`/api/enrollments/course/${enrollment.courseId}/learn`),
            ]);
            return { enrollment, course: courseRes.data.course, completionPct: learnRes.data.completionPct };
          }),
        );
        if (!cancelled) {
          setData(withDetails);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { data, loading, error, refetch: () => setTick((t) => t + 1) };
}
