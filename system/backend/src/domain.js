import { createHash } from 'node:crypto';

export const LABELS = ['PHONE', 'PLACE', 'FOOD', 'QUANTITY', 'TIME', 'NOTE', 'PRICE'];
export const WAITING = 'WAITING';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function requireValue(condition, message) {
  if (!condition) throw new AppError(400, message);
}
export function validateId(id) {
  requireValue(typeof id === 'string' && uuid.test(id), 'Mã dữ liệu không hợp lệ.');
  return id;
}
export function validateText(text) {
  requireValue(typeof text === 'string' && text.trim().length > 0,
    'Nội dung đơn không được để trống.');
  return text.trim();
}
export function validateConfirmation(body) {
  requireValue(body && typeof body === 'object', 'Thiếu nội dung xác nhận.');
  const confirmationId = validateId(body.confirmationId);
  const selectedResultId = validateId(body.selectedResultId);
  requireValue(Number.isSafeInteger(body.expectedVersion) && body.expectedVersion >= 0,
    'Phiên bản đơn không hợp lệ.');
  requireValue(Array.isArray(body.history) && body.history.length > 0 && body.history.length <= 20,
    'Mỗi hội thoại chứa tối đa 20 kết quả.');
  const ids = new Set();
  const history = body.history.map((item) => {
    requireValue(item && typeof item === 'object', 'Kết quả không hợp lệ.');
    const id = validateId(item.id);
    requireValue(!ids.has(id), 'Kết quả bị trùng mã.');
    ids.add(id);
    const request = validateText(item.request);
    requireValue(Array.isArray(item.entities), 'Danh sách thực thể không hợp lệ.');
    const entityIds = new Set();
    const entities = item.entities.map((entity) => {
      requireValue(entity && typeof entity === 'object', 'Thực thể không hợp lệ.');
      const entityId = validateId(entity.id);
      requireValue(!entityIds.has(entityId), 'Thực thể bị trùng mã.');
      entityIds.add(entityId);
      requireValue(LABELS.includes(entity.label), 'Nhãn thực thể không hợp lệ.');
      requireValue(typeof entity.text === 'string' && entity.text.trim().length > 0,
        'Thực thể không được để trống.');
      return { id: entityId, label: entity.label, text: entity.text.trim() };
    });
    return { id, request, entities };
  });
  const selected = history.find((item) => item.id === selectedResultId);
  requireValue(selected?.entities.some((entity) => entity.label === 'FOOD'),
    'Cần ít nhất một thực thể FOOD trước khi xác nhận.');
  const value = { confirmationId, selectedResultId, expectedVersion: body.expectedVersion, history };
  return { ...value, entities: selected.entities,
    digest: createHash('sha256').update(JSON.stringify(value)).digest('hex') };
}

export function groupEntities(tokens) {
  const entities = [];
  let current = null;
  for (const token of tokens) {
    const [prefix, label] = String(token.label).split('-');
    if (!['B', 'I'].includes(prefix) || !LABELS.includes(label)) { current = null; continue; }
    const text = String(token.token).replaceAll('_', ' ');
    if (prefix === 'I' && current?.label === label) current.text += ` ${text}`;
    else { current = { label, text }; entities.push(current); }
  }
  return entities;
}
