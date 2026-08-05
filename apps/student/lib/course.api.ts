export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  parentId: string | null;
  sortOrder: number;
}

export interface Course {
  id: string;
  slug: string;
  instructorId: string;
  instructorName: string;
  instructorBio: string | null;
  instructorAvatarUrl: string | null;
  title: string;
  subtitle: string | null;
  description: string;
  learningObjectives: string[];
  targetAudience: string | null;
  prerequisites: string | null;
  categoryId: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  estimatedDuration: number | null;
  status: 'draft' | 'review' | 'published' | 'archived';
  price: number;
  discountPrice: number | null;
  currency: string;
  coverImageUrl: string | null;
  promoVideoUrl: string | null;
  enrollmentCount: number;
  avgRating: number | null;
  reviewCount: number;
  publishedAt: string | null;
}

export interface LessonResponse {
  id: string;
  title: string;
  description: string | null;
  type: 'video' | 'text' | 'quiz' | 'resource';
  duration: number | null;
  position: number;
  videoUrl: string | null;
  preview: boolean;
  published: boolean;
}

export interface ModuleResponse {
  id: string;
  title: string;
  description: string | null;
  position: number;
  published: boolean;
  lessons: LessonResponse[];
}

export interface CourseDetailResponse {
  course: Course;
  modules: ModuleResponse[];
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type PriceFilter = 'free' | 'paid' | null;
export type SortOption = 'newest' | 'price_low' | 'price_high' | 'rating' | 'popular';

export interface CourseFilters {
  category: string | null;
  difficulty: Course['difficulty'] | null;
  price: PriceFilter;
  q: string;
  sort: SortOption;
  page: number;
}

export const DEFAULT_FILTERS: CourseFilters = {
  category: null,
  difficulty: null,
  price: null,
  q: '',
  sort: 'newest',
  page: 1,
};

/** Pure and independently testable — turns filter state into the /api/courses query string. */
export function buildCourseQuery(filters: CourseFilters, limit = 12): string {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.difficulty) params.set('difficulty', filters.difficulty);
  if (filters.price) params.set('price', filters.price);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  params.set('page', String(filters.page));
  params.set('limit', String(limit));
  return params.toString();
}

/** Inverse of buildCourseQuery — reconstructs filter state from a URLSearchParams (page load / back button). */
export function filtersFromSearchParams(params: URLSearchParams): CourseFilters {
  const difficulty = params.get('difficulty');
  const price = params.get('price');
  const sort = params.get('sort');
  return {
    category: params.get('category'),
    difficulty: difficulty === 'beginner' || difficulty === 'intermediate' || difficulty === 'advanced' ? difficulty : null,
    price: price === 'free' || price === 'paid' ? price : null,
    q: params.get('q') ?? '',
    sort: sort === 'price_low' || sort === 'price_high' || sort === 'rating' || sort === 'popular' ? sort : 'newest',
    page: Number(params.get('page') ?? '1') || 1,
  };
}
