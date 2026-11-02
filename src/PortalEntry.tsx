import { lazy, Suspense, useEffect, useState } from 'react';
const App = lazy(() => import('./App'));
import PortalPage from './components/PortalPage';

const groupwareHashes = new Set(['groupware', 'dashboard', 'projects', 'approvals', 'business_deals', 'reports', 'employees', 'equipments', 'evaluations', 'master_data']);
export default function PortalEntry() {
  const [isGroupware, setIsGroupware] = useState(() => groupwareHashes.has(window.location.hash.slice(1)));
  useEffect(() => {
    const updateRoute = () => setIsGroupware(groupwareHashes.has(window.location.hash.slice(1)));
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);
  useEffect(() => {
    if (isGroupware) { document.title = '(주)스패셜티 | 통합 그룹웨어'; window.scrollTo(0, 0); }
  }, [isGroupware]);
  return isGroupware ? <><Suspense fallback={<div role="status" className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-300">스패셜티 그룹웨어 연결 중…</div>}><App /></Suspense><a className="portal-return" href="#top">← 스패셜티 포털</a></> : <PortalPage />;
}
