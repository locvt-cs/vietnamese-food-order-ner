import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { createApp } from './app.js';
import { MongoOrderRepository } from './orders.js';
import { NerService } from './ner.js';
import { startupDiagnostic } from './startup-diagnostic.js';
import { configureMongoDns } from './dns-config.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Only system/.env is loaded automatically. External credential files are never scanned.
if (existsSync(path.join(root, '.env'))) loadEnvFile(path.join(root, '.env'));
const uriVariable = process.env.MONGODB_URI_ENV || 'MONGODB_URI';
const uri = process.env[uriVariable];
if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) {
  console.error('Thiếu MongoDB connection string. Cấu hình MONGODB_URI hoặc MONGODB_URI_ENV.');
  process.exit(1);
}
const resolvePath = (value) => path.isAbsolute(value) ? value : path.resolve(root, value);
const ner = new NerService({
  python: resolvePath(process.env.PYTHON_EXECUTABLE || '../../env/Scripts/python.exe'),
  vncore: resolvePath(process.env.VNCORENLP_DIR || '.cache/vncorenlp'),
  model: process.env.NER_MODEL || 'CS221DoAn/vietnamese_food_order_extraction',
  localOnly: process.env.NER_LOCAL_FILES_ONLY !== 'false',
});
let client;
let stage = 'connect';
try {
  if (configureMongoDns(process.env.MONGODB_DNS_SERVERS)) {
    console.log('[DNS] Đã áp dụng DNS tùy chọn cho tiến trình backend.');
  }
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  stage = 'initialize';
  const repository = new MongoOrderRepository(client.db(process.env.MONGODB_DB || 'food_orders_dev').collection('orders'));
  await repository.initialize();
  stage = 'startup';
  const app = createApp({ repository, ner });
  const port = Number(process.env.PORT || 3001);
  const server = app.listen(port, '127.0.0.1', () => console.log(`API: http://127.0.0.1:${port}`));
  const shutdown = () => { ner.close(); server.close(() => client.close().finally(() => process.exit(0))); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error(startupDiagnostic(error, stage));
  await client?.close().catch(() => {});
  process.exitCode = 1;
}
