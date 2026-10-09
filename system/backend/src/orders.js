import { AppError, WAITING } from './domain.js';

export class OrderService {
  constructor(repository) { this.repository = repository; }
  async confirm(id, data) {
    const existing = await this.repository.get(id);
    // An identical retry returns the original result, never creates another order.
    if (existing?.confirmationId === data.confirmationId && existing.digest === data.digest) return existing;
    if (existing && (existing.status !== WAITING || existing.version !== data.expectedVersion)) {
      throw new AppError(409, 'Đơn đã đổi trạng thái hoặc được sửa ở nơi khác. Hãy mở lại đơn.');
    }
    if (!existing && data.expectedVersion !== 0) throw new AppError(404, 'Không tìm thấy đơn hàng.');
    const { expectedVersion, ...fields } = data;
    const now = new Date();
    const next = { ...fields, id, status: WAITING, version: expectedVersion + 1,
      createdAt: existing?.createdAt ?? now, updatedAt: now };
    const saved = await this.repository.save(next, expectedVersion);
    if (saved) return saved;
    const concurrent = await this.repository.get(id);
    if (concurrent?.confirmationId === data.confirmationId && concurrent.digest === data.digest) return concurrent;
    throw new AppError(409, 'Đơn vừa được thay đổi. Hãy mở lại đơn trước khi xác nhận.');
  }
}

export function publicOrder(order) {
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng.');
  const { _id, digest, confirmationId, ...visible } = order;
  return visible;
}

export class MongoOrderRepository {
  constructor(collection) { this.collection = collection; }
  async initialize() { await this.collection.createIndex({ updatedAt: -1, _id: -1 }); }
  get(id) { return this.collection.findOne({ _id: id }); }
  async list(page = 0) {
    const items = await this.collection.find({}, { projection: { history: 0, digest: 0, confirmationId: 0 } })
      .sort({ updatedAt: -1, _id: -1 }).skip(page * 50).limit(51).toArray();
    return { orders: items.slice(0, 50).map(publicOrder), hasMore: items.length > 50 };
  }
  async save(order, expectedVersion) {
    if (expectedVersion === 0) {
      try { await this.collection.insertOne({ ...order, _id: order.id }); return order; }
      catch (error) { if (error.code === 11000) return null; throw error; }
    }
    // Status AND version are checked in the write, not just in a prior read.
    return this.collection.findOneAndUpdate(
      { _id: order.id, status: WAITING, version: expectedVersion },
      { $set: order }, { returnDocument: 'after', includeResultMetadata: false },
    );
  }
}
