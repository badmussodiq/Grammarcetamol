import type {NotificationType} from './notification.types';

/** Maps an email templateName (the generic {service, templateName, ...} event shape every
 * publisher already sends) to the {type, title, message} shown in the in-app inbox. Deliberately
 * separate from the email template system (templates.service.ts) — those render full HTML/text
 * bodies from files; this produces a short one-line summary for a notification list item.
 * Any templateName not listed here still gets a row (falls through to the generic case) rather
 * than being silently dropped — an unrecognized template shouldn't mean "no notification". */
export function formatNotification(templateName: string, variables: Record<string, unknown>): { type: NotificationType; title: string; message: string } {
  switch (templateName) {
    case 'email-verification-otp':
      return { type: 'system', title: 'Verify your email', message: 'A verification code was sent to your email address.' };
    case 'password-reset-otp':
      return { type: 'system', title: 'Password reset requested', message: 'A password reset code was sent to your email address.' };
    case 'account-locked':
      return { type: 'system', title: 'Account locked', message: 'Your account was temporarily locked after multiple failed login attempts.' };
    case 'course-purchase-confirmation':
      return {
        type: 'course',
        title: 'Course purchase confirmed',
        message: variables.courseTitle ? `You're enrolled in "${variables.courseTitle}".` : 'Your course purchase was confirmed.',
      };
    case 'payment-receipt':
      return {
        type: 'payment',
        title: 'Payment received',
        message: variables.amount && variables.currency ? `Payment of ${variables.currency} ${variables.amount} was received.` : 'A payment was received.',
      };
    default:
      return { type: 'system', title: 'Notification', message: `You have a new ${templateName.replace(/-/g, ' ')} notification.` };
  }
}
