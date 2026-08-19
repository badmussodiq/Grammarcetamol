import {NotificationSenderService} from '@/sender/notification-sender.service';

describe('NotificationSenderService', () => {
  let config: { get: jest.Mock };
  let emailProviders: { get: jest.Mock };
  let provider: { send: jest.Mock };
  let templates: { findByName: jest.Mock };
  let logs: { append: jest.Mock };
  let notifications: { create: jest.Mock };
  let preferences: { isEnabled: jest.Mock };
  let service: NotificationSenderService;

  const activeTemplate = {
    name: 'welcome',
    subject: 'Hi {{name}}',
    bodyHtml: '<p>Hi {{name}}</p>',
    bodyText: 'Hi {{name}}',
    variables: ['name'],
    isActive: true,
  };

  beforeEach(() => {
    provider = { send: jest.fn() };
    config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };
    emailProviders = { get: jest.fn().mockReturnValue(provider) };
    templates = { findByName: jest.fn() };
    logs = { append: jest.fn().mockResolvedValue(undefined) };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };
    preferences = { isEnabled: jest.fn().mockResolvedValue(true) };
    service = new NotificationSenderService(config as any, emailProviders as any, templates as any, logs as any, notifications as any, preferences as any);
  });

  const event = { service: 'auth-service', templateName: 'welcome', to: 'a@b.com', toName: 'Jane', variables: { name: 'Jane' } };

  it('renders the template and logs a sent row on a successful send', async () => {
    templates.findByName.mockResolvedValue(activeTemplate);
    provider.send.mockResolvedValue({ success: true, messageId: 'msg-1' });

    await service.send(event);

    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.com', subject: 'Hi Jane', html: '<p>Hi Jane</p>' }));
    expect(logs.append).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent', providerMessageId: 'msg-1', error: null }));
  });

  it('logs a failed row without calling the provider when the template does not exist', async () => {
    templates.findByName.mockResolvedValue(null);

    await service.send(event);

    expect(provider.send).not.toHaveBeenCalled();
    expect(logs.append).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: expect.stringContaining('No template named') }));
  });

  it('logs a failed row without calling the provider when the template is inactive', async () => {
    templates.findByName.mockResolvedValue({ ...activeTemplate, isActive: false });

    await service.send(event);

    expect(provider.send).not.toHaveBeenCalled();
    expect(logs.append).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: expect.stringContaining('inactive') }));
  });

  it('logs a failed row when the provider returns success: false', async () => {
    templates.findByName.mockResolvedValue(activeTemplate);
    provider.send.mockResolvedValue({ success: false, error: 'SMTP timeout' });

    await service.send(event);

    expect(logs.append).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: 'SMTP timeout', providerMessageId: null }));
  });

  it('logs a failed row (not an unhandled rejection) when the provider throws', async () => {
    templates.findByName.mockResolvedValue(activeTemplate);
    provider.send.mockRejectedValue(new Error('connection refused'));

    await service.send(event);

    expect(logs.append).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: 'connection refused' }));
  });

  it('writes an in-app notification when the event carries a userId', async () => {
    templates.findByName.mockResolvedValue(activeTemplate);
    provider.send.mockResolvedValue({ success: true, messageId: 'msg-1' });

    await service.send({ ...event, userId: 'user-1' });

    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });

  it('does not write an in-app notification when the event has no userId', async () => {
    templates.findByName.mockResolvedValue(activeTemplate);
    provider.send.mockResolvedValue({ success: true, messageId: 'msg-1' });

    await service.send(event);

    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('writes the in-app notification even when the email template is unknown', async () => {
    templates.findByName.mockResolvedValue(null);

    await service.send({ ...event, userId: 'user-1' });

    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });

  it('passes the event\'s relatedId through to the in-app notification, for frontend deep-linking', async () => {
    // Regression test: this used to be hardcoded to null for every notification, which
    // silently broke click-to-navigate for live-class notifications and high-priority
    // announcements — found building Task 42.
    templates.findByName.mockResolvedValue(activeTemplate);
    provider.send.mockResolvedValue({ success: true, messageId: 'msg-1' });

    await service.send({ ...event, userId: 'user-1', relatedId: 'class-123' });

    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ relatedId: 'class-123' }));
  });

  it('defaults relatedId to null when the event does not carry one', async () => {
    templates.findByName.mockResolvedValue(activeTemplate);
    provider.send.mockResolvedValue({ success: true, messageId: 'msg-1' });

    await service.send({ ...event, userId: 'user-1' });

    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ relatedId: null }));
  });

  describe('preference gating', () => {
    it('skips the in-app write when the user opted out of the in-app channel for this type', async () => {
      templates.findByName.mockResolvedValue(activeTemplate);
      provider.send.mockResolvedValue({ success: true, messageId: 'msg-1' });
      preferences.isEnabled.mockImplementation((_userId: string, _type: string, channel: string) => Promise.resolve(channel !== 'inApp'));

      await service.send({ ...event, userId: 'user-1' });

      expect(notifications.create).not.toHaveBeenCalled();
      expect(provider.send).toHaveBeenCalled(); // email still sends independently
    });

    it('skips the email (and the log row) when the user opted out of the email channel, without touching the in-app write', async () => {
      preferences.isEnabled.mockImplementation((_userId: string, _type: string, channel: string) => Promise.resolve(channel !== 'email'));

      await service.send({ ...event, userId: 'user-1' });

      expect(provider.send).not.toHaveBeenCalled();
      expect(logs.append).not.toHaveBeenCalled();
      expect(notifications.create).toHaveBeenCalled(); // in-app still writes independently
    });

    it('never checks preferences for an event with no userId — there is nothing to look up', async () => {
      templates.findByName.mockResolvedValue(activeTemplate);
      provider.send.mockResolvedValue({ success: true, messageId: 'msg-1' });

      await service.send(event);

      expect(preferences.isEnabled).not.toHaveBeenCalled();
      expect(provider.send).toHaveBeenCalled();
    });
  });
});
