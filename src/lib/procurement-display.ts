/**
 * API에서 전달된 금액 문자열을 정밀도 손실 없이 원 단위 포맷(콤마 및 소수점 보존)으로 변환합니다.
 */
export function procurementAmount(value: string): string {
  const raw = value.trim().replaceAll(',', '');
  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    return '—';
  }

  const [whole, fraction = ''] = raw.split('.');
  const integer = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimal = fraction.replace(/0+$/, '');

  return `${integer}${decimal ? `.${decimal}` : ''}원`;
}

/**
 * ISO 일시 또는 문자열 일시를 화면 표시용 'YYYY-MM-DD HH:mm' 포맷으로 변환합니다.
 */
export function procurementDate(value: string): string {
  if (!value) {
    return '—';
  }
  return value.replace('T', ' ').slice(0, 16);
}

/**
 * 줄바꿈 또는 쉼표로 나열된 검색 키워드/기관명 목록에서 중복과 공백을 제거한 단어 배열을 반환합니다.
 */
export function procurementTerms(values: string[]): string[] {
  return [
    ...new Set(
      values
        .flatMap((value) => value.split(/[\n,]/))
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
}

/**
 * 공식 나라장터 HTTPS URL인지 검증하고 안전한 링크만 반환합니다.
 */
export function procurementSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    const isHttps = url.protocol === 'https:';
    const isG2bHost = url.hostname === 'g2b.go.kr' || url.hostname.endsWith('.g2b.go.kr');
    const noCredentials = !url.username && !url.password;

    return isHttps && isG2bHost && noCredentials ? url.href : '';
  } catch {
    return '';
  }
}
