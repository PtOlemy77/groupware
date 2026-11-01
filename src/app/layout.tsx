import type { Metadata } from 'next';
import './globals.css';
import { ModalProvider } from '@/contexts/ModalContext';

export const metadata: Metadata = {
  title: '(주)스패셜티 SPATIAL T | 통합 그룹웨어 시스템',
  description: '(주)스패셜티(spatialt.co.kr) 직원 관리, 프로젝트 관리, 장비 관리, 사업 관리, 인사평가 통합 그룹웨어',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased selection:bg-indigo-600 selection:text-white">
        <ModalProvider>{children}</ModalProvider>
      </body>
    </html>
  );
}
