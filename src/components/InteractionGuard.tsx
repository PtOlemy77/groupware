'use client';
import { useEffect } from 'react';
import { useModal } from '@/contexts/ModalContext';
/** Keyboard/focus and unsaved-edit handling shared by the existing modal forms. */
export default function InteractionGuard() {
  const { showConfirm } = useModal();
  useEffect(() => {
    const seen = new WeakSet<HTMLElement>();
    const previous = new Map<HTMLElement, HTMLElement | null>();
    let fieldId = 0;
    const scan = () => {
      for (const label of document.querySelectorAll<HTMLLabelElement>(
        'label:not([for])',
      )) {
        if (label.querySelector('input,select,textarea')) continue;
        const sibling = label.nextElementSibling;
        const input = sibling?.matches('input,select,textarea')
          ? (sibling as HTMLInputElement)
          : sibling?.querySelector<HTMLInputElement>('input,select,textarea');
        if (input) {
          if (!input.id) input.id = `field-${++fieldId}`;
          label.htmlFor = input.id;
        }
      }
      for (const button of document.querySelectorAll<HTMLButtonElement>(
        'button',
      )) {
        if (!button.textContent?.trim() && !button.getAttribute('aria-label'))
          button.setAttribute(
            'aria-label',
            button.title ||
              (button.querySelector('svg.lucide-x')
                ? '닫기'
                : button.querySelector('svg.lucide-trash-2')
                  ? '삭제'
                  : button.querySelector(
                        'svg.lucide-pencil,svg.lucide-square-pen',
                      )
                    ? '수정'
                    : '작업 실행'),
          );
      }
      for (const node of document.querySelectorAll<HTMLElement>(
        '.fixed.inset-0',
      )) {
        if (seen.has(node) || node.hasAttribute('data-global-modal')) continue;
        seen.add(node);
        previous.set(node, document.activeElement as HTMLElement);
        node.setAttribute('role', 'dialog');
        node.setAttribute('aria-modal', 'true');
        const heading = node.querySelector('h1,h2,h3');
        node.setAttribute('aria-label', heading?.textContent || '업무 편집');
        node.tabIndex = -1;
        queueMicrotask(() =>
          (
            node.querySelector<HTMLElement>('input,select,textarea,button') ||
            node
          ).focus(),
        );
      }
      for (const [node, target] of previous)
        if (!node.isConnected) {
          target?.focus();
          previous.delete(node);
        }
    };
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
    const top = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '[role="dialog"][aria-modal="true"]',
        ),
      ].at(-1);
    const dirty = () => !!document.querySelector('[data-unsaved="true"]');
    const input = (e: Event) => {
      const target = e.target as HTMLElement;
      const scope =
        target.closest<HTMLElement>('[role="dialog"]') ||
        target.closest<HTMLElement>('[data-editor]');
      if (scope) scope.dataset.unsaved = 'true';
    };
    const saved = () =>
      document
        .querySelectorAll<HTMLElement>('[data-unsaved]')
        .forEach((n) => delete n.dataset.unsaved);
    const before = (e: BeforeUnloadEvent) => {
      if (dirty()) e.preventDefault();
    };
    const keydown = (e: KeyboardEvent) => {
      const dialog = top();
      if (!dialog) return;
      if (e.key === 'Escape') {
        const close = [
          ...dialog.querySelectorAll<HTMLButtonElement>('button'),
        ].find(
          (b) =>
            /^(닫기|취소|✕|×)$/.test(b.textContent?.trim() || '') ||
            b.getAttribute('aria-label') === '닫기',
        );
        if (close) {
          e.preventDefault();
          close.click();
        }
      }
      if (e.key === 'Tab') {
        const nodes = [
          ...dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        ].filter((n) => n.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    let confirming = false;
    const replaying = new WeakSet<HTMLButtonElement>();
    const click = (e: MouseEvent) => {
      const button = (e.target as HTMLElement).closest('button');
      if (!button || button.closest('[data-global-modal]')) return;
      if (replaying.has(button)) { replaying.delete(button); return; }
      const leaving =
        /^(닫기|취소|✕|×)$/.test(button.textContent?.trim() || '') ||
        button.getAttribute('aria-label') === '닫기' ||
        !!button.closest('nav');
      if (!leaving || !dirty()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (confirming) return;
      confirming = true;
      void showConfirm('저장하지 않은 변경 내용이 있습니다. 나가시겠습니까?', { title: '변경 내용 확인' })
        .then(confirmed => {
          if (confirmed && button.isConnected) {
            saved();
            replaying.add(button);
            button.click();
          }
        }).finally(() => { confirming = false; });
    };
    document.addEventListener('input', input);
    document.addEventListener('change', input);
    document.addEventListener('keydown', keydown);
    document.addEventListener('click', click, true);
    window.addEventListener('beforeunload', before);
    window.addEventListener('data-change-saved', saved);
    return () => {
      observer.disconnect();
      document.removeEventListener('input', input);
      document.removeEventListener('change', input);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('click', click, true);
      window.removeEventListener('beforeunload', before);
      window.removeEventListener('data-change-saved', saved);
    };
  }, [showConfirm]);
  return null;
}
