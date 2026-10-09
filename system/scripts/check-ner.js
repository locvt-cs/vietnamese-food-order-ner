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
  const long = process.argv.includes('--long');
  const text = long
    ? '2 phần cơm gà giao khu A, ít cay. '.repeat(60) + 'Giao khu B, số điện thoại 0987654321'
    : '2 phần cơm gà giao khu A số điện thoại 0901234567';
  const results = await ner.predict(text);
  if (long) {
    if (!results.some((item) => item.token === '0987654321')) throw new Error('Long-input check failed: missing final phone token.');
    console.log(`Long-input check OK: ${text.length} characters, ${results.length} tokens, final phone preserved.`);
    console.log(JSON.stringify(groupEntities(results).slice(-5), null, 2));
  } else console.log(JSON.stringify(groupEntities(results), null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { ner.close(); }
