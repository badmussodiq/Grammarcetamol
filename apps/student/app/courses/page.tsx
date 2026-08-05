'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFetch, Skeleton, Input, Button, cn } from '@grammarcetamol/utilities';
import { CourseCard } from '@/components/CourseCard';
import {
  buildCourseQuery,
  filtersFromSearchParams,
  type Category,
  type Course,
  type CourseFilters,
  type Paged,
  type SortOption,
} from '@/lib/course.api';

const PAGE_SIZE = 12;

const DIFFICULTIES: { value: CourseFilters['difficulty']; label: string }[] = [
  { value: null, label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const PRICES: { value: CourseFilters['price']; label: string }[] = [
  { value: null, label: 'All prices' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
];

const SORTS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
];

export default function CoursesPage() {
  return (
    <Suspense>
      <CoursesCatalog />
    </Suspense>
  );
}

function CoursesCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<CourseFilters>(() => filtersFromSearchParams(searchParams));
  const [searchInput, setSearchInput] = useState(filters.q);
  const [accumulated, setAccumulated] = useState<Course[]>([]);

  const { data: categories } = useFetch<Category[]>('/api/categories');
  const { data: result, loading, error } = useFetch<Paged<Course>>(`/api/courses?${buildCourseQuery(filters, PAGE_SIZE)}`);

  useEffect(() => {
    const params = new URLSearchParams(buildCourseQuery(filters, PAGE_SIZE));
    params.delete('page');
    params.delete('limit');
    const qs = params.toString();
    router.replace(qs ? `/courses?${qs}` : '/courses', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.difficulty, filters.price, filters.q, filters.sort]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters((prev) => (prev.q === searchInput ? prev : { ...prev, q: searchInput, page: 1 }));
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!result) return;
    setAccumulated((prev) => (filters.page === 1 ? result.items : [...prev, ...result.items]));
  }, [result, filters.page]);

  function apply(patch: Partial<CourseFilters>) {
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  }

  const hasMore = result ? filters.page < result.totalPages : false;
  const showSkeleton = loading && accumulated.length === 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-text-primary mb-1">Browse Courses</h1>
        <p className="text-text-secondary mb-8">Structured English lessons taught by expert instructors.</p>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
          <aside className="flex flex-col gap-6">
            <Input
              label="Search"
              placeholder="Search courses..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />

            <FilterGroup
              title="Category"
              options={[{ value: null, label: 'All categories' }, ...(categories ?? []).map((c) => ({ value: c.slug, label: c.name }))]}
              value={filters.category}
              onChange={(value) => apply({ category: value })}
            />

            <FilterGroup
              title="Difficulty"
              options={DIFFICULTIES}
              value={filters.difficulty}
              onChange={(value) => apply({ difficulty: value })}
            />

            <FilterGroup title="Price" options={PRICES} value={filters.price} onChange={(value) => apply({ price: value })} />
          </aside>

          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-text-secondary">
                {result ? `${result.total} course${result.total === 1 ? '' : 's'}` : ' '}
              </p>
              <select
                aria-label="Sort by"
                value={filters.sort}
                onChange={(e) => apply({ sort: e.target.value as SortOption })}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-error text-sm py-8 text-center">
                Couldn&apos;t load courses right now. Please try again shortly.
              </p>
            )}

            {!error && showSkeleton && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-3">
                    <Skeleton variant="rect" height={160} />
                    <Skeleton variant="text" />
                    <Skeleton variant="text" width="60%" />
                  </div>
                ))}
              </div>
            )}

            {!error && !showSkeleton && accumulated.length === 0 && (
              <p className="text-text-secondary text-sm py-8 text-center">No courses match these filters yet.</p>
            )}

            {!error && accumulated.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {accumulated.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
                {hasMore && (
                  <div className="flex justify-center mt-8">
                    <Button variant="secondary" loading={loading} onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}>
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function FilterGroup<T extends string | null>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-2">{title}</h3>
      <div className="flex flex-col gap-1">
        {options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded-md transition-colors',
              value === opt.value ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-surface',
            )}
          >
            <span
              className={cn(
                'w-3.5 h-3.5 rounded-full border shrink-0',
                value === opt.value ? 'border-primary bg-primary' : 'border-border',
              )}
            />
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
