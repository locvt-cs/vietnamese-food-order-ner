import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { AppError } from './domain.js';

export class NerService {
  constructor(config) { this.config = config; this.child = null; this.pending = null; this.queue = Promise.resolve(); this.queued = 0; }
  predict(text) {
    if (this.closed) throw new AppError(503, 'Model đang dừng.');
    if (this.queued >= 5) throw new AppError(503, 'Model đang bận. Vui lòng thử lại sau.');
    this.queued++;
    const task = this.queue.then(() => this.request(text));
    this.queue = task.catch(() => {});
    return task.finally(() => { this.queued--; });
  }
  request(text) {
    if (this.closed) throw new AppError(503, 'Model đang dừng.');
    if (!this.config.vncore) throw new AppError(503, 'Chưa cấu hình VNCORENLP_DIR cho model NER.');
    if (!this.child) {
      const child = spawn(this.config.python, [fileURLToPath(new URL('../ner/worker.py', import.meta.url))], {
        windowsHide: true,
        env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8',
          VNCORENLP_DIR: this.config.vncore, NER_MODEL: this.config.model,
          HF_HUB_OFFLINE: this.config.localOnly ? '1' : '0' },
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      this.child = child;
      createInterface({ input: child.stdout }).on('line', (line) => {
        if (this.child !== child || !this.pending) return;
        try {
          const result = JSON.parse(line);
          const pending = this.pending; this.pending = null;
          clearTimeout(pending.timer);
          if (result.error) pending.reject(new AppError(503,
            'Không chạy được model. Kiểm tra Python, Java, VNCORENLP_DIR và model đã tải.'));
          else pending.resolve(result.tokens);
        } catch { this.stop(); }
      });
      child.on('error', () => { if (this.child === child) this.stop(); });
      child.on('exit', () => { if (this.child === child) this.stop(); });
      child.stdin.on('error', () => { if (this.child === child) this.stop(); });
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.stop(), 600_000);
      this.pending = { resolve, reject, timer };
      this.child.stdin.write(`${JSON.stringify({ text })}\n`);
    });
  }
  stop() {
    const child = this.child; this.child = null;
    child?.kill();
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new AppError(503, 'Model chưa sẵn sàng hoặc quá thời gian xử lý. Hãy kiểm tra cấu hình và thử lại.'));
      this.pending = null;
    }
  }
  close() { this.closed = true; this.stop(); }
}
