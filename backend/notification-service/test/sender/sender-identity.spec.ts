import {resolveSenderIdentity} from '@/sender/sender-identity';

describe('resolveSenderIdentity', () => {
  it('routes every payment/purchase/subscription template to billing', () => {
    for (const name of [
      'course-purchase-confirmation',
      'payment-receipt',
      'enrollment-confirmation',
      'subscription-charged',
      'subscription-payment-failed',
    ]) {
      expect(resolveSenderIdentity(name)).toBe('billing');
    }
  });

  it('routes every OTP/account-security/support-ticket template to support', () => {
    for (const name of [
      'email-verification-otp',
      'password-reset-otp',
      'account-locked',
      'support-ticket-submitted',
      'support-ticket-closed',
    ]) {
      expect(resolveSenderIdentity(name)).toBe('support');
    }
  });

  it('falls back to default for every other real template, not an error', () => {
    for (const name of ['newsletter', 'live-class-reminder', 'live-class-starting', 'class-ended', 'announcement']) {
      expect(resolveSenderIdentity(name)).toBe('default');
    }
  });

  it('falls back to default for a completely unknown template name — never throws', () => {
    expect(resolveSenderIdentity('some-brand-new-template-nobody-categorized-yet')).toBe('default');
  });
});
