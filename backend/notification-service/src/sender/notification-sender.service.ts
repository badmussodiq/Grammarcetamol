import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {EmailProviderRegistry} from '@/providers/email-provider.registry';
import {NotificationLogsService} from '@/notification-logs/notification-logs.service';
import {NotificationsService} from '@/notifications/notifications.service';
import {formatNotification} from '@/notifications/notification-formatter';
import {PreferencesService} from '@/preferences/preferences.service';
import {TemplatesService} from '@/templates/templates.service';
import {renderTemplate} from '@/templates/template-renderer';
import type {NotificationRequestedEvent} from '@/config/amqp.constants';

/**
 * The actual "render template, send email, write one notification_logs row regardless of
 * outcome" logic — extracted from NotificationConsumerService so SupportService can call it
 * directly (same process, no RabbitMQ round-trip needed for a request that's already an HTTP
 * call) without duplicating this logic. Never throws: every failure mode (unknown template,
 * inactive template, provider error) ends in a logged row, not an exception.
 */
@Injectable()
export class NotificationSenderService {
  private readonly logger = new Logger(NotificationSenderService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly emailProviders: EmailProviderRegistry,
    private readonly templates: TemplatesService,
    private readonly logs: NotificationLogsService,
    private readonly notifications: NotificationsService,
    private readonly preferences: PreferencesService,
  ) {}

  async send(event: NotificationRequestedEvent): Promise<void> {
    const { type, title, message } = formatNotification(event.templateName, event.variables);

    // Alongside the email — not instead of it. Independent of whether the template resolves or
    // the email provider succeeds below: the in-app notification is about the underlying event
    // (e.g. "your account was locked"), not about email delivery status. Gated on the user's
    // own preference (system-type notifications — OTP, account-locked — always pass, see
    // PreferencesService.isEnabled).
    if (event.userId && (await this.preferences.isEnabled(event.userId, type, 'inApp'))) {
      void this.notifications.create({ userId: event.userId, type, title, message, relatedId: event.relatedId ?? null });
    }

    // A user who opted out of email for this type gets no email and no log row — a
    // preference-skip is a deliberate non-attempt, not a send failure, so it doesn't belong in
    // the append-only notification_logs audit trail (which only records real attempts).
    if (event.userId && !(await this.preferences.isEnabled(event.userId, type, 'email'))) {
      return;
    }

    const template = await this.templates.findByName(event.templateName);

    if (!template) {
      await this.logs.append({
        service: event.service,
        templateName: event.templateName,
        to: event.to,
        toName: event.toName,
        status: 'failed',
        error: `No template named "${event.templateName}"`,
        providerMessageId: null,
      });
      this.logger.warn(`Unknown template "${event.templateName}" requested by ${event.service}`);
      return;
    }

    if (!template.isActive) {
      await this.logs.append({
        service: event.service,
        templateName: event.templateName,
        to: event.to,
        toName: event.toName,
        status: 'failed',
        error: `Template "${event.templateName}" is inactive`,
        providerMessageId: null,
      });
      return;
    }

    const subject = renderTemplate(template.subject, event.variables);
    const html = renderTemplate(template.bodyHtml, event.variables);
    const text = renderTemplate(template.bodyText, event.variables);

    let result;
    try {
      const provider = this.emailProviders.get(this.config.get<string>('EMAIL_PROVIDER', 'log'));
      result = await provider.send({ to: event.to, toName: event.toName, subject, html, text });
    } catch (err) {
      result = { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    await this.logs.append({
      service: event.service,
      templateName: event.templateName,
      to: event.to,
      toName: event.toName,
      status: result.success ? 'sent' : 'failed',
      error: result.success ? null : (result.error ?? 'Unknown provider error'),
      providerMessageId: result.success ? (result.messageId ?? null) : null,
    });
  }
}
