import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { groupEntities, validateConfirmation } from '../src/domain.js';
import { OrderService, MongoOrderRepository } from '../src/orders.js';

class MemoryRepository {
  rows = new Map();
  async get(id) { return structuredClone(this.rows.get(id)); }
  async list() { return { orders: [...this.rows.values()].sort((a, b) => b.updatedAt - a.updatedAt), hasMore: false }; }
  async save(order, expectedVersion) {
    const old = this.rows.get(order.id);
    if (expectedVersion === 0 ? !!old : !old || old.version !== expectedVersion || old.status !== 'WAITING') return null;
    this.rows.set(order.id, structuredClone(order)); return structuredClone(order);
  }
}
function payload(overrides = {}) {
  const id = randomUUID();
  return { expectedVersion: 0, confirmationId: randomUUID(), selectedResultId: id,
    history: [{ id, request: '2 phần cơm gà giao khu A', entities: [
      { id: randomUUID(), label: 'FOOD', text: 'cơm gà' },
      { id: randomUUID(), label: 'PLACE', text: 'khu A' },
    ] }], ...overrides };
}

test('BIO grouping keeps adjacent foods separate and joins multiword spans', () => {
  assert.deepEqual(groupEntities([
    { token: 'cơm', label: 'B-FOOD' }, { token: 'gà', label: 'I-FOOD' },
    { token: 'canh', label: 'B-FOOD' }, { token: 'giao', label: 'O' },
    { token: 'khu_A', label: 'I-PLACE' },
  ]), [{ label: 'FOOD', text: 'cơm gà' }, { label: 'FOOD', text: 'canh' }, { label: 'PLACE', text: 'khu A' }]);
});
test('validation requires a food, trims edits and rejects invalid history', () => {
  const body = payload();
  body.history[0].entities[0].text = ' cơm vịt ';
  assert.equal(validateConfirmation(body).entities[0].text, 'cơm vịt');
  body.history[0].entities[0].label = 'WRONG';
  assert.throws(() => validateConfirmation(body), /Nhãn/);
  body.history[0].entities = [];
  assert.throws(() => validateConfirmation(body), /FOOD/);
  assert.throws(() => validateConfirmation(payload({ history: [null] })), /Kết quả/);
});
test('confirm creates WAITING, repeated request is idempotent, edit updates same order', async () => {
  const repository = new MemoryRepository(); const service = new OrderService(repository);
  const id = randomUUID(); const body = payload(); const data = validateConfirmation(body);
  const first = await service.confirm(id, data);
  assert.equal(first.status, 'WAITING'); assert.equal(first.version, 1);
  assert.deepEqual(await service.confirm(id, data), first);
  body.expectedVersion = 1; body.confirmationId = randomUUID();
  body.history[0].entities[0].text = 'cơm vịt';
  const edited = await service.confirm(id, validateConfirmation(body));
  assert.equal(edited.version, 2); assert.equal(edited.entities[0].text, 'cơm vịt');
  assert.equal(repository.rows.size, 1);
  assert.ok(edited.updatedAt >= first.updatedAt);
});
test('rejects stale versions and orders already cooking', async () => {
  const repository = new MemoryRepository(); const service = new OrderService(repository);
  const id = randomUUID(); const data = validateConfirmation(payload());
  await service.confirm(id, data);
  await assert.rejects(service.confirm(id, validateConfirmation(payload())), { status: 409 });
  repository.rows.get(id).status = 'PREPARING';
  await assert.rejects(service.confirm(id, validateConfirmation(payload({ expectedVersion: 1 }))), { status: 409 });
});
test('two simultaneous edits cannot overwrite each other', async () => {
  const repository = new MemoryRepository(); const service = new OrderService(repository);
  const id = randomUUID(); await service.confirm(id, validateConfirmation(payload()));
  const results = await Promise.allSettled([
    service.confirm(id, validateConfirmation(payload({ expectedVersion: 1 }))),
    service.confirm(id, validateConfirmation(payload({ expectedVersion: 1 }))),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.status, 409);
});
test('Mongo update atomically filters status and version', async () => {
  let observed;
  const repository = new MongoOrderRepository({ findOneAndUpdate: async (...args) => { observed = args; return null; } });
  const id = randomUUID(); await repository.save({ id, version: 3 }, 2);
  assert.deepEqual(observed[0], { _id: id, status: 'WAITING', version: 2 });
  assert.equal(observed[2].returnDocument, 'after');
});
test('HTTP: analyze, save, load history, edit, validation and model outage', async (context) => {
  let fail = false;
  const app = createApp({ repository: new MemoryRepository(), ner: { predict: async () => {
    if (fail) throw new Error('private diagnostic should not leak');
    return [{ token: 'cơm_gà', label: 'B-FOOD' }];
  } } });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api`;
  const request = (path, method = 'GET', body) => fetch(url + path, { method,
    headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal((await request('/analyze', 'POST', { text: ' ' })).status, 400);
  const analyzed = await (await request('/analyze', 'POST', { text: 'một cơm gà' })).json();
  assert.equal(analyzed.entities[0].text, 'cơm gà');
  const id = randomUUID(); const body = payload({ history: [analyzed], selectedResultId: analyzed.id });
  const response = await request(`/orders/${id}`, 'PUT', body);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.digest, undefined); assert.equal(saved.history[0].request, 'một cơm gà');
  assert.equal((await (await request(`/orders/${id}`)).json()).version, 1);
  assert.equal((await (await request('/orders')).json()).orders.length, 1);
  body.expectedVersion = 1; body.confirmationId = randomUUID(); body.history[0].entities[0].text = 'cơm cá';
  assert.equal((await (await request(`/orders/${id}`, 'PUT', body)).json()).version, 2);
  assert.equal((await request('/orders?page=-1')).status, 400);
  assert.equal((await request('/orders/not-an-id')).status, 400);
  fail = true;
  const failure = await request('/analyze', 'POST', { text: 'cơm' });
  assert.equal(failure.status, 500); assert.ok(!(await failure.text()).includes('private diagnostic'));
});
