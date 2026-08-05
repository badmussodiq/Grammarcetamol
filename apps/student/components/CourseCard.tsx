import Link from 'next/link';
import { Badge } from '@grammarcetamol/utilities';
import type { Course } from '../lib/course.api';

function formatPrice(course: Course): string {
  if (course.price === 0) return 'Free';
  const amount = course.discountPrice ?? course.price;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: course.currency }).format(amount);
}

const difficultyLabel: Record<Course['difficulty'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="flex flex-col rounded-lg border border-border bg-surface overflow-hidden hover:shadow-lg transition-shadow duration-200"
    >
      <div className="aspect-video bg-background flex items-center justify-center overflow-hidden">
        {course.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.coverImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-text-muted text-sm">No cover image</span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="sm">{difficultyLabel[course.difficulty]}</Badge>
          {course.avgRating != null && (
            <span className="text-xs text-text-secondary">★ {course.avgRating.toFixed(1)} ({course.reviewCount})</span>
          )}
        </div>
        <h3 className="font-semibold text-text-primary leading-snug line-clamp-2">{course.title}</h3>
        {course.subtitle && <p className="text-sm text-text-secondary line-clamp-2">{course.subtitle}</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm text-text-secondary">{course.instructorName}</span>
          <span className="font-semibold text-text-primary">{formatPrice(course)}</span>
        </div>
      </div>
    </Link>
  );
}
