import {cookies} from 'next/headers';
import Link from 'next/link';
import {Badge, Button, Mapping} from '@grammarcetamol/utilities';
import {archiveCourse, deleteCourse} from './actions';
import type {Category, Course, Paged} from '@/lib/courses.api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
const PAGE_SIZE = 20;

async function authHeaders(): Promise<Record<string, string>> {
  const accessToken = (await cookies()).get('access_token')?.value;
  return accessToken ? { Cookie: `access_token=${accessToken}` } : {};
}

async function fetchCourses(status: string, category: string, page: number): Promise<Paged<Course> | null> {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (status) params.set('status', status);
  if (category) params.set('category', category);

  try {
    const res = await fetch(`${API_URL}/api/courses?${params.toString()}`, {
      headers: await authHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('fetchCourses non-ok response:', res.status, await res.text());
      return null;
    }
    const body = await res.json();
    return body.data as Paged<Course>;
  } catch (err) {
    console.error('fetchCourses threw:', err);
    return null;
  }
}

async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_URL}/api/categories`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = await res.json();
    return body.data as Category[];
  } catch {
    return [];
  }
}

const statusVariant: Record<Course['status'], 'success' | 'warning' | 'neutral' | 'info'> = {
  published: 'success',
  draft: 'neutral',
  review: 'warning',
  archived: 'info',
};

function formatPrice(course: Course): string {
  if (course.price === 0) return 'Free';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: course.currency }).format(course.price);
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; page?: string }>;
}) {
  const resolved = await searchParams;
  const status = resolved.status ?? '';
  const category = resolved.category ?? '';
  const page = Number(resolved.page ?? '1') || 1;

  const [result, categories] = await Promise.all([fetchCourses(status, category, page), fetchCategories()]);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  console.log("result", result)

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Courses</h1>
            <p className="text-[#64748B] mt-1 text-sm">Create and manage the course catalog.</p>
          </div>
          <Link href="/courses/create">
            <Button>+ Create Course</Button>
          </Link>
        </div>

        <form action="/courses" className="flex gap-3 mb-4">
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-border px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <select
            name="category"
            defaultValue={category}
            className="rounded-md border border-border px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
          >
            <option value="">All categories</option>
            <Mapping array={categories} keyExtractor={(c) => c.id}>
              {(c) => <option value={c.slug}>{c.name}</option>}
            </Mapping>
          </select>
          <Button type="submit" variant="secondary" size="sm">Filter</Button>
        </form>

        {!result ? (
          <div className="bg-surface rounded-lg border border-border p-8 text-center text-[#64748B]">
            Couldn&apos;t load courses — your session may have expired. Try refreshing the page.
          </div>
        ) : result.items.length === 0 ? (
          <div className="bg-surface rounded-lg border border-border p-8 text-center text-[#64748B]">
            No courses found.
          </div>
        ) : (
          <div className="bg-surface rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-background text-left text-xs font-semibold text-[#64748B] uppercase">
                <tr>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                <Mapping array={result.items} keyExtractor={(c) => c.id} wrapper={false}>
                  {(c) => (
                    <tr className="border-t border-border">
                      <td className="px-4 py-3">
                        <Link href={`/courses/${c.id}`} className="flex items-center gap-3 hover:underline">
                          <div className="w-14 h-9 rounded bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center text-[10px] text-[#94A3B8]">
                            {c.coverImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.coverImageUrl} alt="" className="w-full h-full object-cover" />
                            ) : 'No image'}
                          </div>
                          <span className="text-[#0F172A] font-medium">{c.title}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{c.categoryId ? categoryName.get(c.categoryId) ?? '—' : '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[c.status]} size="sm">{c.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[#0F172A]">{formatPrice(c)}</td>
                      <td className="px-4 py-3 text-[#64748B]">{c.enrollmentCount}</td>
                      <td className="px-4 py-3 text-[#64748B]">{c.avgRating != null ? `★ ${c.avgRating.toFixed(1)}` : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {c.status !== 'archived' && (
                            <form action={archiveCourse}>
                              <input type="hidden" name="id" value={c.id} />
                              <Button type="submit" variant="ghost" size="sm">Archive</Button>
                            </form>
                          )}
                          <form action={deleteCourse}>
                            <input type="hidden" name="id" value={c.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              disabled={c.enrollmentCount > 0}
                              title={c.enrollmentCount > 0 ? 'Cannot delete a course with active enrollments — archive it instead' : undefined}
                            >
                              Delete
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )}
                </Mapping>
              </tbody>
            </table>
          </div>
        )}

        {result && result.total > PAGE_SIZE && (
          <div className="flex justify-between items-center mt-4 text-sm text-[#64748B]">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, result.total)} of {result.total}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/courses?status=${status}&category=${category}&page=${page - 1}`} className="text-accent hover:underline">
                  Previous
                </Link>
              )}
              {page * PAGE_SIZE < result.total && (
                <Link href={`/courses?status=${status}&category=${category}&page=${page + 1}`} className="text-accent hover:underline">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
