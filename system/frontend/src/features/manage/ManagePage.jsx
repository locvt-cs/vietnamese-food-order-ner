import { useEffect, useRef, useState } from 'react';
import Icon from '../../shared/Icon.jsx';
import { useManage } from './useManage.js';

const labels = ['PHONE', 'PLACE', 'FOOD', 'QUANTITY', 'TIME', 'NOTE', 'PRICE'];
const statusNames = { WAITING: 'Chờ nấu', PREPARING: 'Đang nấu', READY: 'Sẵn sàng', DELIVERING: 'Đang giao', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };
const colors = { PHONE: 'bg-sky-50 border-sky-200', PLACE: 'bg-violet-50 border-violet-200',
  FOOD: 'bg-emerald-50 border-emerald-200', QUANTITY: 'bg-amber-50 border-amber-200',
  TIME: 'bg-cyan-50 border-cyan-200', NOTE: 'bg-rose-50 border-rose-200', PRICE: 'bg-orange-50 border-orange-200' };
const labelNames = { PHONE: 'Phone', PLACE: 'Place', FOOD: 'Food', QUANTITY: 'Quantity', TIME: 'Time', NOTE: 'Note', PRICE: 'Price' };

function DeleteDialog({ order, busy, onCancel, onDelete }) {
  const dialog = useRef(null);
  const cancel = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current.showModal(); cancel.current.focus(); }, []);
  const saved = order.version > 0;
  return <dialog ref={dialog} aria-labelledby="delete-title" aria-describedby="delete-description"
    className="m-auto rounded-xl border border-slate-300 bg-white p-5 backdrop:bg-black/30" style={{ width: 'min(26rem, calc(100% - 2rem))' }}
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="delete-title" className="text-lg font-semibold">Xác nhận xóa?</h2>
    <p id="delete-description" className="mt-2 text-sm text-slate-600">{saved
      ? `Xóa đơn #${order.id.slice(0, 8)} cùng nội dung và lịch sử đã lưu? Không thể hoàn tác.`
      : 'Xóa bản nháp này cùng nội dung đang nhập và các kết quả phân tích?'}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <div className="mt-5 flex justify-end gap-2">
      <button ref={cancel} className="button" disabled={busy} onClick={onCancel}>Hủy</button>
      <button className="button border-red-700 bg-red-700 text-white" disabled={busy} onClick={async () => {
        setError('');
        try { await onDelete(order); onCancel(); } catch (failure) { setError(failure.message); }
      }}>{busy ? 'Đang xóa…' : 'Xóa'}</button>
    </div>
  </dialog>;
}

function OrderCard({ order, active, busy, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...order.entities].sort((a, b) => labels.indexOf(a.label) - labels.indexOf(b.label));
  const visible = expanded ? sorted : sorted.filter((entity) => ['PHONE', 'PLACE'].includes(entity.label));
  const shortId = order.id.slice(0, 8);
  return <article aria-label={`Đơn ${shortId}`} className={`relative mb-2 min-w-0 rounded-lg border bg-white ${active ? 'border-slate-600' : 'border-slate-200'}`}>
    <button type="button" className="absolute inset-0 rounded-lg" aria-expanded={expanded} aria-controls={`details-${order.id}`}
      aria-label={`${expanded ? 'Thu gọn' : 'Mở rộng'} đơn ${shortId}`} onClick={() => setExpanded((value) => !value)} />
    <div className="pointer-events-none relative px-2 py-1.5">
      <div className="mb-1 flex items-center gap-1">
        <span className="min-w-0 truncate text-xs font-semibold">#{shortId}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">{statusNames[order.status] || order.status}</span>
        <span className={`ml-auto ${expanded ? 'rotate-180' : ''}`}><Icon name="chevron" className="h-3.5 w-3.5" /></span>
        <div className="pointer-events-auto flex shrink-0 gap-0.5">
          <button type="button" className="icon-button h-7 w-7" aria-label={`Sửa đơn ${shortId}`}
            title={order.status === 'WAITING' ? 'Chỉnh sửa đơn' : 'Chỉ được sửa khi chờ nấu'} disabled={order.status !== 'WAITING' || busy} onClick={onEdit}><Icon name="edit" className="h-3.5 w-3.5" /></button>
          <button type="button" className="icon-button h-7 w-7 text-red-700" aria-label={`Xóa đơn ${shortId}`}
            title={order.status === 'WAITING' ? 'Xóa đơn' : 'Chỉ được xóa khi chờ nấu'} disabled={order.status !== 'WAITING' || busy} onClick={onDelete}><Icon name="trash" className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <dl id={`details-${order.id}`} className={`text-xs ${expanded ? 'space-y-1' : 'order-preview'}`}>
        {visible.map((entity) => <div key={entity.id} className="flex min-w-0 max-w-full items-baseline gap-1">
          <dt className="shrink-0 text-slate-500">{labelNames[entity.label]}:</dt>
          <dd className={`min-w-0 max-w-full rounded border px-1.5 py-0.5 ${colors[entity.label]} ${expanded ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'truncate'}`} title={entity.text}>{entity.text}</dd>
        </div>)}
      </dl>
      {!expanded && sorted.length > 0 && <p aria-hidden="true" className="mt-0.5 text-center text-xs leading-3 text-slate-500">...</p>}
      {!visible.length && <p className="text-xs text-slate-500">Chưa có Phone / Place</p>}
      {expanded && <p className="mt-1 text-[10px] text-slate-500">{new Date(order.updatedAt).toLocaleString('vi-VN')}</p>}
    </div>
  </article>;
}

function EntityEditor({ result, disabled, onChange }) {
  const [label, setLabel] = useState('FOOD');
  return <>
    <div className="flex flex-wrap items-start gap-2">
      {result.entities.map((entity) => <div key={entity.id} className={`entity-card max-w-full rounded-lg border px-2 py-1 ${colors[entity.label]}`}>
        <div className="flex items-center justify-between gap-3">
          <label className="text-[10px] font-semibold tracking-wide" htmlFor={entity.id}>{entity.label}</label>
          <button type="button" className="icon-button h-6 w-6" disabled={disabled} aria-label={`Xóa thực thể ${entity.label}`}
            onClick={() => onChange({ ...result, entities: result.entities.filter((item) => item.id !== entity.id) })}><Icon name="close" className="h-4 w-4" /></button>
        </div>
        <div className="entity-field">
          <span aria-hidden="true" className="entity-measure">{entity.text || ' '}{'\u200b'}</span>
          <textarea id={entity.id} rows={1} cols={1} disabled={disabled} value={entity.text}
            onChange={(event) => onChange({ ...result, entities: result.entities.map((item) => item.id === entity.id ? { ...item, text: event.target.value } : item) })} />
        </div>
      </div>)}
    </div>
    {result.entities.length === 0 && <p className="text-sm text-slate-600">Chưa nhận diện được thực thể. Có thể thêm thủ công hoặc gửi nội dung rõ hơn.</p>}
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label htmlFor={`label-${result.id}`} className="text-xs text-slate-600">Thêm thực thể</label>
      <select id={`label-${result.id}`} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm" value={label} disabled={disabled} onChange={(event) => setLabel(event.target.value)}>
        {labels.map((item) => <option key={item}>{item}</option>)}
      </select>
      <button type="button" className="icon-button h-8 w-8 border border-slate-300" disabled={disabled}
        aria-label="Thêm thực thể" onClick={() => onChange({ ...result, entities: [...result.entities, { id: crypto.randomUUID(), label, text: '' }] })}><Icon name="plus" className="h-4 w-4" /></button>
    </div>
  </>;
}

export default function ManagePage() {
  const manage = useManage();
  const { active } = manage;
  const [deleteTarget, setDeleteTarget] = useState(null);
  const scroll = useRef(null);
  const locked = active?.status !== 'WAITING';
  const disabled = active?.busy || locked || active?.conflict;
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [active?.id, active?.history.length]);

  return <div className="flex min-h-0 flex-1 flex-col md:flex-row">
    <aside className="flex max-h-64 shrink-0 flex-col border-b border-slate-200 bg-slate-50 md:max-h-none md:w-80 md:border-r md:border-b-0" aria-label="Danh sách đơn hàng">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold">Đơn đã xác nhận</h2>
        <div className="flex gap-1">
          <button type="button" className="icon-button" aria-label="Làm mới danh sách" onClick={manage.refresh}><Icon name="refresh" /></button>
          <button type="button" className="icon-button border border-slate-300 bg-white" aria-label="Tạo đơn mới" onClick={manage.create}><Icon name="plus" /></button>
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto p-2">
        {manage.listError && <p role="alert" className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{manage.listError}</p>}
        {manage.loading && <p className="p-2 text-sm text-slate-600">Đang tải đơn…</p>}
        {!manage.loading && !manage.listError && manage.orders.length === 0 && <p className="p-2 text-sm text-slate-600">Chưa có đơn. Nhập nội dung và xác nhận để tạo đơn đầu tiên.</p>}
        {manage.orders.map((order) => <OrderCard key={order.id} order={order} active={active?.id === order.id}
          busy={manage.deletingId === order.id || manage.sessions.some((session) => session.id === order.id && session.busy)}
          onEdit={() => manage.open(order)} onDelete={() => setDeleteTarget(order)} />)}
        {manage.hasMore && <button className="button w-full" onClick={manage.loadMore}>Xem thêm đơn</button>}
        {manage.sessions.some((session) => session.version === 0) && <div className="mt-3 border-t border-slate-200 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Bản nháp</h3>
          {manage.sessions.filter((session) => session.version === 0).map((session, index) => <div key={session.id}
            className={`mb-1 flex items-center rounded px-2 py-1 ${active?.id === session.id ? 'bg-slate-200' : 'bg-white'}`}>
            <button className="min-w-0 flex-1 truncate py-1 text-left text-sm" onClick={() => manage.setActiveId(session.id)}>
              {session.history[0]?.request || session.input || `Đơn mới ${index + 1}`}{session.busy ? ' · Đang xử lý' : ''}
            </button>
            {(session.history.length > 0 || session.input.trim()) && <button className="icon-button h-7 w-7 shrink-0" aria-label={`Sửa bản nháp ${index + 1}`} onClick={() => manage.setActiveId(session.id)}><Icon name="edit" className="h-3.5 w-3.5" /></button>}
            <button className="icon-button h-7 w-7 shrink-0 text-red-700" disabled={session.busy} aria-label={`Xóa bản nháp ${index + 1}`} onClick={() => setDeleteTarget(session)}><Icon name="trash" className="h-3.5 w-3.5" /></button>
          </div>)}
        </div>}
      </div>
    </aside>

    {active ? <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Hội thoại nhập đơn">
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
              <textarea id="order-input" rows={2} value={active.input} disabled={disabled}
                onChange={(event) => manage.patch(active.id, { input: event.target.value })}
                placeholder="Ví dụ: 2 phần cơm gà, giao 12 Nguyễn Huệ, SĐT 0901234567"
                className="min-w-0 flex-1 resize-none border-0 bg-transparent text-sm outline-none"
                onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) manage.send(event); }} />
              <button type="button" className="icon-button shrink-0" disabled aria-label="Micro (chưa triển khai)" title="Micro sẽ được triển khai sau"><Icon name="mic" /></button>
            </div>
            <button type="submit" className="icon-button mb-1 h-11 w-11 shrink-0 rounded-full bg-slate-800 text-white" disabled={disabled || !active.input.trim()} aria-label="Gửi đơn để phân tích"><Icon name="arrow" /></button>
          </form>
          <p className="mt-2 text-xs text-slate-500">Ctrl + Enter để gửi · Bản nháp chưa xác nhận sẽ mất khi tải lại trang.</p>
        </div>
      </div>
    </section> : <section className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
      {manage.notice && <p role="status" className="text-sm text-emerald-800">{manage.notice}</p>}
      <p className="text-sm text-slate-500">Chọn một đơn hoặc tạo đơn mới để tiếp tục.</p>
      <button className="button" onClick={manage.create}>Đơn mới</button>
    </section>}
    {deleteTarget && <DeleteDialog key={deleteTarget.id} order={deleteTarget} busy={manage.deletingId === deleteTarget.id}
      onCancel={() => setDeleteTarget(null)} onDelete={manage.remove} />}
  </div>;
}
