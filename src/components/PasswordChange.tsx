'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AuthUser } from '@/types/groupware';
import { Lock, ShieldCheck, ArrowRight, LogOut, CheckCircle2 } from 'lucide-react';

export default function PasswordChange({
  onChanged,
  onLogout,
}: {
  onChanged: (user: AuthUser) => void;
  onLogout: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 12) {
      setError('새 비밀번호는 최소 12자 이상이어야 합니다.');
      return;
    }
    if (next !== confirm) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const r = await apiFetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: current,
          new_password: next,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        throw new Error(data.message || '비밀번호 변경에 실패했습니다.');
      }
      onChanged(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 sm:p-10 border border-slate-100">
        {/* Brand Icon & Title */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/25 text-white">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">초기 비밀번호 변경</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            보안 강화를 위해 본인만의 새 비밀번호(12자 이상)로 변경 후 그룹웨어를 시작하세요.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2"
          >
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              현재 비밀번호 (초기: spatialt2019!!)
            </label>
            <div className="relative flex items-center">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="현재 임시 비밀번호"
                className="w-full pl-3.5 pr-4 py-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              새 비밀번호 (12자 이상)
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              minLength={12}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="영문, 숫자 등 조합 12자 이상"
              className="w-full pl-3.5 pr-4 py-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50/50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              새 비밀번호 확인
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="새 비밀번호 다시 입력"
              className="w-full pl-3.5 pr-4 py-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50/50"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {saving ? (
              <span>변경 중...</span>
            ) : (
              <>
                <span>비밀번호 변경 및 업무 시작</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>로그아웃하고 나가기</span>
          </button>
        </form>
      </div>
    </div>
  );
}
