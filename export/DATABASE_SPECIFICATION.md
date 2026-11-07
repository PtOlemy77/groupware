# 데이터베이스 구조 안내

이 문서는 공유용 구조 명세이며 직원·연락처·평가·계약 본문·비밀번호 해시 등 행 데이터를 포함하지 않는다.

## 기준과 갱신

현재 DDL의 기준은 [Flyway 마이그레이션](../backend/src/main/resources/db/migration)이다. 엔티티는 [백엔드 엔티티](../backend/src/main/java/com/nexus/groupware/domain)를 함께 확인한다. 과거 `export/schema/groupware_schema.sql`은 2026-11-01 시점의 스냅샷이며 최신 복구·신규 설치에 사용하지 않는다.

| 버전 | 변경 |
| --- | --- |
| [V1](../backend/src/main/resources/db/migration/V1__preserve_and_secure_schema.sql) | 기존 업무 행 보존, ID 관계·날짜·버전·감사 시각·보안 컬럼·제약 추가 |
| [V2](../backend/src/main/resources/db/migration/V2__enforce_code_columns.sql) | 상태·프로젝트 단계 코드 정규화 및 코드 컬럼 보강 |
| [V3](../backend/src/main/resources/db/migration/V3__portal_notices.sql) | 공개/비공개 공지, 작성자 FK, 버전 및 정렬 인덱스 |

## 주요 테이블과 관계

| 테이블 | 역할 | 주요 관계·제약 |
| --- | --- | --- |
| `employees` | 임직원·인증 계정 | 사번·정규화 이메일 고유성, 역할·조직·직급·재직 코드, 비밀번호 해시는 외부 응답/추출 금지 |
| `projects` | 프로젝트·기간·금액·지분 | `pm_id → employees.id`, 날짜·금액·비율 범위, 버전 |
| `project_members` | 프로젝트 참여 인력 | `project_id → projects.id`, `employee_id → employees.id`, 복합 키 |
| `approvals` | 계약·보고·결재 문서 | 작성자·결재자·프로젝트 ID, 버전, 승인 본문 보존 |
| `business_deals` | 영업·수주 전환 | 담당자·전환 프로젝트 ID, 금액·기간·연도별 배분 |
| `equipments` | 자산·담당자 | `emp_id → employees.id`, 상태 코드, 버전 |
| `evaluations` | 직원 평가 | 대상·평가자 FK, 점수 범위·평가기간, 버전 |
| `common_codes` | 관리 가능한 기준정보 | `(group_code, code)` 고유성, 사용 여부·순서, 버전 |
| `audit_events` | 업무 변경 감사 | 요청자 ID·대상 ID·작업·서버 시각·안전한 스냅샷. 업무 테이블과 같은 편집 API를 제공하지 않음 |
| `portal_notices` | 공개 포털 공지 | `created_by_id → employees.id`, 비공개 기본값, 게시 여부·고정·버전, 제목 200자·본문 20,000자 제한 |
| `flyway_schema_history` | 적용 이력 | Flyway가 관리하며 업무 API에서 수정하지 않음 |

컬럼의 타입·NULL·기본값·인덱스·FK의 정확한 정의는 각 마이그레이션을 확인한다. 이 요약을 DDL 복제본으로 취급하지 않는다. 코드 표시용 라벨과 과거 문서 스냅샷은 ID 관계의 대체 수단이 아니다.

## 단위와 동시 수정

프로젝트 금액은 만원, 계약 문서 원가는 천원이며 서버에서 연동 단위와 합계를 검증한다. 수정·삭제에는 조회 당시 `version`이 필요하다. 코드로 관리하는 상태는 표시용 한글 문자열과 구분한다.

## 추출본 보관

CSV와 전체 SQL 덤프는 개인 보관 자료이며 Git 추적 대상이 아니다. 기존 로컬 파일은 정비 과정에서 삭제하지 않았다. 보관·접근·파기는 회사 정책에 따른다. 공유용 예제는 식별 가능한 합성 데이터만 사용한다.

추적 제외는 과거 Git 이력에서 자료를 지우지 않는다. 과거 노출 범위·접근권한·자격정보 대응은 별도 검토가 필요하며 이 정비는 Git 이력을 재작성하지 않는다.
