'use client';

import {useState} from 'react';
import {apiFetch, ApiError, Badge, Button, Input, Mapping, useFetch, useToast} from '@grammarcetamol/utilities';
import {classesApi, type Invitation, type InvitationStatus} from '@/lib/classes.api';
import type {Student, UserListResult} from '@/lib/students.api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

const statusVariant: Record<InvitationStatus, 'success' | 'info' | 'error'> = {
  pending: 'info',
  accepted: 'success',
  revoked: 'error',
};

export function InvitationsTab({ classId }: { classId: string }) {
  const { addToast } = useToast();
  const { data: invitations, loading, refetch } = useFetch<Invitation[]>(`/api/classes/${classId}/invitations`);
  const [email, setEmail] = useState('');
  const [negotiatedPrice, setNegotiatedPrice] = useState('');
  const [found, setFound] = useState<Student | null>(null);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);

  async function handleSearch() {
    if (!email.trim()) return;
    setSearching(true);
    setFound(null);
    try {
      const res = await apiFetch<ApiResponse<UserListResult>>(
        `/api/users?role=STUDENT&q=${encodeURIComponent(email.trim())}&limit=1`,
      );
      const student = res.data.data[0];
      if (!student) {
        addToast({ type: 'error', message: 'No student found with that email' });
      } else {
        setFound(student);
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Search failed' });
    } finally {
      setSearching(false);
    }
  }

  async function handleInvite() {
    if (!found) return;
    setInviting(true);
    try {
      await classesApi.invite(classId, found.id, negotiatedPrice ? Number(negotiatedPrice) : undefined);
      addToast({ type: 'success', message: `Invitation sent to ${found.email}` });
      setEmail('');
      setNegotiatedPrice('');
      setFound(null);
      refetch();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not send invitation' });
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 mt-6">
      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Invite a Student</h2>
        <div className="flex items-end gap-3 flex-wrap">
          <Input label="Student Email" value={email} onChange={(e) => { setEmail(e.target.value); setFound(null); }} />
          <Button variant="secondary" loading={searching} onClick={handleSearch}>Find</Button>
        </div>
        {found && (
          <div className="flex items-end gap-3 flex-wrap rounded-md border border-border p-3">
            <div className="text-sm text-[#0F172A]">
              Found: <span className="font-medium">{found.fullName ?? found.email}</span> ({found.email})
            </div>
            <Input label="Negotiated Price (optional)" value={negotiatedPrice} onChange={(e) => setNegotiatedPrice(e.target.value)} className="w-40" />
            <Button loading={inviting} onClick={handleInvite}>Send Invitation</Button>
          </div>
        )}
      </section>

      <section className="bg-surface rounded-lg border border-border p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-[#0F172A]">Invitations</h2>
        {loading ? (
          <p className="text-sm text-[#64748B]">Loading…</p>
        ) : !invitations || invitations.length === 0 ? (
          <p className="text-sm text-[#64748B]">No invitations sent yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            <Mapping array={invitations} keyExtractor={(i) => i.id}>
              {(i) => (
                <li className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="text-[#0F172A]">{i.studentId}</span>
                  <div className="flex items-center gap-3">
                    {i.negotiatedPrice != null && <span className="text-[#64748B]">₦{i.negotiatedPrice}</span>}
                    <Badge variant={statusVariant[i.status]} size="sm">{i.status}</Badge>
                  </div>
                </li>
              )}
            </Mapping>
          </ul>
        )}
      </section>
    </div>
  );
}
