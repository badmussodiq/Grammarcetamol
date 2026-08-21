import {SmtpEmailProvider} from '@/providers/smtp-email.provider';

const sendMail = jest.fn();
const verify = jest.fn();
const createTransport = jest.fn((_options: unknown) => ({ sendMail, verify }));

jest.mock('nodemailer', () => ({
  createTransport: (options: unknown) => createTransport(options),
}));

describe('SmtpEmailProvider — one login, per-identity From address', () => {
  let config: { get: jest.Mock };
  let provider: SmtpEmailProvider;

  const ENV: Record<string, unknown> = {
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.go54mail.com',
    SMTP_PORT: 587,
    SMTP_USERNAME: 'monsurah.oladejo-badmus@grammarcetamol.com',
    SMTP_PASSWORD: 'real-mailbox-pass',
    SMTP_FROM_ADDRESS: 'support@grammarcetamol.com',
    SMTP_FROM_NAME: 'Grammarcetamol Support',
  };

  const BASE_ENV = { ...ENV };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(ENV).forEach((key) => delete ENV[key]);
    Object.assign(ENV, BASE_ENV);
    sendMail.mockResolvedValue({ messageId: 'msg-1' });
    verify.mockResolvedValue(undefined);
    config = { get: jest.fn((key: string, fallback?: unknown) => (key in ENV ? ENV[key] : fallback)) };
    provider = new SmtpEmailProvider(config as any);
  });

  it('sends every identity through the one authenticated login, not a per-identity credential', async () => {
    ENV.SMTP_BILLING_FROM_ADDRESS = 'billing@grammarcetamol.com';
    ENV.SMTP_BILLING_FROM_NAME = 'Grammarcetamol Billing';

    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'Receipt', html: '<p>x</p>', text: 'x', senderIdentity: 'billing' });
    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'OTP', html: '<p>x</p>', text: 'x', senderIdentity: 'support' });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: 'monsurah.oladejo-badmus@grammarcetamol.com', pass: 'real-mailbox-pass' } }),
    );
  });

  it('sets From to the billing alias for a billing-identity send', async () => {
    ENV.SMTP_BILLING_FROM_ADDRESS = 'billing@grammarcetamol.com';
    ENV.SMTP_BILLING_FROM_NAME = 'Grammarcetamol Billing';

    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'Receipt', html: '<p>x</p>', text: 'x', senderIdentity: 'billing' });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: '"Grammarcetamol Billing" <billing@grammarcetamol.com>' }));
  });

  it('falls back to the default From address for billing when no billing alias is configured', async () => {
    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'Receipt', html: '<p>x</p>', text: 'x', senderIdentity: 'billing' });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: '"Grammarcetamol Support" <support@grammarcetamol.com>' }));
  });

  it('uses the support/default From address for an uncategorized template', async () => {
    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'Welcome', html: '<p>x</p>', text: 'x', senderIdentity: 'default' });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: '"Grammarcetamol Support" <support@grammarcetamol.com>' }));
  });

  it('falls back to SMTP_USERNAME as the From address when SMTP_FROM_ADDRESS is unset', async () => {
    delete ENV.SMTP_FROM_ADDRESS;

    await provider.send({ to: 'a@b.com', toName: 'A', subject: 'Welcome', html: '<p>x</p>', text: 'x', senderIdentity: 'default' });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: '"Grammarcetamol Support" <monsurah.oladejo-badmus@grammarcetamol.com>' }));
  });

  it('reports failure cleanly (not a crash) when the transporter throws', async () => {
    sendMail.mockRejectedValueOnce(new Error('535 Authentication failed'));

    const result = await provider.send({ to: 'a@b.com', toName: 'A', subject: 'Hi', html: '<p>x</p>', text: 'x', senderIdentity: 'default' });

    expect(result).toEqual({ success: false, error: '535 Authentication failed' });
  });
});
