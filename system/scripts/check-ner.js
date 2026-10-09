import { fileURLToPath } from 'node:url';
import { NerService } from '../backend/src/ner.js';
import { groupEntities } from '../backend/src/domain.js';

// Deliberately independent of MongoDB and credential files.
const ner = new NerService({
  python: process.env.PYTHON_EXECUTABLE || fileURLToPath(new URL('../../../env/Scripts/python.exe', import.meta.url)),
  vncore: process.env.VNCORENLP_DIR || fileURLToPath(new URL('../.cache/vncorenlp', import.meta.url)),
  model: process.env.NER_MODEL || 'CS221DoAn/vietnamese_food_order_extraction', localOnly: true,
});
try {
  const results = await ner.predict('2 phần cơm gà giao khu A số điện thoại 0901234567');
  console.log(JSON.stringify(groupEntities(results), null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { ner.close(); }
