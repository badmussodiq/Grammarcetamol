/** A minimal fake Mongo collection for unit tests — supports the chained
 * find().sort().skip().limit().project().toArray() pattern plus the flat CRUD methods this
 * codebase's services actually call. Each method is a jest.fn() so call arguments can still be
 * asserted on; configure return values per test the same way payment-service's `pool.query`
 * mocks are configured. */
export function mockCollection() {
  const cursor: any = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    project: jest.fn().mockReturnThis(),
    toArray: jest.fn().mockResolvedValue([]),
  };
  return {
    __cursor: cursor,
    find: jest.fn().mockReturnValue(cursor),
    findOne: jest.fn(),
    insertOne: jest.fn(),
    insertMany: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    countDocuments: jest.fn().mockResolvedValue(0),
    createIndex: jest.fn().mockResolvedValue(undefined),
  };
}

export function mockDb(collections: Record<string, ReturnType<typeof mockCollection>>) {
  return { collection: jest.fn((name: string) => collections[name]) };
}
