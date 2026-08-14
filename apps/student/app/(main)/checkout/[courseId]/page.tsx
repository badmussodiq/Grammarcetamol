'use client';

import {useEffect, useRef, useState} from 'react';
import {useParams, useRouter} from 'next/navigation';
import Link from 'next/link';
import {ApiError, Button, Input, Skeleton, useFetch, useToast} from '@grammarcetamol/utilities';
import {useAuth} from '@/contexts/AuthContext';
import type {CourseDetailResponse} from '@/lib/course.api';
import {checkoutApi, toPaystackSubunit} from '@/lib/checkout.api';
import {enrollmentApi, hasEnrollmentFor} from '@/lib/enrollment.api';

declare global {
  interface Window {
    PaystackPop?: {
      setup(options: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        onSuccess: (transaction: { reference: string }) => void;
        onClose: () => void;
      }): { openIframe: () => void };
    };
  }
}

const PAYSTACK_SCRIPT_SRC = 'https://js.paystack.co/v1/inline.js';

function usePaystackScript(): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.PaystackPop) {
      setLoaded(true);
      return;
    }
    const existing = document.querySelector(`script[src="${PAYSTACK_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => setLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.src = PAYSTACK_SCRIPT_SRC;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);
  }, []);

  return loaded;
}

function formatPrice(amount: string, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount));
}

type Phase = 'form' | 'processing' | 'confirming' | 'success' | 'failed';

export default function CheckoutPage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToast();
  const paystackReady = usePaystackScript();

  const { data, loading, error } = useFetch<CourseDetailResponse>(`/api/courses/${params.courseId}`);
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [failureReason, setFailureReason] = useState('');
  const emailInitialized = useRef(false);

  useEffect(() => {
    if (user?.email && !emailInitialized.current) {
      setEmail(user.email);
      emailInitialized.current = true;
    }
  }, [user]);

  // Free courses don't use checkout — the course detail page enrolls directly. Anyone landing
  // here for a free course (stale link, back-button after a price change) gets sent back.
  useEffect(() => {
    if (data && data.course.price === 0) {
      router.replace(`/courses/${data.course.slug}`);
    }
  }, [data, router]);

  async function handlePay() {
    if (!data) return;
    if (!email.trim()) {
      addToast({ type: 'error', message: 'Enter an email address to continue' });
      return;
    }
    if (!paystackReady || !window.PaystackPop) {
      addToast({ type: 'error', message: 'Payment provider is still loading — try again in a moment' });
      return;
    }

    setPhase('processing');
    try {
      const { data: init } = await checkoutApi.initialize(data.course.id, email.trim());
      window.PaystackPop.setup({
        key: init.publicKey,
        email: email.trim(),
        amount: toPaystackSubunit(init.amount),
        currency: init.currency,
        ref: init.reference,
        onSuccess: (transaction) => void handlePaystackSuccess(transaction.reference, data.course.id),
        onClose: () => setPhase('form'),
      }).openIframe();
    } catch (err) {
      setPhase('failed');
      setFailureReason(err instanceof ApiError ? err.message : 'Could not start checkout');
    }
  }

  async function handlePaystackSuccess(reference: string, courseId: string) {
    setPhase('confirming');
    try {
      await checkoutApi.confirm(reference);
    } catch {
      // The webhook is the durable source of truth even if this client-side confirm call fails —
      // keep polling for the enrollment rather than treating this as a hard failure.
    }

    for (let attempt = 0; attempt < 8; attempt++) {
      const { data: enrollments } = await enrollmentApi.getMyEnrollments();
      if (hasEnrollmentFor(enrollments, courseId)) break;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    setPhase('success');
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton variant="rect" height={200} />
          <Skeleton variant="rect" height={280} />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6 py-10 text-center">
        <div>
          <p className="text-text-primary font-medium mb-2">Course not found</p>
          <Link href="/courses" className="text-primary hover:underline">Back to all courses</Link>
        </div>
      </main>
    );
  }

  const { course } = data;

  if (phase === 'success') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
        <div className="max-w-md w-full text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center text-3xl">✓</div>
          <h1 className="text-2xl font-bold text-text-primary">Payment successful!</h1>
          <p className="text-text-secondary">You&apos;re enrolled in <strong>{course.title}</strong>. A confirmation has been sent to {email}.</p>
          <div className="flex flex-col gap-3 w-full mt-4">
            <Link href={`/my-courses/${course.id}`}><Button className="w-full">Start Learning Now</Button></Link>
            <Link href="/dashboard"><Button variant="secondary" className="w-full">Go to Dashboard</Button></Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-text-primary">Order summary</h1>
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="aspect-video bg-background flex items-center justify-center">
              {course.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.coverImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-text-muted text-sm">No cover image</span>
              )}
            </div>
            <div className="p-4 flex flex-col gap-1">
              <p className="font-semibold text-text-primary">{course.title}</p>
              <p className="text-sm text-text-secondary">by {course.instructorName}</p>
            </div>
          </div>
          <dl className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-text-secondary">Subtotal</dt><dd>{formatPrice(String(course.price), course.currency)}</dd></div>
            {course.discountPrice != null && course.discountPrice < course.price && (
              <div className="flex justify-between text-success">
                <dt>Discount</dt>
                <dd>-{formatPrice(String(course.price - course.discountPrice), course.currency)}</dd>
              </div>
            )}
            <div className="flex justify-between font-semibold text-text-primary pt-2 border-t border-border">
              <dt>Total</dt>
              <dd>{formatPrice(String(course.discountPrice ?? course.price), course.currency)}</dd>
            </div>
          </dl>
        </section>

        <section className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-text-primary">Your details</h1>
          <div className="rounded-lg border border-border bg-surface p-6 flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={phase !== 'form'}
            />
            {phase === 'failed' && (
              <p className="text-sm text-error">{failureReason} — try again.</p>
            )}
            <Button
              className="w-full"
              size="lg"
              loading={phase === 'processing' || phase === 'confirming'}
              onClick={handlePay}
            >
              {phase === 'confirming' ? 'Confirming payment…' : `Pay ${formatPrice(String(course.discountPrice ?? course.price), course.currency)}`}
            </Button>
            <p className="text-xs text-text-muted text-center">
              Payment is handled securely by Paystack — we never see your card details.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
