import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api.js';

function newSession() {
  return { id: crypto.randomUUID(), version: 0, status: 'WAITING', history: [], input: '',
    selectedResultId: null, busy: false, error: '', dirty: false, conflict: false };
}
export function useManage() {
  const [sessions, setSessions] = useState(() => [newSession()]);
  const [activeId, setActiveId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [pages, setPages] = useState(1);
  const [notice, setNotice] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const requestSequence = useRef(0);
  const attempts = useRef(new Map());
  const busyIds = useRef(new Set());
  const removedIds = useRef(new Set());
  const active = sessions.find((session) => session.id === activeId) || sessions[0];
  const patch = useCallback((id, changes) => setSessions((previous) => previous.map((session) =>
    session.id === id ? { ...session, ...(typeof changes === 'function' ? changes(session) : changes) } : session)), []);

  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const results = await Promise.all(Array.from({ length: pages }, (_, page) => api(`/orders?page=${page}`)));
      if (sequence !== requestSequence.current) return;
      const all = [...new Map(results.flatMap((result) => result.orders).map((order) => [order.id, order])).values()]
        .filter((order) => !removedIds.current.has(order.id));
      setOrders(all); setHasMore(results.at(-1).hasMore); setListError('');
      setSessions((previous) => previous.map((session) => {
        const order = all.find((item) => item.id === session.id);
        return order && session.version > 0 ? { ...session, status: order.status,
          conflict: session.conflict || order.version !== session.version } : session;
      }));
    } catch (error) { if (sequence === requestSequence.current) setListError(error.message); }
    finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [pages]);

  useEffect(() => {
    let live = true;
    let timer;
    const poll = async () => {
      await refresh();
      if (live) timer = setTimeout(poll, 5000);
    };
    poll();
    return () => { live = false; clearTimeout(timer); requestSequence.current++; };
  }, [refresh]);
  useEffect(() => {
    const warn = (event) => {
      if (sessions.some((session) => session.dirty || session.busy || session.input.trim())) {
        event.preventDefault(); event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [sessions]);

  function create() {
    const session = newSession(); setSessions((previous) => [...previous, session]);
    setActiveId(session.id); setNotice('');
  }
  async function open(order, reload = false) {
    const cached = sessions.find((session) => session.id === order.id);
    if (cached && !reload) { setActiveId(order.id); setNotice(''); return; }
    try {
      const saved = await api(`/orders/${order.id}`);
      if (removedIds.current.has(order.id)) return;
      const session = { ...saved, input: '', busy: false, error: '', dirty: false, conflict: false };
      setSessions((previous) => [...previous.filter((item) => item.id !== saved.id), session]);
      setActiveId(saved.id); setNotice('');
    } catch (error) { setListError(error.message); }
  }
  function changeResult(id, transform) {
    patch(active.id, (session) => ({ dirty: true, error: '', history: session.history.map((result) =>
      result.id === id ? transform(result) : result) }));
  }
  async function send(event) {
    event.preventDefault();
    if (busyIds.current.has(active.id) || !active.input.trim() || active.status !== 'WAITING' || active.conflict) return;
    if (active.history.length >= 20) { patch(active.id, { error: 'Tối đa 20 kết quả mỗi hội thoại. Hãy bỏ bớt kết quả chưa dùng.' }); return; }
    const id = active.id;
    busyIds.current.add(id);
    patch(id, { busy: true, error: '' }); setNotice('');
    try {
      const result = await api('/analyze', { method: 'POST', body: JSON.stringify({ text: active.input }) });
      patch(id, (session) => ({ history: [...session.history, result], input: '', dirty: true }));
    } catch (error) { patch(id, { error: error.message }); }
    finally { busyIds.current.delete(id); patch(id, { busy: false }); }
  }
  function discard(resultId) {
    patch(active.id, (session) => ({ history: session.history.filter((result) => result.id !== resultId),
      dirty: true, error: '' }));
    setNotice('Đã bỏ cặp yêu cầu/kết quả khỏi bản nháp. Đơn đã lưu (nếu có) giữ nguyên cho đến khi xác nhận lại.');
  }
  async function remove(order) {
    if (busyIds.current.has(order.id)) throw new Error('Đơn đang được xử lý. Vui lòng chờ trước khi xóa.');
    busyIds.current.add(order.id);
    setDeletingId(order.id);
    patch(order.id, { busy: true });
    try {
      if (order.version > 0) {
        await api(`/orders/${order.id}`, { method: 'DELETE', body: JSON.stringify({ expectedVersion: order.version }) });
      }
      removedIds.current.add(order.id);
      requestSequence.current++;
      attempts.current.delete(order.id);
      setOrders((previous) => previous.filter((item) => item.id !== order.id));
      setSessions((previous) => previous.filter((item) => item.id !== order.id));
      setActiveId((previous) => previous === order.id ? null : previous);
      setNotice(order.version ? 'Đã xóa đơn hàng.' : 'Đã xóa bản nháp.');
      if (order.version > 0) refresh();
    } catch (error) {
      if (error.status === 409) refresh();
      throw error;
    } finally {
      busyIds.current.delete(order.id);
      setDeletingId(null);
      patch(order.id, { busy: false });
    }
  }
  async function confirm(resultId) {
    if (busyIds.current.has(active.id) || active.status !== 'WAITING' || active.conflict) return;
    const id = active.id;
    const content = { expectedVersion: active.version, selectedResultId: resultId, history: active.history };
    const key = JSON.stringify(content);
    const previous = attempts.current.get(id);
    const confirmationId = previous?.key === key ? previous.confirmationId : crypto.randomUUID();
    attempts.current.set(id, { key, confirmationId });
    busyIds.current.add(id); patch(id, { busy: true, error: '' }); setNotice('');
    try {
      const saved = await api(`/orders/${id}`, { method: 'PUT', body: JSON.stringify({ ...content, confirmationId }) });
      requestSequence.current++; // An older poll must not overwrite this successful write.
      patch(id, { ...saved, busy: true, dirty: false, conflict: false });
      setOrders((previousOrders) => [saved, ...previousOrders.filter((order) => order.id !== saved.id)]);
      setNotice(saved.status === 'WAITING'
        ? 'Đã xác nhận. Đơn được đưa lên đầu danh sách với trạng thái chờ nấu.'
        : 'Đơn đã được lưu và đã chuyển sang bước xử lý tiếp theo.');
      attempts.current.delete(id);
    } catch (error) {
      patch(id, { error: error.message, conflict: error.status === 409 });
      if (error.status === 409) refresh();
    } finally { busyIds.current.delete(id); patch(id, { busy: false }); }
  }
  return { active, sessions, orders, listError, loading, hasMore, notice, deletingId, patch, create, open,
    changeResult, send, discard, confirm, remove, refresh, setActiveId, loadMore: () => setPages((value) => value + 1) };
}
