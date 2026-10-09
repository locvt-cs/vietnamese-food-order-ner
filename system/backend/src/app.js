import express from 'express';
import { randomUUID } from 'node:crypto';
import { AppError, groupEntities, validateConfirmation, validateId, validateText } from './domain.js';
import { OrderService, publicOrder } from './orders.js';

export function createApp({ repository, ner }) {
  const app = express();
  const orders = new OrderService(repository);
  app.disable('x-powered-by');
  // No word/character cap; retain a transport budget for process/database memory.
  app.use(express.json({ limit: '8mb' }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.post('/api/analyze', async (req, res) => {
    const request = validateText(req.body?.text);
    const tokens = await ner.predict(request);
    res.json({ id: randomUUID(), request, entities: groupEntities(tokens).map((entity) => ({ id: randomUUID(), ...entity })) });
  });
  app.get('/api/orders', async (req, res) => {
    const page = Number(req.query.page ?? 0);
    if (!Number.isSafeInteger(page) || page < 0 || page > 10_000) throw new AppError(400, 'Trang không hợp lệ.');
    res.json(await repository.list(page));
  });
  app.get('/api/orders/:id', async (req, res) => res.json(publicOrder(await repository.get(validateId(req.params.id)))));
  app.delete('/api/orders/:id', async (req, res) => {
    await orders.remove(validateId(req.params.id), req.body?.expectedVersion);
    res.json({ deleted: true });
  });
  app.put('/api/orders/:id', async (req, res) => {
    const order = await orders.confirm(validateId(req.params.id), validateConfirmation(req.body));
    res.json(publicOrder(order));
  });
  app.use('/api', (req, res) => res.status(404).json({ message: 'API không tồn tại.' }));
  app.use((error, req, res, next) => {
    if (error instanceof AppError) return res.status(error.status).json({ message: error.message });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON không hợp lệ.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Dung lượng yêu cầu vượt 8 MB. Hãy chia thành các đơn nhỏ hơn.' });
    res.status(500).json({ message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' });
  });
  return app;
}
