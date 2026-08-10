import { readFileSync } from 'fs';
import { join } from 'path';
import type { EmailTemplateSeed } from './template.types';

/** Metadata only — the actual markup lives in real, individually-editable `.html`/`.txt` files
 * under `templates/files/`, not embedded as TS string literals. `_layout.html` is the one shared
 * wrapper (brand header/footer) every template's body gets dropped into at load time via simple
 * literal `{{preheader}}`/`{{body}}`/`{{year}}` substitution — deliberately NOT the same
 * `renderTemplate` regex used for real per-send variables (`{{otp}}`, `{{fullName}}`, etc.),
 * since those must survive this step untouched and only get filled in later, at actual send time. */
interface TemplateMeta {
  name: string;
  subject: string;
  variables: string[];
  /** Plain-text preview shown by email clients before the recipient opens the message. */
  preheader: string;
}

const TEMPLATE_META: TemplateMeta[] = [
  {
    name: 'email-verification-otp',
    subject: 'Verify your Grammarcetamol account',
    variables: ['fullName', 'otp', 'expiresInMinutes'],
    preheader: 'Your verification code is {{otp}}',
  },
  {
    name: 'password-reset-otp',
    subject: 'Reset your Grammarcetamol password',
    variables: ['fullName', 'otp', 'expiresInMinutes'],
    preheader: 'Your password reset code is {{otp}}',
  },
  {
    name: 'account-locked',
    subject: 'Your Grammarcetamol account has been locked',
    variables: ['fullName', 'lockDurationMinutes'],
    preheader: 'Your account was temporarily locked after several failed login attempts',
  },
  {
    name: 'course-purchase-confirmation',
    subject: "You're enrolled! Purchase confirmed",
    variables: ['fullName', 'courseTitle', 'amount', 'currency', 'reference'],
    preheader: 'Your purchase of {{courseTitle}} is confirmed',
  },
  {
    name: 'payment-receipt',
    subject: 'Your Grammarcetamol receipt',
    variables: ['fullName', 'courseTitle', 'amount', 'currency', 'reference', 'paidAt'],
    preheader: 'Receipt for your Grammarcetamol purchase',
  },
  {
    name: 'enrollment-confirmation',
    subject: "You're enrolled in {{courseTitle}}",
    variables: ['fullName', 'courseTitle'],
    preheader: "You're enrolled in {{courseTitle}}",
  },
  {
    name: 'support-ticket-submitted',
    subject: "We've received your enquiry",
    variables: ['name', 'ticketSubject', 'ticketId'],
    preheader: 'Your support enquiry has been received',
  },
  {
    name: 'support-ticket-closed',
    subject: 'Your support ticket has been resolved',
    variables: ['name', 'ticketSubject', 'ticketId'],
    preheader: 'Your support ticket has been marked as resolved',
  },
  {
    name: 'newsletter',
    subject: '{{subjectLine}}',
    variables: ['fullName', 'subjectLine', 'content'],
    preheader: '{{subjectLine}}',
  },
];

const FILES_DIR = join(__dirname, 'files');

function readTemplateFile(fileName: string): string {
  return readFileSync(join(FILES_DIR, fileName), 'utf8');
}

function loadTemplates(): EmailTemplateSeed[] {
  const layout = readTemplateFile('_layout.html');
  const year = String(new Date().getFullYear());

  return TEMPLATE_META.map((meta) => {
    const bodyHtml = readTemplateFile(`${meta.name}.html`);
    const bodyText = readTemplateFile(`${meta.name}.txt`);
    const fullHtml = layout.replace('{{preheader}}', meta.preheader).replace('{{body}}', bodyHtml).replace('{{year}}', year);

    return {
      name: meta.name,
      subject: meta.subject,
      bodyHtml: fullHtml,
      bodyText,
      variables: meta.variables,
    };
  });
}

export const TEMPLATE_SEEDS: EmailTemplateSeed[] = loadTemplates();
