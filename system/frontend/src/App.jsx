import { useEffect, useState } from 'react';
import ManagePage from './features/manage/ManagePage.jsx';

const tabs = ['manage', 'kitchen', 'delivery'];
function currentTab() { const tab = window.location.hash.slice(1); return tabs.includes(tab) ? tab : 'manage'; }
export default function App() {
  const [tab, setTab] = useState(currentTab);
  useEffect(() => {
    const update = () => setTab(currentTab());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return <div className="flex h-dvh min-h-[560px] flex-col bg-white text-slate-800">
    <header className="flex shrink-0 items-center justify-between border-b border-slate-300 px-4 py-3 md:px-6">
      <nav className="flex gap-2" aria-label="Trang chính">
        {tabs.map((item) => <a href={`#${item}`} key={item} aria-current={tab === item ? 'page' : undefined}
          className={`rounded-md border px-4 py-2 text-sm font-medium capitalize ${tab === item ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white'}`}>{item}</a>)}
      </nav>
      <span className="hidden text-sm text-slate-500 sm:block">Food orders</span>
    </header>
    {/* Keep Manage mounted so switching placeholder tabs preserves draft conversations. */}
    <main className={tab === 'manage' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}><ManagePage /></main>
    {tab !== 'manage' && <main className="grid flex-1 place-items-center p-6 text-center"><div>
      <h1 className="text-xl font-semibold capitalize">{tab}</h1>
      <p className="mt-2 text-sm text-slate-500">Trang giữ chỗ. Chức năng sẽ được triển khai sau.</p>
      <a className="mt-5 inline-block text-sm underline" href="#manage">Quay lại Manage</a>
    </div></main>}
  </div>;
}
