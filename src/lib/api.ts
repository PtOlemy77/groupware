/**
 * 동일 출처(Same-Origin) 기반 API 클라이언트 유틸리티.
 * 세션 쿠키는 HttpOnly로 유지되며, 브라우저 저장소로 복사하지 않는다.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;
const recordVersions = new Map<string, number>();
let masterRows: any[] = [];
const pendingMutations = new Map<string, Promise<Response>>();

const nativeFetch = (...args: Parameters<typeof fetch>) => {
  return globalThis.fetch(...args);
};

/**
 * CSRF 보안 토큰을 조회하거나 캐시된 토큰을 반환한다.
 */
async function getCsrfToken(): Promise<string> {
  if (!csrfToken) {
    const response = await nativeFetch('/api/auth/csrf', {
      credentials: 'same-origin',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new ApiError(
        '보안 토큰을 가져오지 못했습니다. 다시 시도하세요.',
        response.status,
      );
    }

    const payload = await response.json();
    csrfToken = payload.token;
  }

  return csrfToken!;
}

/**
 * 낙관적 락(Optimistic Locking)을 위해 모듈별 레코드 버전을 메모리에 기록한다.
 */
function rememberVersion(module: string, record: any): void {
  if (record?.id !== undefined && record?.version !== undefined) {
    recordVersions.set(`${module}:${record.id}`, record.version);
  }
}

/**
 * 중복 클릭으로 인한 동일한 변경 요청(POST /api/groupware)은 하나로 병합(coalesce)하고,
 * 이후의 명시적인 편집 요청은 독립적으로 실행한다.
 */
export async function apiFetch(
  input: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const isGroupwareMutation = method === 'POST' && input === '/api/groupware';

  if (!isGroupwareMutation) {
    return performFetch(input, options);
  }

  const dedupeKey = String(options.body || '');
  const pendingRequest = pendingMutations.get(dedupeKey);
  if (pendingRequest) {
    const sharedResponse = await pendingRequest;
    return sharedResponse.clone();
  }

  const requestPromise = performFetch(input, options);
  pendingMutations.set(dedupeKey, requestPromise);

  try {
    const response = await requestPromise;
    return response.clone();
  } finally {
    pendingMutations.delete(dedupeKey);
  }
}

/**
 * 실제 HTTP 요청을 수행하고 CSRF 헤더 주입, 버전 주입, 공통 오류 이벤트를 처리한다.
 */
async function performFetch(
  input: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = input.replace(/^http:\/\/localhost:8080/, '');
  const headers = new Headers(options.headers);
  const method = (options.method || 'GET').toUpperCase();
  let body = options.body;

  // 그룹웨어 단건 변경 요청 시 저장해 둔 최신 버전 번호를 자동으로 보완
  if (typeof body === 'string' && url === '/api/groupware') {
    const payload = JSON.parse(body);

    if (payload.id != null && payload.version == null) {
      payload.version =
        payload.data?.version ??
        recordVersions.get(`${payload.module}:${payload.id}`);
    }

    if (
      payload.action === 'save_contract' &&
      payload.project_id != null &&
      payload.project_version == null
    ) {
      payload.project_version = recordVersions.get(`projects:${payload.project_id}`);
    }

    body = JSON.stringify(payload);
  }

  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      headers.set('X-CSRF-TOKEN', await getCsrfToken());
    }

    const response = await nativeFetch(url, {
      ...options,
      body,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response
        .clone()
        .json()
        .catch(() => ({}));

      if (response.status === 401 && url !== '/api/auth/login') {
        csrfToken = null;
        window.dispatchEvent(new Event('session-expired'));
      }

      const error = new ApiError(
        errorData.message || '요청을 처리하지 못했습니다. 다시 시도하세요.',
        response.status,
      );
      window.dispatchEvent(
        new CustomEvent('api-error', { detail: error.message }),
      );
      throw error;
    }

    // 로그인/로그아웃 시 CSRF 토큰 초기화
    if (url === '/api/auth/login' || url === '/api/auth/logout') {
      csrfToken = null;
    }

    // 그룹웨어 응답 처리: 레코드 버전 기억 및 기준정보(common_codes) 동기화
    if (url.startsWith('/api/groupware')) {
      const responseData = await response.clone().json();

      if (method === 'GET') {
        for (const [moduleName, rows] of Object.entries(responseData)) {
          if (Array.isArray(rows)) {
            rows.forEach((row) => rememberVersion(moduleName, row));
          }
        }

        if (responseData.common_codes && Array.isArray(responseData.common_codes)) {
          masterRows = responseData.common_codes;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('target-revenues-updated'));
            window.dispatchEvent(new Event('master-data-updated'));
          }
        }
      } else if (responseData.record) {
        rememberVersion(responseData.module, responseData.record);
        window.dispatchEvent(new Event('data-change-saved'));
      }
    }

    return response;
  } catch (error) {
    if (!(error instanceof ApiError)) {
      window.dispatchEvent(
        new CustomEvent('api-error', {
          detail: '서버에 연결하지 못했습니다. 입력 내용은 유지됩니다.',
        }),
      );
    }
    throw error;
  }
}

/**
 * 기준정보 키 이름을 DB 공통코드 그룹 코드로 변환한다.
 */
function resolveMasterGroup(key: string): 'MASTER_PRICES' | 'MASTER_TARGETS' {
  return key.includes('unit_prices') ? 'MASTER_PRICES' : 'MASTER_TARGETS';
}

/**
 * 메모리 캐시(common_codes)에서 목표매출 또는 노임단가 JSON 문자열을 조회한다.
 */
export function readMaster(key: string): string | null {
  const isPrices = key.includes('unit_prices');
  const groupCode = resolveMasterGroup(key);
  const systemConfigCode = isPrices ? 'UNIT_PRICES' : 'TARGET_REVENUES';

  const found = masterRows.find(
    (row) =>
      (row.group_code === groupCode && row.code === 'DATA') ||
      (row.group_code === 'SYSTEM_CONFIG' && row.code === systemConfigCode),
  );

  return found?.extra_value ?? null;
}

/**
 * 목표매출 또는 노임단가 기준정보를 DB(common_codes)에 저장하고 전역 이벤트를 전파한다.
 */
export async function saveMaster(key: string, value: unknown): Promise<void> {
  const groupCode = resolveMasterGroup(key);
  const existingRow = masterRows.find(
    (row) => row.group_code === groupCode && row.code === 'DATA',
  );

  const data = {
    group_code: groupCode,
    group_name: groupCode === 'MASTER_PRICES' ? '연도별 노임단가' : '연도별 목표매출',
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
      action: existingRow ? 'update' : 'create',
      id: existingRow?.id,
      version: existingRow?.version,
      data,
    }),
  });

  const result = await response.json();
  masterRows = [
    ...masterRows.filter((row) => row.id !== result.record.id),
    result.record,
  ];

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('target-revenues-updated'));
    window.dispatchEvent(new Event('master-data-updated'));
  }
}

/**
 * 외부에서 조회한 common_codes 목록으로 메모리 기준정보 캐시를 동기화한다.
 */
export function syncMasterRows(rows: any[]): void {
  if (!Array.isArray(rows)) {
    return;
  }

  masterRows = rows;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('target-revenues-updated'));
    window.dispatchEvent(new Event('master-data-updated'));
  }
}

/**
 * DB 마스터(MASTER_PRICES)에서 직급 및 연도에 해당하는 월 노임단가(천원)를 조회한다.
 * DB에 해당 연도·직급 데이터가 없으면 하드코딩된 기본값을 사용하지 않고 0을 반환한다.
 */
export function unitPrice(position: string, year?: number): number {
  const normalizedPosition = (position || '').trim();
  const aliasPosition =
    normalizedPosition === '사장' || normalizedPosition === '대표이사'
      ? '이사'
      : normalizedPosition;

  try {
    const raw = readMaster('unit_prices');
    if (!raw) {
      return 0;
    }

    const priceTable = JSON.parse(raw);
    const targetYear =
      year && !Number.isNaN(year) ? year : new Date().getFullYear();

    // 요청한 연도의 단가 목록을 먼저 찾고, 없으면 가장 최근 연도의 단가 목록을 사용
    let yearlyList = priceTable[targetYear] || priceTable[String(targetYear)];
    if (!Array.isArray(yearlyList)) {
      const availableYears = Object.keys(priceTable)
        .map(Number)
        .filter(Boolean)
        .sort((a, b) => b - a);

      if (availableYears.length > 0) {
        yearlyList = priceTable[availableYears[0]];
      }
    }

    if (!Array.isArray(yearlyList)) {
      return 0;
    }

    // 입력 직급명 일치 항목을 우선 찾고, 없으면 대표 직급 별칭/등급명으로 매칭
    const exactMatch = yearlyList.find(
      (item: any) => item.position === normalizedPosition,
    );
    const matchedItem =
      exactMatch ||
      yearlyList.find(
        (item: any) =>
          item.position === aliasPosition || item.grade === normalizedPosition,
      );

    if (matchedItem && Number(matchedItem.monthlyPrice) > 0) {
      return Number(matchedItem.monthlyPrice);
    }
  } catch {
    // DB 마스터 JSON 파싱 실패 시 0 반환
  }

  return 0;
}
