/** Same-origin API; session cookie stays HttpOnly and is never copied into storage. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let csrf: string | null = null;
const versions = new Map<string, number>();
let masterRows: any[] = [];
const nativeFetch = (...args: Parameters<typeof fetch>) =>
  globalThis.fetch(...args);
async function token() {
  if (!csrf) {
    const response = await nativeFetch('/api/auth/csrf', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok)
      throw new ApiError(
        '보안 토큰을 가져오지 못했습니다. 다시 시도하세요.',
        response.status,
      );
    csrf = (await response.json()).token;
  }
  return csrf!;
}
function remember(module: string, record: any) {
  if (record?.id !== undefined && record?.version !== undefined)
    versions.set(`${module}:${record.id}`, record.version);
}
const pendingMutations = new Map<string, Promise<Response>>();
/** Coalesce double-click submissions while leaving explicit later edits independent. */
export async function apiFetch(
  input: string,
  options: RequestInit = {},
): Promise<Response> {
  if (
    (options.method || 'GET').toUpperCase() !== 'POST' ||
    input !== '/api/groupware'
  )
    return performFetch(input, options);
  const key = String(options.body || '');
  const pending = pendingMutations.get(key);
  if (pending) return (await pending).clone();
  const request = performFetch(input, options);
  pendingMutations.set(key, request);
  try {
    return (await request).clone();
  } finally {
    pendingMutations.delete(key);
  }
}
async function performFetch(
  input: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = input.replace(/^http:\/\/localhost:8080/, '');
  const headers = new Headers(options.headers);
  const method = (options.method || 'GET').toUpperCase();
  let body = options.body;
  if (typeof body === 'string' && url === '/api/groupware') {
    const payload = JSON.parse(body);
    if (payload.id != null && payload.version == null)
      payload.version =
        payload.data?.version ??
        versions.get(`${payload.module}:${payload.id}`);
    if (
      payload.action === 'save_contract' &&
      payload.project_id != null &&
      payload.project_version == null
    )
      payload.project_version = versions.get(`projects:${payload.project_id}`);
    body = JSON.stringify(payload);
  }
  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method))
      headers.set('X-CSRF-TOKEN', await token());
    const response = await nativeFetch(url, {
      ...options,
      body,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) {
      const data = await response
        .clone()
        .json()
        .catch(() => ({}));
      if (response.status === 401 && url !== '/api/auth/login') {
        csrf = null;
        window.dispatchEvent(new Event('session-expired'));
      }
      const error = new ApiError(
        data.message || '요청을 처리하지 못했습니다. 다시 시도하세요.',
        response.status,
      );
      window.dispatchEvent(
        new CustomEvent('api-error', { detail: error.message }),
      );
      throw error;
    }
    if (url === '/api/auth/login' || url === '/api/auth/logout') csrf = null;
    if (url.startsWith('/api/groupware')) {
      const data = await response.clone().json();
      if (method === 'GET') {
        for (const [module, rows] of Object.entries(data))
          if (Array.isArray(rows)) rows.forEach((row) => remember(module, row));
        if (data.common_codes && Array.isArray(data.common_codes)) {
          masterRows = data.common_codes;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('target-revenues-updated'));
            window.dispatchEvent(new Event('master-data-updated'));
          }
        }
      } else if (data.record) {
        remember(data.module, data.record);
        window.dispatchEvent(new Event('data-change-saved'));
      }
    }
    return response;
  } catch (error) {
    if (!(error instanceof ApiError))
      window.dispatchEvent(
        new CustomEvent('api-error', {
          detail: '서버에 연결하지 못했습니다. 입력 내용은 유지됩니다.',
        }),
      );
    throw error;
  }
}
const masterGroup = (key: string) =>
  key.includes('unit_prices') ? 'MASTER_PRICES' : 'MASTER_TARGETS';
export function readMaster(key: string): string | null {
  return (
    masterRows.find(
      (r) => r.group_code === masterGroup(key) && r.code === 'DATA',
    )?.extra_value ?? null
  );
}
export async function saveMaster(key: string, value: unknown) {
  const group = masterGroup(key),
    row = masterRows.find((r) => r.group_code === group && r.code === 'DATA');
  const data = {
    group_code: group,
    group_name:
      group === 'MASTER_PRICES' ? '연도별 노임단가' : '연도별 목표매출',
    code: 'DATA',
    code_name: '기준정보',
    sort_order: 0,
    is_active: true,
    extra_value: JSON.stringify(value),
  };
  const response = await apiFetch('/api/groupware', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      module: 'common_codes',
      action: row ? 'update' : 'create',
      id: row?.id,
      version: row?.version,
      data,
    }),
  });
  const result = await response.json();
  masterRows = [
    ...masterRows.filter((r) => r.id !== result.record.id),
    result.record,
  ];
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('target-revenues-updated'));
    window.dispatchEvent(new Event('master-data-updated'));
  }
}

export function syncMasterRows(rows: any[]) {
  if (Array.isArray(rows)) {
    masterRows = rows;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('target-revenues-updated'));
      window.dispatchEvent(new Event('master-data-updated'));
    }
  }
}
const DEFAULT_STANDARD_PRICES: Record<string, number> = {
  사장: 15450,
  대표이사: 15450,
  이사: 15450,
  부장: 12875,
  차장: 10400,
  과장: 9100,
  대리: 7400,
  담당: 6300,
  사원: 6300,
  특급: 12875,
  고급: 10400,
  중급: 7400,
  초급: 6300,
};

export function unitPrice(position: string, year?: number): number {
  const normPos = (position || '').trim();
  const searchPos = normPos === '사장' || normPos === '대표이사' ? '이사' : normPos;
  try {
    const raw = readMaster('unit_prices');
    if (raw) {
      const data = JSON.parse(raw);
      const targetYear = year && !isNaN(year) ? year : new Date().getFullYear();
      let list = data[targetYear] || data[String(targetYear)];
      if (!list || !Array.isArray(list)) {
        const years = Object.keys(data).map(Number).filter(Boolean).sort((a, b) => b - a);
        if (years.length > 0) {
          list = data[years[0]];
        }
      }
      if (Array.isArray(list)) {
        const found = list.find(
          (p: any) =>
            p.position === normPos ||
            p.position === searchPos ||
            p.grade === normPos
        );
        if (found && Number(found.monthlyPrice) > 0) {
          return Number(found.monthlyPrice);
        }
      }
    }
  } catch (e) {
    // fallback
  }

  return DEFAULT_STANDARD_PRICES[normPos] || DEFAULT_STANDARD_PRICES[searchPos] || 6300;
}
