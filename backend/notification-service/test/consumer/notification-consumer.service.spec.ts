import {NotificationConsumerService} from '@/consumer/notification-consumer.service';

describe('NotificationConsumerService — routing (both exchanges)', () => {
  let channel: { assertQueue: jest.Mock; bindQueue: jest.Mock; consume: jest.Mock; ack: jest.Mock; nack: jest.Mock };
  let sender: { send: jest.Mock };
  let service: NotificationConsumerService;

  beforeEach(() => {
    channel = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
      nack: jest.fn(),
    };
    sender = { send: jest.fn().mockResolvedValue(undefined) };
    service = new NotificationConsumerService(channel as any, sender as any);
  });

  it('binds all four domain queues, including the new liveclass.exchange (Task 40)', async () => {
    await service.onApplicationBootstrap();

    const bound = channel.bindQueue.mock.calls.map(([queue, exchange, routingKey]) => ({ queue, exchange, routingKey }));
    expect(bound).toEqual(
      expect.arrayContaining([
        { queue: 'notification-service.user.queue', exchange: 'user.exchange', routingKey: 'user.notification' },
        { queue: 'notification-service.payment.queue', exchange: 'payment.exchange', routingKey: 'payment.notification' },
        { queue: 'notification-service.enrollment.queue', exchange: 'enrollment.exchange', routingKey: 'enrollment.notification' },
        { queue: 'notification-service.liveclass.queue', exchange: 'liveclass.exchange', routingKey: 'liveclass.notification' },
      ]),
    );
    expect(bound).toHaveLength(4);
  });

  it('dispatches a parsed message to the sender and acks it', async () => {
    await service.onApplicationBootstrap();
    const handler = channel.consume.mock.calls[0][1];
    const event = { service: 'live-class-service', templateName: 'live-class-starting', to: 'a@b.com', toName: 'A', variables: {} };
    const msg = { content: Buffer.from(JSON.stringify(event)) };

    await handler(msg);

    expect(sender.send).toHaveBeenCalledWith(event);
    expect(channel.ack).toHaveBeenCalledWith(msg);
  });

  it('nacks without requeue on a malformed message, never calling the sender', async () => {
    await service.onApplicationBootstrap();
    const handler = channel.consume.mock.calls[0][1];
    const msg = { content: Buffer.from('not json') };

    await handler(msg);

    expect(sender.send).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
  });
});
