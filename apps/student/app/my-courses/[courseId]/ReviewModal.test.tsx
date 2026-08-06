/**
 * Component test for ReviewModal. Mocks reviewsApi at the module boundary (unlike the
 * sibling reviews.api.integration.test.ts, which mocks only fetch and exercises the real
 * API client) so this stays focused on rendering/interaction: create vs. edit mode,
 * validation, and — the reason this file exists — a real regression test for the pre-fill
 * bug found and fixed this session (see PLAN.md Task 25's update note): the modal is
 * mounted once by its parent and toggled via `open`, so its useState initial values alone
 * don't pick up `existingReview` arriving asynchronously after mount.
 */
import type { ReactElement } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider } from '@grammarcetamol/utilities';
import { ReviewModal } from './ReviewModal';
import { reviewsApi, type Review } from '@/lib/reviews.api';

vi.mock('@/lib/reviews.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/reviews.api')>();
  return {
    ...actual,
    reviewsApi: {
      create: vi.fn(),
      update: vi.fn(),
      mine: vi.fn(),
    },
  };
});

function renderWithProviders(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

function review(overrides: Partial<Review> = {}): Review {
  return {
    id: 'review-1',
    userId: 'u1',
    courseId: 'course-1',
    enrollmentId: 'e1',
    rating: 4,
    title: 'Pretty good',
    comment: 'Learned a lot.',
    status: 'approved',
    edited: false,
    editedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ReviewModal', () => {
  beforeEach(() => {
    vi.mocked(reviewsApi.create).mockReset().mockResolvedValue({ success: true, data: review(), error: null, timestamp: '' });
    vi.mocked(reviewsApi.update).mockReset().mockResolvedValue({ success: true, data: review(), error: null, timestamp: '' });
  });

  it('shows "Leave a Review" with an empty form when there is no existing review', () => {
    renderWithProviders(<ReviewModal open courseId="course-1" existingReview={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText('Leave a Review')).toBeTruthy();
    expect(screen.getByLabelText('Title (optional)')).toHaveProperty('value', '');
  });

  it('shows "Edit Your Review" pre-filled when an existing review is passed in from the start', () => {
    renderWithProviders(
      <ReviewModal open courseId="course-1" existingReview={review({ title: 'Great stuff' })} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(screen.getByText('Edit Your Review')).toBeTruthy();
    expect(screen.getByLabelText('Title (optional)')).toHaveProperty('value', 'Great stuff');
  });

  it('regression: re-syncs to the loaded review when it arrives after the modal is already open', () => {
    // Mirrors the real bug: parent mounts ReviewModal with existingReview={null} while its
    // own GET /api/reviews/mine is still in flight, then re-renders with the real review once
    // it resolves — all while `open` stays true throughout, so the component never remounts.
    const { rerender } = renderWithProviders(
      <ReviewModal open courseId="course-1" existingReview={null} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(screen.getByText('Leave a Review')).toBeTruthy();

    rerender(
      <ToastProvider>
        <ReviewModal open courseId="course-1" existingReview={review({ title: 'Arrived late' })} onClose={vi.fn()} onSaved={vi.fn()} />
      </ToastProvider>,
    );

    expect(screen.getByText('Edit Your Review')).toBeTruthy();
    expect(screen.getByLabelText('Title (optional)')).toHaveProperty('value', 'Arrived late');
  });

  it('blocks submission with no rating chosen and does not call the API', () => {
    const onSaved = vi.fn();
    renderWithProviders(<ReviewModal open courseId="course-1" existingReview={null} onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.click(screen.getByText('Submit Review'));

    expect(reviewsApi.create).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('create mode — picking a rating and submitting calls reviewsApi.create with the right body', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(<ReviewModal open courseId="course-1" existingReview={null} onClose={onClose} onSaved={onSaved} />);

    fireEvent.click(screen.getByLabelText('4 stars'));
    fireEvent.change(screen.getByLabelText('Title (optional)'), { target: { value: 'Nice course' } });
    fireEvent.click(screen.getByText('Submit Review'));

    await vi.waitFor(() => expect(reviewsApi.create).toHaveBeenCalledWith({ courseId: 'course-1', rating: 4, title: 'Nice course', comment: undefined }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('edit mode — submitting calls reviewsApi.update with the existing review id, not create', async () => {
    const existing = review({ id: 'review-42', rating: 3 });
    renderWithProviders(<ReviewModal open courseId="course-1" existingReview={existing} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('5 stars'));
    fireEvent.click(screen.getByText('Save Changes'));

    await vi.waitFor(() => expect(reviewsApi.update).toHaveBeenCalledWith('review-42', { rating: 5, title: 'Pretty good', comment: 'Learned a lot.' }));
    expect(reviewsApi.create).not.toHaveBeenCalled();
  });
});
