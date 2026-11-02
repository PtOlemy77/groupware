import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import PortalEntry from './PortalEntry';
import { ModalProvider } from '@/contexts/ModalContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModalProvider>
      <PortalEntry />
    </ModalProvider>
  </StrictMode>
);

