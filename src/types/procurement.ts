/**
 * 공고 종류
 * ALL: 전체, BID: 입찰공고, SPEC: 사전규격
 */
export type NoticeKind = 'ALL' | 'BID' | 'SPEC';

/**
 * 업무 구분
 * ALL: 전체, SERVC: 용역, THNG: 물품, CNSTWK: 공사, FRGCPT: 외자
 */
export type BusinessType = 'ALL' | 'SERVC' | 'THNG' | 'CNSTWK' | 'FRGCPT';

/**
 * 관심조건 입력 폼 데이터 인터페이스
 */
export interface ProcurementRuleInput {
  name: string;
  keywords: string;
  excluded_keywords: string;
  institutions: string;
  match_mode: 'AND' | 'OR';
  notice_kind: NoticeKind;
  business_type: BusinessType;
  enabled: boolean;
}

/**
 * 저장된 관심조건 엔티티 인터페이스
 */
export interface ProcurementRule extends ProcurementRuleInput {
  id: number;
  version: number;
}

/**
 * 나라장터 수집 공고 원천 데이터
 */
export interface ProcurementNotice {
  id: number;
  kind: 'BID' | 'SPEC';
  business_type: BusinessType;
  external_id: string;
  revision: string;
  title: string;
  agency: string;
  demand_agency: string;
  published_at: string;
  changed_at: string;
  deadline: string;
  budget: string;
  notice_status: string;
  source_url: string;
}

/**
 * 사용자별 매칭된 공고 알림 내역
 */
export interface ProcurementAlert {
  id: number;
  version: number;
  read_on: string | null;
  created_on: string;
  matched_rules: string;
  notice: ProcurementNotice;
}

/**
 * 네비게이션 및 URL 해시 연동용 필터 상태
 */
export interface ProcurementFilter {
  kind: NoticeKind;
  business: BusinessType;
  unread: boolean;
}

/**
 * 카테고리별 미읽음 알림 카운트
 */
export interface ProcurementCategoryCount {
  kind: 'BID' | 'SPEC';
  business_type: Exclude<BusinessType, 'ALL'>;
  count: number;
}

/**
 * 나라장터 연동 엔진 상태 정보
 */
export interface ProcurementStatus {
  configured: boolean;
  enabled: boolean;
  running: boolean;
  can_sync: boolean;
  interval_minutes: number;
  business_types: BusinessType[];
  unread: number;
  unread_categories: ProcurementCategoryCount[];
  sources: {
    source: string;
    last_success: string | null;
    last_error: string | null;
    last_attempt: string | null;
    backlog: boolean;
    next_page: number;
  }[];
}

/**
 * 업무 구분 한글 라벨 맵
 */
export const businessLabels: Record<BusinessType, string> = {
  ALL: '전체 업무',
  SERVC: '용역',
  THNG: '물품',
  CNSTWK: '공사',
  FRGCPT: '외자',
};
