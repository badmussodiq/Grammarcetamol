'use client';

import {useState} from 'react';
import {useParams, useRouter} from 'next/navigation';
import Link from 'next/link';
import {ApiError, Badge, Button, Skeleton, useFetch, useToast} from '@grammarcetamol/utilities';
import {useAuth} from '@/contexts/AuthContext';
import {classesApi, formatClassPrice, formatScheduleSummary, type InvitationPreview} from '@/lib/classes.api';

export default function InvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToast();
  const isStudent = !!user?.roles?.includes('STUDENT');

  const { data, loading, error } = useFetch<InvitationPreview>(`/api/invitations/${params.token}`);
  const [accepting, setAccepting] = useState(false);

  async function handleAccept() {
    setAccepting(true);
    try {
      const { data: result } = await classesApi.acceptInvitation(params.token);
      if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl;
        return;
      }
      addToast({ type: 'success', message: "You're in! Welcome to the class." });
      router.push(`/live-classes/${data!.class.id}`);
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not accept this invitation' });
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="max-w-md mx-auto flex flex-col gap-4">
          <Skeleton variant="rect" height={200} />
          <Skeleton variant="text" width="60%" height={32} />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6 py-10 text-center">
        <div>
          <p className="text-text-primary font-medium mb-2">This invitation link isn&apos;t valid</p>
          <p className="text-text-secondary text-sm mb-4">It may have already been used, revoked, or the link is incorrect.</p>
          <Link href="/live-classes" className="text-primary hover:underline">Browse live classes</Link>
        </div>
      </main>
    );
  }

  if (data.status !== 'pending') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6 py-10 text-center">
        <div>
          <p className="text-text-primary font-medium mb-2">
            This invitation has already been {data.status === 'accepted' ? 'accepted' : 'revoked'}
          </p>
          <Link href="/live-classes" className="text-primary hover:underline">Browse live classes</Link>
        </div>
      </main>
    );
  }

  const { class: cls } = data;
  const price = data.negotiatedPrice != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: cls.currency }).format(data.negotiatedPrice)
    : formatClassPrice(cls);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
      <div className="max-w-md w-full rounded-lg border border-border bg-surface overflow-hidden">
        <div className="aspect-video bg-background flex items-center justify-center overflow-hidden">
          {cls.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cls.coverImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-text-muted text-sm">No cover image</span>
          )}
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <Badge variant="info" size="sm" className="mb-2">You&apos;ve been invited</Badge>
            <h1 className="text-xl font-bold text-text-primary">{cls.title}</h1>
            <p className="text-text-secondary text-sm mt-1">{cls.description}</p>
          </div>
          <dl className="text-sm flex flex-col gap-1 pt-4 border-t border-border">
            <div className="flex justify-between"><dt className="text-text-secondary">Schedule</dt><dd className="text-text-primary text-right">{formatScheduleSummary(cls.schedules)}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Price</dt><dd className="text-text-primary font-semibold">{price}</dd></div>
          </dl>
          {isStudent ? (
            <Button className="w-full" loading={accepting} onClick={handleAccept}>Accept Invitation</Button>
          ) : (
            <Link href={`/login?returnUrl=/live-classes/invitations/${params.token}`}>
              <Button className="w-full">Log in to Accept</Button>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
