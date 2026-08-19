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
    case 'live-class-reminder':
      return {
        type: 'live_class',
        title: 'Class starting soon',
        message: variables.classTitle ? `"${variables.classTitle}" starts in ${variables.reminderLabel ?? 'a bit'}.` : 'A live class starts soon.',
      };
    case 'live-class-starting':
      return {
        type: 'live_class',
        title: 'Class is starting',
        message: variables.classTitle ? `"${variables.classTitle}" is starting now.` : 'Your live class is starting now.',
      };
    case 'class-ended':
      return {
        type: 'live_class',
        title: 'Class ended',
        message: variables.classTitle ? `"${variables.classTitle}" has ended.` : 'Your class has ended.',
      };
    case 'subscription-charged':
      return {
        type: 'payment',
        title: 'Subscription payment received',
        message: variables.amount && variables.currency ? `Your subscription payment of ${variables.currency} ${variables.amount} was successful.` : 'Your subscription payment was successful.',
      };
    case 'subscription-payment-failed':
      return {
        type: 'payment',
        title: 'Subscription access ended',
        message: 'A recurring payment failed and your access has ended.',
      };
    case 'announcement':
      return {
        type: 'announcement',
        title: typeof variables.title === 'string' ? variables.title : 'New announcement',
        message: typeof variables.body === 'string' ? variables.body.slice(0, 150) : 'A new announcement was published.',
      };
    default:
      return { type: 'system', title: 'Notification', message: `You have a new ${templateName.replace(/-/g, ' ')} notification.` };
  }
}
