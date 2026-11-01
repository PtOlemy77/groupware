'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AuthUser } from '@/types/groupware';
export default function PasswordChange({
  onChanged,
  onLogout,
}: {
  onChanged: (user: AuthUser) => void;
  onLogout: () => void;
}) {
  const [current, setCurrent] = useState(''),
    [next, setNext] = useState(''),
    [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <form
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-8 shadow"
        onSubmit={async (e) => {
          e.preventDefault();
          if (next !== confirm) {
            setError('새 비밀번호가 일치하지 않습니다.');
            return;
          }
          try {
            setSaving(true);
            const r = await apiFetch('/api/auth/password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                current_password: current,
                new_password: next,
              }),
            });
            onChanged((await r.json()).user);
          } catch (e) {
            setError(e instanceof Error ? e.message : '변경에 실패했습니다.');
          } finally {
            setSaving(false);
          }
        }}
      >
        <h1 className="text-xl font-bold">비밀번호 변경</h1>
        <p className="text-sm text-slate-600">
          계정을 보호하기 위해 업무 시작 전에 비밀번호를 변경하세요.
        </p>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <label className="block">
          현재 비밀번호
          <input
            className="block w-full border rounded p-2"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="block">
          새 비밀번호 (12자 이상)
          <input
            className="block w-full border rounded p-2"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <label className="block">
          새 비밀번호 확인
          <input
            className="block w-full border rounded p-2"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button
          disabled={saving}
          className="w-full bg-indigo-600 text-white p-3 rounded"
        >
          {saving ? '변경 중…' : '변경 후 시작'}
        </button>
        <button type="button" onClick={onLogout}>
          로그아웃
        </button>
      </form>
    </main>
  );
}
