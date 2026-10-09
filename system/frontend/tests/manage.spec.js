import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function fixture(page) {
  const store = new Map();
  const state = { failAnalyze: false };
  let timestamp = Date.now();
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postDataJSON();
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.pathname === '/api/analyze') {
      if (state.failAnalyze) return reply({ message: 'Model chưa sẵn sàng.' }, 503);
      return reply({ id: randomUUID(), request: body.text, entities: [
        { id: randomUUID(), label: 'FOOD', text: 'cơm gà' },
        { id: randomUUID(), label: 'QUANTITY', text: '2 phần' },
        { id: randomUUID(), label: 'PLACE', text: '12 Nguyễn Huệ' },
        { id: randomUUID(), label: 'PHONE', text: '0901234567' },
        { id: randomUUID(), label: 'NOTE', text: 'ít cay' },
        { id: randomUUID(), label: 'TIME', text: '12h' },
      ] });
    }
    if (url.pathname === '/api/orders') return reply({ orders: [...store.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)), hasMore: false });
    const id = url.pathname.split('/').at(-1);
    if (request.method() === 'GET') return reply(store.get(id));
    const old = store.get(id);
    if (old && (old.status !== 'WAITING' || old.version !== body.expectedVersion)) return reply({ message: 'Đơn đã đổi trạng thái hoặc được sửa ở nơi khác. Hãy mở lại đơn.' }, 409);
    const saved = { id, history: body.history, selectedResultId: body.selectedResultId,
      entities: body.history.find((item) => item.id === body.selectedResultId).entities,
      version: body.expectedVersion + 1, status: 'WAITING', updatedAt: new Date(++timestamp).toISOString() };
    store.set(id, saved); return reply(saved);
  });
  await page.goto('/');
  return { store, state };
}
async function send(page, text = '2 phần cơm gà giao 12 Nguyễn Huệ, 0901234567') {
  await page.getByRole('textbox', { name: 'Nội dung đơn hàng', exact: true }).fill(text);
  const response = page.waitForResponse('**/api/analyze');
  await page.getByRole('button', { name: 'Gửi đơn để phân tích' }).click();
  await response;
}

test('multiple results have their own controls; editing, confirming and reopening keeps one order', async ({ page }) => {
  const { store } = await fixture(page);
  await expect(page.getByRole('button', { name: 'Micro (chưa triển khai)' })).toBeDisabled();
  await send(page);
  const first = page.getByRole('article', { name: 'Kết quả 1', exact: true });
  await first.getByRole('textbox', { name: 'FOOD', exact: true }).fill('cơm vịt');
  await send(page, 'thêm một phần canh');
  const second = page.getByRole('article', { name: 'Kết quả 2', exact: true });
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(2);
  await second.getByRole('button', { name: 'Discard' }).click();
  await expect(second).toHaveCount(0);
  await expect(page.getByText('thêm một phần canh', { exact: true })).toHaveCount(0);
  await first.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('heading', { name: /^Đơn #/ })).toBeVisible();
  expect(store.size).toBe(1);
  const saved = [...store.values()][0];
  expect(saved.entities[0].text).toBe('cơm vịt');
  const card = page.getByRole('complementary').getByRole('article').first();
  await expect(card.locator('dt').first()).toHaveText('PHONE');
  await expect(card.locator('dt').nth(1)).toHaveText('PLACE');
  await expect(card.locator('dt')).toHaveCount(5);
  await expect(card.getByText('+1 thực thể khác')).toBeVisible();
  await page.getByRole('button', { name: 'Đơn mới', exact: true }).click();
  await page.getByRole('button', { name: `Sửa đơn ${saved.id.slice(0, 8)}` }).click();
  await expect(first.getByRole('textbox', { name: 'FOOD', exact: true })).toHaveValue('cơm vịt');
  await first.getByRole('textbox', { name: 'FOOD', exact: true }).fill('cơm cá');
  await first.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Chờ nấu · Phiên bản 2')).toBeVisible();
  expect(store.size).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: `Sửa đơn ${saved.id.slice(0, 8)}` }).click();
  await expect(first.getByRole('textbox', { name: 'FOOD', exact: true })).toHaveValue('cơm cá');
  await page.screenshot({ path: 'test-results/manage-desktop.png', fullPage: true });
});

test('newest confirmation goes first; status change rejects stale edit and locks controls', async ({ page }) => {
  const { store } = await fixture(page);
  await send(page);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Chờ nấu · Phiên bản 1')).toBeVisible();
  const firstId = [...store.keys()][0];
  await page.getByRole('button', { name: 'Đơn mới', exact: true }).click();
  await send(page, 'đơn thứ hai');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('complementary').getByRole('article')).toHaveCount(2);
  await page.getByRole('button', { name: `Sửa đơn ${firstId.slice(0, 8)}` }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('complementary').getByRole('article').first()).toContainText(firstId.slice(0, 8));
  store.get(firstId).status = 'PREPARING';
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Đơn đã rời trạng thái chờ nấu, chỉ có thể xem.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: `Sửa đơn ${firstId.slice(0, 8)}` })).toBeDisabled();
});

test('selecting another result updates the same order and preserves both request/result pairs', async ({ page }) => {
  const { store } = await fixture(page);
  await send(page, 'yêu cầu đầu');
  await send(page, 'yêu cầu thay thế');
  const first = page.getByRole('article', { name: 'Kết quả 1', exact: true });
  const second = page.getByRole('article', { name: 'Kết quả 2', exact: true });
  await second.getByRole('textbox', { name: 'FOOD', exact: true }).fill('canh rau');
  await second.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Chờ nấu · Phiên bản 1')).toBeVisible();
  expect([...store.values()][0].entities[0].text).toBe('canh rau');
  await first.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Chờ nấu · Phiên bản 2')).toBeVisible();
  expect(store.size).toBe(1);
  expect([...store.values()][0].entities[0].text).toBe('cơm gà');
  expect([...store.values()][0].history).toHaveLength(2);
});

test('mobile layout fits, tabs preserve draft, failed analysis keeps input, discard clears pair', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { state } = await fixture(page);
  state.failAnalyze = true;
  await send(page, 'cơm gà');
  await expect(page.getByRole('alert')).toContainText('Model chưa sẵn sàng.');
  await expect(page.getByRole('textbox', { name: 'Nội dung đơn hàng', exact: true })).toHaveValue('cơm gà');
  state.failAnalyze = false;
  await page.getByRole('button', { name: 'Gửi đơn để phân tích' }).click();
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'kitchen', exact: true }).click();
  await expect(page.getByText('Trang giữ chỗ. Chức năng sẽ được triển khai sau.')).toBeVisible();
  await page.getByRole('link', { name: 'manage', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/manage-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Nội dung đơn hàng', exact: true })).toHaveValue('');
});
