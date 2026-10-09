import { useEffect, useRef, useState } from 'react';
import Icon from '../../shared/Icon.jsx';
import { useManage } from './useManage.js';

const labels = ['PHONE', 'PLACE', 'FOOD', 'QUANTITY', 'TIME', 'NOTE', 'PRICE'];
const statusNames = { WAITING: 'Chờ nấu', PREPARING: 'Đang nấu', READY: 'Sẵn sàng', DELIVERING: 'Đang giao', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };
const colors = { PHONE: 'bg-sky-50 border-sky-200', PLACE: 'bg-violet-50 border-violet-200',
  FOOD: 'bg-emerald-50 border-emerald-200', QUANTITY: 'bg-amber-50 border-amber-200',
  TIME: 'bg-cyan-50 border-cyan-200', NOTE: 'bg-rose-50 border-rose-200', PRICE: 'bg-orange-50 border-orange-200' };

function EntityEditor({ result, disabled, onChange }) {
  const [label, setLabel] = useState('FOOD');
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {result.entities.map((entity) => <div key={entity.id} className={`rounded-lg border p-3 ${colors[entity.label]}`}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="text-xs font-semibold tracking-wide" htmlFor={entity.id}>{entity.label}</label>
          <button type="button" className="icon-button h-7 w-7" disabled={disabled} aria-label={`Xóa thực thể ${entity.label}`}
            onClick={() => onChange({ ...result, entities: result.entities.filter((item) => item.id !== entity.id) })}><Icon name="close" className="h-4 w-4" /></button>
        </div>
        <textarea id={entity.id} rows={2} maxLength={500} disabled={disabled} value={entity.text}
          className="w-full resize-y rounded border border-transparent bg-transparent p-1 text-sm focus:border-slate-400"
          onChange={(event) => onChange({ ...result, entities: result.entities.map((item) => item.id === entity.id ? { ...item, text: event.target.value } : item) })} />
      </div>)}
    </div>
    {result.entities.length === 0 && <p className="text-sm text-slate-600">Chưa nhận diện được thực thể. Có thể thêm thủ công hoặc gửi nội dung rõ hơn.</p>}
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label htmlFor={`label-${result.id}`} className="text-xs text-slate-600">Thêm thực thể</label>
      <select id={`label-${result.id}`} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm" value={label} disabled={disabled} onChange={(event) => setLabel(event.target.value)}>
        {labels.map((item) => <option key={item}>{item}</option>)}
      </select>
      <button type="button" className="icon-button h-8 w-8 border border-slate-300" disabled={disabled || result.entities.length >= 100}
        aria-label="Thêm thực thể" onClick={() => onChange({ ...result, entities: [...result.entities, { id: crypto.randomUUID(), label, text: '' }] })}><Icon name="plus" className="h-4 w-4" /></button>
    </div>
  </>;
}

export default function ManagePage() {
  const manage = useManage();
  const { active } = manage;
  const scroll = useRef(null);
  const locked = active.status !== 'WAITING';
  const disabled = active.busy || locked || active.conflict;
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [active.id, active.history.length]);

  return <div className="flex min-h-0 flex-1 flex-col md:flex-row">
    <aside className="flex max-h-64 shrink-0 flex-col border-b border-slate-200 bg-slate-50 md:max-h-none md:w-80 md:border-r md:border-b-0" aria-label="Danh sách đơn hàng">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold">Đơn đã xác nhận</h2>
        <div className="flex gap-1">
          <button type="button" className="icon-button" aria-label="Làm mới danh sách" onClick={manage.refresh}><Icon name="refresh" /></button>
          <button type="button" className="icon-button border border-slate-300 bg-white" aria-label="Tạo đơn mới" onClick={manage.create}><Icon name="plus" /></button>
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto p-3">
        {manage.listError && <p role="alert" className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{manage.listError}</p>}
        {manage.loading && <p className="p-2 text-sm text-slate-600">Đang tải đơn…</p>}
        {!manage.loading && !manage.listError && manage.orders.length === 0 && <p className="p-2 text-sm text-slate-600">Chưa có đơn. Nhập nội dung và xác nhận để tạo đơn đầu tiên.</p>}
        {manage.orders.map((order) => {
          const sorted = [...order.entities].sort((a, b) => labels.indexOf(a.label) - labels.indexOf(b.label));
          return <article key={order.id} className={`mb-3 min-w-0 rounded-lg border bg-white p-3 ${active.id === order.id ? 'border-slate-600' : 'border-slate-200'}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <button type="button" className="min-w-0 truncate text-left text-sm font-semibold underline-offset-2 hover:underline" onClick={() => manage.open(order)}>#{order.id.slice(0, 8)}</button>
              <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs">{statusNames[order.status] || order.status}</span>
              <button type="button" className="icon-button h-8 w-8 shrink-0" aria-label={`Sửa đơn ${order.id.slice(0, 8)}`}
                title={order.status === 'WAITING' ? 'Chỉnh sửa đơn' : 'Chỉ được sửa khi chờ nấu'} disabled={order.status !== 'WAITING'} onClick={() => manage.open(order)}><Icon name="edit" className="h-4 w-4" /></button>
            </div>
            <dl className="space-y-1 text-sm">{sorted.slice(0, 5).map((entity) => <div key={entity.id} className="flex min-w-0 gap-2">
              <dt className="w-16 shrink-0 text-xs leading-5 text-slate-500">{entity.label}</dt>
              <dd className="min-w-0 truncate" title={entity.text}>{entity.text}</dd>
            </div>)}</dl>
            {sorted.length > 5 && <p className="mt-2 text-xs text-slate-500">+{sorted.length - 5} thực thể khác</p>}
            <p className="mt-2 text-xs text-slate-500">{new Date(order.updatedAt).toLocaleString('vi-VN')}</p>
          </article>;
        })}
        {manage.hasMore && <button className="button w-full" onClick={manage.loadMore}>Xem thêm đơn</button>}
        {manage.sessions.some((session) => session.version === 0) && <div className="mt-3 border-t border-slate-200 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Bản nháp</h3>
          {manage.sessions.filter((session) => session.version === 0).map((session, index) => <button key={session.id}
            className={`mb-1 block w-full truncate rounded px-2 py-2 text-left text-sm ${active.id === session.id ? 'bg-slate-200' : 'bg-white'}`}
            onClick={() => manage.setActiveId(session.id)}>{session.history[0]?.request || `Đơn mới ${index + 1}`}{session.busy ? ' · Đang xử lý' : ''}</button>)}
        </div>}
      </div>
    </aside>

    <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Hội thoại nhập đơn">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
        <div><h1 className="font-semibold">{active.version ? `Đơn #${active.id.slice(0, 8)}` : 'Nhập đơn mới'}</h1>
          <p className="text-xs text-slate-500">{active.version ? `${statusNames[active.status] || active.status} · Phiên bản ${active.version}` : 'Nhập nội dung → kiểm tra thực thể → xác nhận'}</p></div>
        <button type="button" className="button" onClick={manage.create}>Đơn mới</button>
      </div>
      {(locked || active.conflict) && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm" role="status">
        <p>{locked ? 'Đơn đã rời trạng thái chờ nấu, chỉ có thể xem.' : 'Đơn đã được cập nhật ở nơi khác. Tải lại để tiếp tục.'}</p>
        <button className="button" disabled={active.busy} onClick={() => manage.open(active, true)}>Tải lại bản đã lưu (bỏ sửa nháp)</button>
      </div>}
      <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-4xl space-y-7">
          {active.history.length === 0 && <div className="py-10 text-center">
            <h2 className="text-lg font-medium">Nội dung đơn hàng</h2>
            <p className="mt-2 text-sm text-slate-500">Nhập món, số lượng, địa chỉ và số điện thoại ở bên dưới.</p>
            <p className="mt-1 text-sm text-slate-500">Kết quả phân tích sẽ xuất hiện tại đây để chỉnh sửa.</p>
          </div>}
          {active.history.map((result, index) => <article key={result.id} aria-label={`Kết quả ${index + 1}`} className="space-y-3">
            <div className="ml-auto max-w-[90%] rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-1 text-xs font-semibold text-slate-500">Yêu cầu {index + 1}</p>
              <p className="whitespace-pre-wrap break-words text-sm">{result.request}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Thực thể đã phân tích</h2>
                {active.selectedResultId === result.id && <span className="text-xs text-emerald-800">Kết quả đang được chọn cho đơn</span>}
              </div>
              <EntityEditor result={result} disabled={disabled} onChange={(next) => manage.changeResult(result.id, () => next)} />
              <div className="mt-5 flex justify-center gap-3">
                <button type="button" className="button border-red-200 bg-red-50 text-red-700" disabled={disabled} onClick={() => manage.discard(result.id)}>Discard</button>
                <button type="button" className="button border-slate-800 bg-slate-800 text-white" disabled={disabled || !result.entities.some((entity) => entity.label === 'FOOD' && entity.text.trim()) || result.entities.some((entity) => !entity.text.trim())}
                  onClick={() => manage.confirm(result.id)}>Confirm</button>
              </div>
            </div>
          </article>)}
        </div>
      </div>
      <div className="border-t border-slate-200 bg-white px-4 pt-3 pb-4 md:px-8">
        <div className="mx-auto max-w-4xl">
          {manage.notice && <p role="status" className="mb-2 text-sm text-emerald-800">{manage.notice}</p>}
          {active.error && <p role="alert" className="mb-2 text-sm text-red-700">{active.error}</p>}
          {active.busy && <p role="status" className="mb-2 text-sm text-slate-600">Đang xử lý… Lần nạp model đầu tiên có thể lâu hơn.</p>}
          <form onSubmit={manage.send} className="flex items-end gap-3">
            <div className="flex min-w-0 flex-1 items-end gap-2 rounded-xl border border-slate-400 p-3">
              <label htmlFor="order-input" className="sr-only">Nội dung đơn hàng</label>
              <textarea id="order-input" rows={2} maxLength={1000} value={active.input} disabled={disabled}
                onChange={(event) => manage.patch(active.id, { input: event.target.value })}
                placeholder="Ví dụ: 2 phần cơm gà, giao 12 Nguyễn Huệ, SĐT 0901234567"
                className="min-w-0 flex-1 resize-none border-0 bg-transparent text-sm outline-none"
                onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) manage.send(event); }} />
              <button type="button" className="icon-button shrink-0" disabled aria-label="Micro (chưa triển khai)" title="Micro sẽ được triển khai sau"><Icon name="mic" /></button>
            </div>
            <button type="submit" className="icon-button mb-1 h-11 w-11 shrink-0 rounded-full bg-slate-800 text-white" disabled={disabled || !active.input.trim()} aria-label="Gửi đơn để phân tích"><Icon name="arrow" /></button>
          </form>
          <p className="mt-2 text-xs text-slate-500">Ctrl + Enter để gửi · {active.input.length}/1.000 · Bản nháp chưa xác nhận sẽ mất khi tải lại trang.</p>
        </div>
      </div>
    </section>
  </div>;
}
