import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {createTransport, type Transporter} from 'nodemailer';
import type {SenderIdentity} from '@/sender/sender-identity';
import type {EmailProvider, SendEmailInput, SendEmailResult} from './email-provider.interface';

interface IdentityConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromName: string;
}

/**
 * Real SMTP delivery via nodemailer — activated by setting EMAIL_PROVIDER=smtp (see
 * EmailProviderRegistry). Works with any standard SMTP host, not just Gmail; only the .env
 * values change to switch providers later (SendGrid/SES/Mailgun all offer SMTP endpoints too),
 * same zero-call-site-change guarantee as PaymentProvider/StorageProvider always had.
 *
 * Supports up to three SEPARATE SMTP logins — 'default', 'billing', 'support' — one real
 * transporter (and one real authenticated connection) per identity, not one shared
 * connection with a spoofed "From" header. Most SMTP providers, Gmail included, reject or
 * flag a From address that isn't the authenticated account or a verified alias of it, so
 * sending "as" billing@yourdomain.com genuinely requires logging in as billing@yourdomain.com
 * — there's no way around a real, separate credential per identity that wants its own
 * address. Each identity's SMTP_<IDENTITY>_* env vars are optional; unset falls back to
 * the 'default' identity's own SMTP_HOST/PORT/USERNAME/PASSWORD/FROM_NAME, so a deployment
 * that hasn't set up billing@/support@ mailboxes yet keeps working exactly as before —
 * every email just goes out from the one default account, same as this project's original,
 * single-identity behavior.
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider, OnApplicationBootstrap {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private readonly transporters = new Map<SenderIdentity, Transporter>();

  constructor(private readonly config: ConfigService) {}

  /** Verifies the connection once at boot rather than on every send — a bad credential should
   * surface immediately in the logs, not silently on the first real email someone tries to
   * trigger. Doesn't crash the service if verification fails (SMTP might be transiently down);
   * send() below still tries per-message and logs its own failure into notification_logs. */
  async onApplicationBootstrap(): Promise<void> {
    // Only actually connect if this provider is the active one — no point holding SMTP
    // connections open (or failing startup on bad creds) when EMAIL_PROVIDER=log is what's
    // configured; the registry still constructs every registered provider regardless of which
    // one is active, so this guard is what keeps an inactive provider inert.
    if (this.config.get<string>('EMAIL_PROVIDER', 'log') !== this.name) return;

    // Only verify identities that are ACTUALLY distinct logins — if billing/support fall
    // back to the default identity's own credentials (unset SMTP_BILLING_*/SMTP_SUPPORT_*),
    // there's nothing new to verify; verifying 'default' once already covers them.
    for (const identity of this.configuredIdentities()) {
      const transporter = this.getTransporter(identity);
      try {
        await transporter.verify();
        this.logger.log(`SMTP connection verified for '${identity}' identity (${this.identityConfig(identity).host})`);
      } catch (err) {
        this.logger.error(`SMTP connection could not be verified for '${identity}' identity: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /** Which identities have their OWN distinct credentials configured, beyond 'default' —
   * used only to decide what's worth separately verifying/logging at boot. */
  private configuredIdentities(): SenderIdentity[] {
    const identities: SenderIdentity[] = ['default'];
    if (this.config.get<string>('SMTP_BILLING_USERNAME')) identities.push('billing');
    if (this.config.get<string>('SMTP_SUPPORT_USERNAME')) identities.push('support');
    return identities;
  }

  private identityConfig(identity: SenderIdentity): IdentityConfig {
    const prefix = identity === 'default' ? 'SMTP' : `SMTP_${identity.toUpperCase()}`;
    // '' counts as unset here, not a real value — docker-compose.yml's ${VAR:-} defaulting
    // produces an empty string (not undefined) for any identity var nobody configured, and
    // that empty string must still fall back to the shared SMTP_* default, not blank out host/auth.
    const str = (key: string, fallback: string) => this.config.get<string>(key) || fallback;
    const num = (key: string, fallback: number) => this.config.get<number>(key) || fallback;
    return {
      host: str(`${prefix}_HOST`, str('SMTP_HOST', '')),
      port: num(`${prefix}_PORT`, num('SMTP_PORT', 587)),
      username: str(`${prefix}_USERNAME`, str('SMTP_USERNAME', '')),
      password: str(`${prefix}_PASSWORD`, str('SMTP_PASSWORD', '')),
      fromName: str(`${prefix}_FROM_NAME`, str('SMTP_FROM_NAME', 'Grammarcetamol')),
    };
  }

  private getTransporter(identity: SenderIdentity): Transporter {
    const cached = this.transporters.get(identity);
    if (cached) return cached;

    const { host, port, username, password } = this.identityConfig(identity);
    const transporter = createTransport({
      host,
      port,
      // 587 is STARTTLS (secure:false, upgraded after connect); 465 is implicit TLS
      // (secure:true). Deriving this from the port avoids a separate SMTP_SECURE env var that
      // could be set inconsistently with the port.
      secure: port === 465,
      auth: { user: username, pass: password },
    });
    this.transporters.set(identity, transporter);
    return transporter;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const transporter = this.getTransporter(input.senderIdentity);
    const { username, fromName } = this.identityConfig(input.senderIdentity);

    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${username}>`,
        to: `"${input.toName}" <${input.to}>`,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return { success: true, messageId: info.messageId, raw: info };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
