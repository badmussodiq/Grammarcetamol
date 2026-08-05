import Link from 'next/link';
import { ProgressBar, Badge } from '@grammarcetamol/utilities';
import type { EnrolledCourse } from '@/hooks/useMyCourses';

export function EnrolledCourseCard({ item }: { item: EnrolledCourse }) {
  const { course, enrollment, completionPct } = item;
  return (
    <Link
      href={`/my-courses/${course.id}`}
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
        <div className="flex items-center justify-between">
          <Badge variant={enrollment.status === 'completed' ? 'success' : 'info'} size="sm">
            {enrollment.status === 'completed' ? 'Completed' : 'In Progress'}
          </Badge>
        </div>
        <h3 className="font-semibold text-text-primary leading-snug line-clamp-2">{course.title}</h3>
        <div className="mt-auto pt-2">
          <ProgressBar value={completionPct} showLabel color="#F59E0B" />
        </div>
      </div>
    </Link>
  );
}
