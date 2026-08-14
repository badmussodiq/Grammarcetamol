'use client';

import {useEffect, useState} from 'react';
import {ApiError, Button, Input, Modal, useToast} from '@grammarcetamol/utilities';
import {type Review, reviewsApi} from '@/lib/reviews.api';

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          onClick={() => onChange(star)}
          className={star <= value ? 'text-accent' : 'text-border'}
          style={{ fontSize: 28, lineHeight: 1 }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function ReviewModal({
  open,
  onClose,
  courseId,
  existingReview,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  existingReview: Review | null;
  onSaved: () => void;
}) {
  const { addToast } = useToast();
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [title, setTitle] = useState(existingReview?.title ?? '');
  const [comment, setComment] = useState(existingReview?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);

  // ReviewModal is mounted once by the parent and toggled via `open`, not remounted per review —
  // useState's initial value alone won't pick up `existingReview` if it finishes loading (or
  // changes) after mount. Re-sync whenever the modal opens so it always reflects current data.
  useEffect(() => {
    if (open) {
      setRating(existingReview?.rating ?? 0);
      setTitle(existingReview?.title ?? '');
      setComment(existingReview?.comment ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingReview]);

  async function handleSubmit() {
    if (rating < 1) {
      addToast({ type: 'error', message: 'Choose a star rating' });
      return;
    }
    setSubmitting(true);
    try {
      const body = { rating, title: title.trim() || undefined, comment: comment.trim() || undefined };
      if (existingReview) {
        await reviewsApi.update(existingReview.id, body);
        addToast({ type: 'success', message: 'Review updated.' });
      } else {
        await reviewsApi.create({ courseId, ...body });
        addToast({ type: 'success', message: "Review submitted — it'll appear once approved." });
      }
      onSaved();
      onClose();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not save review' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={existingReview ? 'Edit Your Review' : 'Leave a Review'} size="sm">
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Rating</label>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <Input label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Comment (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={submitting} onClick={handleSubmit}>
            {existingReview ? 'Save Changes' : 'Submit Review'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
