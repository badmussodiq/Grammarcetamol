'use client';

import { Suspense, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button, Skeleton, useFetch, useToast, ApiError } from '@grammarcetamol/utilities';
import { supportApi, type SupportTicket } from '@/lib/support.api';

export default function SupportTicketDetailPage() {
  return (
    <Suspense>
      <SupportTicketDetailShell />
    </Suspense>
  );
}

function SupportTicketDetailShell() {
  const params = useParams<{ id: string }>();
  const { addToast } = useToast();
  const { data: ticket, loading, error, refetch } = useFetch<SupportTicket>(`/api/support/tickets/${params.id}`);
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    if (!ticket) return;
    setClosing(true);
    try {
      await supportApi.close(ticket._id);
      addToast({ type: 'success', message: 'Ticket closed — submitter has been notified by email.' });
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed to close ticket' });
    } finally {
      setClosing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          <Skeleton variant="text" width="40%" height={28} />
          <Skeleton variant="rect" height={200} />
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-background p-8 text-center">
        <p className="text-[#64748B] mb-2">Couldn&apos;t load this support ticket.</p>
        <Link href="/support" className="text-accent hover:underline">Back to Support</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/support" className="text-sm text-accent hover:underline">← Back to Support</Link>

        <div className="bg-surface rounded-lg border border-border p-6 mt-3 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#0F172A]">{ticket.subject}</h1>
              <p className="text-sm text-[#64748B] mt-1">
                From <span className="font-medium text-[#0F172A]">{ticket.name}</span> — reply directly to{' '}
                <a href={`mailto:${ticket.email}`} className="text-primary hover:underline">{ticket.email}</a>
              </p>
            </div>
            <Badge variant={ticket.status === 'open' ? 'warning' : 'success'}>{ticket.status}</Badge>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-4">
            <div><dt className="text-[#64748B]">Submitted</dt><dd className="text-[#0F172A]">{new Date(ticket.createdAt).toLocaleString()}</dd></div>
            <div><dt className="text-[#64748B]">Submitter type</dt><dd className="text-[#0F172A]">{ticket.userId ? 'Logged-in student' : 'Guest'}</dd></div>
            {ticket.closedAt && (
              <div><dt className="text-[#64748B]">Closed</dt><dd className="text-[#0F172A]">{new Date(ticket.closedAt).toLocaleString()}</dd></div>
            )}
          </dl>

          <div className="border-t border-border pt-4">
            <p className="text-sm text-[#64748B] mb-1">Message</p>
            <p className="text-[#0F172A] whitespace-pre-line">{ticket.message}</p>
          </div>

          {ticket.status === 'open' && (
            <div className="border-t border-border pt-4">
              <Button loading={closing} onClick={handleClose}>Close Ticket</Button>
              <p className="text-xs text-[#64748B] mt-2">
                Reply to the submitter via your own email client first — closing just marks this resolved and sends a closing confirmation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
