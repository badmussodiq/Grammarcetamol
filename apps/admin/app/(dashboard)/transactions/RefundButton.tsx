'use client';

import {useActionState, useEffect, useState} from 'react';
import {Button, Input, Modal} from '@grammarcetamol/utilities';
import type {RefundActionState} from './actions';
import {refundPayment} from './actions';

const INITIAL_STATE: RefundActionState = { error: null };

export function RefundButton({ paymentId, maxAmount, currency }: { paymentId: string; maxAmount: number; currency: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(refundPayment, INITIAL_STATE);

  // Close on a successful submit (no error, and not the initial untouched state).
  useEffect(() => {
    if (open && !pending && state !== INITIAL_STATE && state.error === null) {
      setOpen(false);
    }
  }, [state, pending, open]);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Refund</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Issue Refund" size="sm">
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={paymentId} />
          <Input
            label={`Amount (${currency}, up to ${maxAmount})`}
            name="amount"
            type="number"
            step="0.01"
            max={maxAmount}
            defaultValue={maxAmount}
            required
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Reason</label>
            <textarea
              name="reason"
              required
              rows={3}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-40"
            />
          </div>
          {state.error && <p className="text-sm text-error">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Confirm Refund</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
