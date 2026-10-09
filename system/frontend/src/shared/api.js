export async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), path === '/analyze' ? 130_000 : 15_000);
  try {
    const response = await fetch(`/api${path}`, {
      ...options, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.message || 'Không thể xử lý yêu cầu.');
      error.status = response.status;
      throw error;
    }
    if (!data) throw new Error('API không trả về dữ liệu hợp lệ.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Yêu cầu quá thời gian chờ. Có thể thử lại.');
    if (error instanceof TypeError) throw new Error('Không kết nối được API. Kiểm tra backend đang chạy.');
    throw error;
  } finally { clearTimeout(timeout); }
}
