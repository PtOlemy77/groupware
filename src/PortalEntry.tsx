import { lazy, Suspense, useEffect, useState } from 'react';
import PortalPage from './components/PortalPage';

const App = lazy(() => import('./App'));
const PrivacyPolicyPage = lazy(() => import('./components/PrivacyPolicyPage'));

const GROUPWARE_HASHES = new Set([
  'groupware',
  'dashboard',
  'projects',
  'approvals',
  'business_deals',
  'reports',
  'employees',
  'equipments',
  'evaluations',
  'master_data',
  'procurement',
]);

type PortalRoute = 'portal' | 'groupware' | 'privacy';

/**
 * URL 해시(#...)를 읽어 현재 진입할 화면 경로를 결정한다.
 */
function readRoute(): PortalRoute {
  const hash = window.location.hash.slice(1);
  if (hash === 'privacy' || hash.startsWith('privacy-')) {
    return 'privacy';
  }

  const baseHash = hash.split('?')[0];
  return GROUPWARE_HASHES.has(baseHash) ? 'groupware' : 'portal';
}

export default function PortalEntry() {
  const [route, setRoute] = useState<PortalRoute>(readRoute);
  const isGroupware = route === 'groupware';

  useEffect(() => {
    const updateRoute = () => setRoute(readRoute());
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  useEffect(() => {
    if (isGroupware) {
      document.title = '(주)스패셜티 | 통합 그룹웨어';
      window.scrollTo(0, 0);
    }
  }, [isGroupware]);

  if (route === 'privacy') {
    return (
      <Suspense
        fallback={
          <div role="status" className="min-h-screen flex items-center justify-center">
            개인정보 처리방침 불러오는 중…
          </div>
        }
      >
        <PrivacyPolicyPage />
      </Suspense>
    );
  }

  if (isGroupware) {
    return (
      <Suspense
        fallback={
          <div
            role="status"
            className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-300"
          >
            스패셜티 그룹웨어 연결 중…
          </div>
        }
      >
        <App />
      </Suspense>
    );
  }

  return <PortalPage />;
}
