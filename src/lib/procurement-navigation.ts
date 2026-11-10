import type { ProcurementFilter } from '@/types/procurement';

/**
 * 필터 객체를 URL 해시용 쿼리스트링 문자열로 직렬화합니다.
 */
export function procurementLocation(filter: ProcurementFilter): string {
  const query = new URLSearchParams({
    kind: filter.kind,
    business: filter.business,
    unread: String(filter.unread),
  });
  return `procurement?${query}`;
}

/**
 * URL 해시로부터 공고 종류, 업무 구분, 미읽음 필터 상태를 파싱합니다.
 */
export function procurementFilter(hash: string): ProcurementFilter {
  const query = new URLSearchParams(hash.split('?')[1] || '');
  const kind = query.get('kind') || 'ALL';
  const business = query.get('business') || 'ALL';

  const validKinds: ProcurementFilter['kind'][] = ['ALL', 'BID', 'SPEC'];
  const validBusinesses: ProcurementFilter['business'][] = ['ALL', 'SERVC', 'THNG', 'CNSTWK', 'FRGCPT'];

  return {
    kind: validKinds.includes(kind as ProcurementFilter['kind'])
      ? (kind as ProcurementFilter['kind'])
      : 'ALL',
    business: validBusinesses.includes(business as ProcurementFilter['business'])
      ? (business as ProcurementFilter['business'])
      : 'ALL',
    unread: query.get('unread') === 'true',
  };
}
