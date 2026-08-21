import {SmtpEmailProvider} from '@/providers/smtp-email.provider';

const sendMail = jest.fn();
const verify = jest.fn();
const createTransport = jest.fn((_options: unknown) => ({ sendMail, verify }));

jest.mock('nodemailer', () => ({
  createTransport: (options: unknown) => createTransport(options),
}));

describe('SmtpEmailProvider — multi-identity sending', () => {
  let config: { get: jest.Mock };
  let provider: SmtpEmailProvider;

  const ENV: Record<string, unknown> = {
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 587,
    SMTP_USERNAME: 'default@grammarcetamol.com',
    SMTP_PASSWORD: 'default-pass',
    SMTP_FROM_NAME: 'Grammarcetamol',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail.mockResolvedValue({ messageId: 'msg-1' });
    verify.mockResolvedValue(undefined);
    config = { get: jest.fn((key: string, fallback?: unknown) => (key in ENV ? ENV[key] : fallback)) };
    provider = new SmtpEmailProvider(config as any);
  });

  it('sends from the default identity when no identity-specific credentials are configured', async () => {
    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'Hi', html: '<p>x</p>', text: 'x', senderIdentity: 'billing' });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: '"Grammarcetamol" <default@grammarcetamol.com>' }));
  });

  it('sends from a dedicated billing identity once SMTP_BILLING_* is configured — a real, separate login, not just a From override', async () => {
    ENV.SMTP_BILLING_USERNAME = 'billing@grammarcetamol.com';
    ENV.SMTP_BILLING_PASSWORD = 'billing-pass';
    ENV.SMTP_BILLING_FROM_NAME = 'Grammarcetamol Billing';

    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'Receipt', html: '<p>x</p>', text: 'x', senderIdentity: 'billing' });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: '"Grammarcetamol Billing" <billing@grammarcetamol.com>' }));
    // A genuinely separate authenticated connection, not the default one reused.
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ auth: { user: 'billing@grammarcetamol.com', pass: 'billing-pass' } }));
  });

  it('sends from a dedicated support identity independently of billing', async () => {
    ENV.SMTP_SUPPORT_USERNAME = 'support@grammarcetamol.com';
    ENV.SMTP_SUPPORT_PASSWORD = 'support-pass';

    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'OTP', html: '<p>x</p>', text: 'x', senderIdentity: 'support' });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: '"Grammarcetamol" <support@grammarcetamol.com>' }));
  });

  it('caches and reuses one transporter per identity rather than reconnecting on every send', async () => {
    ENV.SMTP_BILLING_USERNAME = 'billing@grammarcetamol.com';
    ENV.SMTP_BILLING_PASSWORD = 'billing-pass';

    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'One', html: '<p>x</p>', text: 'x', senderIdentity: 'billing' });
    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'Two', html: '<p>x</p>', text: 'x', senderIdentity: 'billing' });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('keeps default and billing as fully independent transporters even when both are used', async () => {
    ENV.SMTP_BILLING_USERNAME = 'billing@grammarcetamol.com';
    ENV.SMTP_BILLING_PASSWORD = 'billing-pass';

    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'Default', html: '<p>x</p>', text: 'x', senderIdentity: 'default' });
    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'Billing', html: '<p>x</p>', text: 'x', senderIdentity: 'billing' });

    expect(createTransport).toHaveBeenCalledTimes(2);
  });

  it('reports failure cleanly (not a crash) when the transporter throws', async () => {
    sendMail.mockRejectedValueOnce(new Error('535 Authentication failed'));

    const result = await provider.send({ to: 'a@b.com', toName: 'A', subject: 'Hi', html: '<p>x</p>', text: 'x', senderIdentity: 'default' });

    expect(result).toEqual({ success: false, error: '535 Authentication failed' });
  });
});
