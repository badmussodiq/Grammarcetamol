'use client';

import { useEffect, useState } from 'react';
import { coursesApi } from '@/lib/courses.api';

/** Enrollments/progress only carry a courseId — resolve titles one course-service call at a
 * time (fine at admin-table scale) and cache them for the lifetime of the page. */
export function useCourseTitles(courseIds: string[]): Record<string, string> {
  const [titles, setTitles] = useState<Record<string, string>>({});
  const key = courseIds.join(',');

  useEffect(() => {
    const missing = courseIds.filter((id) => !(id in titles));
    if (missing.length === 0) return;

    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        coursesApi
          .detail(id)
          .then((res) => [id, res.data.course.title] as const)
          .catch(() => [id, id.slice(0, 8)] as const),
      ),
    ).then((pairs) => {
      if (!cancelled) setTitles((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return titles;
}
