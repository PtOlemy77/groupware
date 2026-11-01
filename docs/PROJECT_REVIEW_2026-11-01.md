**프로젝트 종합 검토 — 2026-11-01**

검토 대상: 현재 작업 디렉터리의 Next.js 프런트엔드, Spring Boot 백엔드, JPA 엔티티·저장소, 초기화 코드, 실행 설정. 구현 코드는 수정하지 않았다.

현재 상태는 **화면과 CRUD를 갖춘 업무 프로토타입**으로 판단한다. 실제 회사 데이터를 처리하기에는 인증·인가, 초기화 시 데이터 보존, 결재 통제, 금액·연도별 집계의 수정이 먼저 필요하다. 제작 도구나 모델과 관계없이 코드에서 확인되는 동작을 기준으로 판단했다.

**검증 범위와 한계**

- `npx tsc --noEmit`: 통과.
- `npm run build`: 통과. 실제 설치된 Next.js는 15.5.28. 상위 디렉터리의 lockfile을 workspace root로 추론한다는 경고가 있다.
- `cd backend && ./mvnw -q -DskipTests package`: 통과. 백엔드는 실행하지 않았다.
- 임시 Java 검사에서 실제 서비스·초기화 클래스를 메모리 저장소 프록시로 호출하고, Jackson으로 응답 직렬화를 확인했다. DB 연결 없이 12개 문제 조건을 재현했다.
- 임시 Node 검사에서 실제 TypeScript 유틸리티와 소스 AST에서 추출한 공수 집계·계약 저장 함수를 실행해 6개 문제 조건을 재현했다. 브라우저 전체 시나리오 검사는 아니다.
- `npm audit --json`: 취약점이 보고된 의존성 항목은 2개(high 1, moderate 1). 이 수치는 서로 다른 원격 공격 경로 2개가 입증됐다는 뜻이 아니다.
- 실제 PostgreSQL DDL·인덱스·데이터, 배포 프록시·TLS·네트워크, 화면 렌더링·모바일·스크린리더는 검증하지 않았다. DB 관련 평가는 저장소의 엔티티와 설정 기준이다. UI/UX 평가는 컴포넌트와 이벤트 처리 코드 기준이다.
- 초기화 코드가 데이터를 삭제할 수 있어 기존 DB를 대상으로 서버 기동·변경 API 호출은 하지 않았다.

**현재 기능 흐름**

1. 페이지가 열리면 로그인 전에도 `GET /api/groupware`로 직원·프로젝트·자산·영업·평가·결재·공통코드를 모두 요청한다.
2. 로그인은 동일 API에 `action: login`을 보내 직원을 찾고, 응답의 직원 객체를 `sessionStorage`에 보관한다. 서버 세션이나 토큰은 만들어지지 않는다.
3. React의 `activeTab`으로 화면을 바꾼다. URL별 업무 라우트는 없고, 메뉴·버튼 노출은 클라이언트의 역할 값으로 제어한다.
4. 변경은 동일 API에 `module/action/id/data`를 보내는 범용 CRUD 방식이다. 백엔드가 요청자·소속·담당 프로젝트·결재자 여부를 확인하지 않는다.
5. 프로젝트와 계약품의서는 별도 요청으로 양방향 복사한다. 공수·원가·결재선·보고서 본문은 주로 `approvals.items_json` 문자열에 저장한다.
6. 매출·가용인력·실적은 브라우저가 전체 데이터를 집계한다. 일부 기준정보는 DB 대신 사용자 브라우저의 `localStorage`에 저장한다.

직원·프로젝트·자산·평가 등 주요 화면이 있고, 코드상 역할을 공통 헬퍼로 모으려는 구조와 단일 변경의 트랜잭션은 있다. 그러나 화면에 표시하는 권한·연동·저장 완료를 서버가 보장하지 않는 경우가 많다.

**심각도 기준**

- P0: 실제 데이터 투입·외부 노출 전에 우선 차단할 문제.
- P1: 핵심 업무 결과·권한·데이터 정합성이 깨지는 문제.
- P2: 사용성·운영성·유지보수 문제. 사용 규모와 배포 환경에 따라 우선순위를 조정한다.

**R01 · P0 · 인증 없이 전체 조회·변경 가능**

근거: [SecurityConfig.java:25](../backend/src/main/java/com/nexus/groupware/config/SecurityConfig.java#L25), [GroupwareController.java:22](../backend/src/main/java/com/nexus/groupware/controller/GroupwareController.java#L22), [GroupwareService.java:134](../backend/src/main/java/com/nexus/groupware/service/GroupwareService.java#L134).

`/api/groupware/**`가 `permitAll()`이며 컨트롤러·서비스에도 요청자 권한 검사가 없다. API에 접근 가능한 사람은 로그인하지 않고 인사평가·연락처·계약원가 등을 조회하고, 직원 역할 변경·프로젝트 삭제·결재 상태 변경까지 요청할 수 있다. `@EnableMethodSecurity`만으로는 보호되지 않는다. 모든 Origin을 허용하는 CORS 설정도 있다.

조치: 인증 엔드포인트만 공개하고 업무 API는 인증을 요구한다. 서버에서 역할과 대상 데이터 접근 범위를 함께 검사하고, CORS Origin은 실제 프런트 주소로 제한한다. 메뉴 숨김은 보조 수단으로 유지한다.

**R02 · P0 · 변경한 비밀번호와 무관하게 `1234`로 로그인 가능**

근거: [GroupwareService.java:115](../backend/src/main/java/com/nexus/groupware/service/GroupwareService.java#L115), [GroupwareService.java:199](../backend/src/main/java/com/nexus/groupware/service/GroupwareService.java#L199).

검증식이 `"1234".equals(inputPw) || storedPw.equals(inputPw)`다. 실제 비밀번호를 바꾼 계정에도 `1234`가 통과했다. 비밀번호 변경은 평문으로 저장한다. 별도 PasswordEncoder 빈은 실제 로그인에 사용되지 않으며, BCrypt 문자열을 저장하면 원래 비밀번호는 거절하고 해시 문자열 자체는 받아들이는 것도 재현했다. 퇴사 상태의 계정도 통과했다.

조치: 공통 비밀번호 우회를 제거하고 모든 저장·검증을 BCrypt 등의 단일 경로로 통일한다. 초기 비밀번호 변경, 계정 활성 상태, 로그인 시도 제한을 서버에서 처리한다. 식별자는 유일한 사내 계정으로 정하고 이름·이메일 앞자리의 임의 매칭은 제거한다.

**R03 · P0 · 비밀번호가 전체 직원 조회·로그인 응답에 포함됨**

근거: [Employee.java:58](../backend/src/main/java/com/nexus/groupware/entity/Employee.java#L58), [Employee.java:125](../backend/src/main/java/com/nexus/groupware/entity/Employee.java#L125), [GroupwareService.java:54](../backend/src/main/java/com/nexus/groupware/service/GroupwareService.java#L54), [page.tsx:77](../src/app/page.tsx#L77).

엔티티를 그대로 반환하고 공개 `getPassword()`에 직렬화 제외가 없다. Jackson 응답의 `/employees/0/password`에 저장된 비밀번호가 들어가는 것을 재현했다. 프런트는 직원 객체를 세션 객체에 spread하므로 타입 정의에 없어도 해당 값이 브라우저 저장소에 들어갈 수 있다.

조치: 비밀번호가 없는 응답 DTO를 사용한다. 인사평가·계약원가·직원 연락처도 조회 목적과 권한별로 응답을 나눈다. 실제 운영 데이터로 실행했다면 기존 노출 범위 확인과 비밀번호 재설정이 필요하다.

**R04 · P0 · 서버 시작 시 운영 데이터가 예제 데이터로 대체될 수 있음**

근거: [DataInitializer.java:43](../backend/src/main/java/com/nexus/groupware/config/DataInitializer.java#L43), [DataInitializer.java:177](../backend/src/main/java/com/nexus/groupware/config/DataInitializer.java#L177), [DataInitializer.java:436](../backend/src/main/java/com/nexus/groupware/config/DataInitializer.java#L436), [DataInitializer.java:486](../backend/src/main/java/com/nexus/groupware/config/DataInitializer.java#L486), [DataInitializer.java:577](../backend/src/main/java/com/nexus/groupware/config/DataInitializer.java#L577).

프로필 제한 없는 `CommandLineRunner`가 직원 수 30명 미만, 특정 예제 프로젝트명 부재, `진행중` 상태 존재, 자산 담당자 불일치 등의 조건으로 `deleteAll()` 후 고정 데이터를 삽입한다. 결재 초기화는 인사평가도 함께 지운다. 메모리 저장소로 초기화 경로에서 직원·프로젝트·자산·평가·결재 전체 삭제 호출을 확인했다. 실제 API와 수주 전환 코드도 `진행중` 상태를 만들기 때문에 정상 업무로 초기화 조건을 다시 만족할 수 있다.

조치: 실제 DB에 연결하기 전에 자동 삭제·재입력을 제거한다. 예제 데이터는 명시적 개발 프로필과 빈 개발 DB에만 넣고, 운영 스키마·데이터 변경은 버전 관리되는 마이그레이션으로 수행한다.

**R05 · P1 · 세션이 서버 인증과 연결되지 않음**

근거: [page.tsx:98](../src/app/page.tsx#L98), [page.tsx:130](../src/app/page.tsx#L130), [SecurityConfig.java:29](../backend/src/main/java/com/nexus/groupware/config/SecurityConfig.java#L29).

`sessionStorage` JSON에 id나 사번이 있으면 로그인 상태로 복원한다. 만료·유휴 시간·서버 폐기·동시 접속 제어가 없고 로그아웃은 로컬 값만 삭제한다. 삭제된 직원이 최신 목록에서 발견되지 않아도 세션을 종료하지 않는다. 역할 동기화는 인증을 대체하지 못한다.

조치: 사내 웹앱에는 서버 세션과 HttpOnly 쿠키가 단순한 선택이다. HTTPS에서 Secure, 적절한 SameSite, CSRF 방어, 로그인 시 세션 ID 교체, 서버 로그아웃·만료 정책을 함께 구현한다. 토큰을 선택해도 서버 검증과 폐기 정책은 필요하다.

**R06 · P1 · 일반직원도 계약을 편집·저장할 수 있고 신규 계약이 바로 승인완료가 됨**

근거: [ProjectsView.tsx:815](../src/components/projects/ProjectsView.tsx#L815), [ContractWorkstationModal.tsx:226](../src/components/contract/ContractWorkstationModal.tsx#L226), [ContractWorkstationModal.tsx:346](../src/components/contract/ContractWorkstationModal.tsx#L346), [ContractWorkstationModal.tsx:415](../src/components/contract/ContractWorkstationModal.tsx#L415), [GroupwareService.java:353](../backend/src/main/java/com/nexus/groupware/service/GroupwareService.java#L353).

프로젝트 카드의 계약 버튼에 편집 권한 가드가 없고, 열린 모달의 시트에 readOnly를 전달하지 않는다. 저장 버튼도 역할·승인 상태를 검사하지 않는다. 신규 저장 기본 상태는 `승인완료`, 승인자는 현재 사용자다. 일반직원 조건으로 저장 함수를 실행했을 때 승인완료 payload 생성을 재현했다. 서버도 승인자·상태를 요청 그대로 저장한다.

조치: 초안→상신→검토·합의→최종승인/반려를 서버 상태 전이로 구현한다. 작성자·지정 결재자·처리 시각은 서버가 결정한다. 승인 후 수정은 새 버전·재결재로 처리하고 조회 화면을 별도로 제공한다.

**R07 · P1 · 계약→프로젝트 저장에서 전체 금액과 당사 금액이 섞임**

근거: [ProjectsView.tsx:415](../src/components/projects/ProjectsView.tsx#L415), [ContractWorkstationModal.tsx:141](../src/components/contract/ContractWorkstationModal.tsx#L141), [ContractWorkstationModal.tsx:160](../src/components/contract/ContractWorkstationModal.tsx#L160), [SummarySheet.tsx:118](../src/components/contract/sheets/SummarySheet.tsx#L118).

프로젝트에서 계약을 열 때 공급가액은 `ourBudget * 10`으로 생성하지만, 모달 저장은 이 금액을 다시 전체 `budget`에 넣는다. 전체 1,000만원·지분 50%·당사 500만원인 프로젝트에서 계약을 저장하면 전체 예산이 500만원으로 바뀌면서 지분 50%·당사 500만원이 유지되는 payload를 재현했다. 총괄 시트에서 프로젝트를 선택하는 경로는 다시 전체 `budget * 10`을 사용한다. 지분율 0도 유틸리티에서 100으로 바뀐다.

조치: 전체 계약금액·당사 계약금액·원가를 구분하고 저장 단위를 통일한다. 지분 반영은 서버의 한 계산식에서 수행하며 파생 금액을 독립 입력으로 받지 않는다. 해당 계약이 전체 금액 기준인지 당사 금액 기준인지 업무 규칙부터 확정한다.

**R08 · P1 · 연도별 매출 등 UI 입력 필드가 저장되지 않음**

근거: [ProjectsView.tsx:198](../src/components/projects/ProjectsView.tsx#L198), [Project.java:7](../backend/src/main/java/com/nexus/groupware/entity/Project.java#L7), [BusinessDeal.java:7](../backend/src/main/java/com/nexus/groupware/entity/BusinessDeal.java#L7), [GroupwareService.java:205](../backend/src/main/java/com/nexus/groupware/service/GroupwareService.java#L205).

프런트의 `yearly_revenue_json`은 프로젝트·영업 엔티티와 저장 로직에 없다. 영업의 `start_date/end_date/target_year`도 저장 대상이 아니다. 서비스 호출 후 직렬화한 프로젝트에서 연도별 매출 필드가 사라지는 것을 확인했다. 화면에서 수정해도 재조회하면 수기 배분이 사라지거나 다시 자동 계산된다.

조치: API 요청·응답 계약과 실제 스키마를 맞춘다. 프로젝트·영업 연도별 매출은 별도 테이블로 저장하고 원금액과 배분 합계를 검증한다. 지원하지 않는 필드는 성공 응답으로 묵살하지 않는다.

**R09 · P1 · 사업 기간 밖 연도에 전체 매출이 잡힘**

근거: [groupware.ts:505](../src/types/groupware.ts#L505), [DashboardView.tsx:112](../src/components/dashboard/DashboardView.tsx#L112).

`calculated[targetYear] ?? ourBudget` 때문에 대상 연도가 없으면 0 대신 전체 당사 금액을 반환한다. 2027년만 수행하는 12,000만원 프로젝트를 2026년으로 조회해도 12,000만원이 집계되는 것을 재현했다. 대시보드는 연도 2026 고정이고 영업금액도 별도로 합산하여 기간·수주 전환 중복 처리 정책이 불명확하다.

조치: 기간 밖 연도는 0을 반환한다. 매출 인식 기준, 확정·예상 금액, 영업→프로젝트 전환 시 중복 제외 규칙을 서버에서 통일한다.

**R10 · P1 · 연간 공수가 다른 연도에도 잡히고 다년도 월 인덱스가 어긋남**

근거: [ManpowerWorkloadView.tsx:105](../src/components/projects/ManpowerWorkloadView.tsx#L105), [ManpowerWorkloadView.tsx:185](../src/components/projects/ManpowerWorkloadView.tsx#L185), [ProjectsView.tsx:404](../src/components/projects/ProjectsView.tsx#L404).

계약 연도가 선택 연도와 다르면 기본 4~11월을 사용한다. 2027년 계약의 2026년 공수가 8 M/M으로 잡히는 것을 재현했다. 다년도 계약도 연도별로 원본 월 배열의 시작 오프셋을 계산하지 않는다. 배열 값이 없으면 1 M/M을 넣어 미입력을 실제 투입으로 집계한다. 계약이 없는 프로젝트도 구성원이라는 이유로 매월 1 M/M을 추정한다. 신규 계약 인력 생성은 최대 12개월로 제한한다.

조치: 직원 ID·실제 `YYYY-MM`별 투입계획을 저장하고 기간 교집합으로 집계한다. 미입력·추정·확정 계획을 구분하고, 월별 용량 검증과 휴직·입퇴사일 반영을 업무 규칙으로 정한다.

**R11 · P1 · 연동 저장·삭제가 원자적이지 않고 HTTP 실패를 성공처럼 처리함**

근거: [ProjectsView.tsx:209](../src/components/projects/ProjectsView.tsx#L209), [ProjectsView.tsx:315](../src/components/projects/ProjectsView.tsx#L315), [ContractWorkstationModal.tsx:152](../src/components/contract/ContractWorkstationModal.tsx#L152), [WeeklyMonthlyReportView.tsx:377](../src/components/projects/WeeklyMonthlyReportView.tsx#L377).

프로젝트와 계약을 여러 fetch로 저장·삭제하므로 두 번째 요청 실패 시 한쪽만 변경된다. 서비스의 단일 요청 `@Transactional`은 브라우저의 여러 요청을 묶지 못한다. 다수 저장·삭제 경로는 `res.ok`를 확인하지 않아 HTTP 400/500에도 창을 닫거나 성공 알림을 표시한다. fetch는 HTTP 오류만으로 reject되지 않는다.

조치: 연동 업무를 서버의 단일 트랜잭션 API로 옮긴다. 프런트 API 클라이언트에서 비정상 응답을 일관되게 오류 처리하고, 실패 시 입력을 유지한다. 중복 제출·재시도에는 idempotency 정책을 둔다.

**R12 · P1 · 부분 수정이 다른 필드를 초기화하고 없는 ID 수정은 신규 생성됨**

근거: [GroupwareService.java:158](../backend/src/main/java/com/nexus/groupware/service/GroupwareService.java#L158), [GroupwareService.java:170](../backend/src/main/java/com/nexus/groupware/service/GroupwareService.java#L170), [GroupwareService.java:186](../backend/src/main/java/com/nexus/groupware/service/GroupwareService.java#L186).

여러 모듈이 `findById(...).orElse(new Entity())`를 사용한다. 없는 ID의 update가 신규 엔티티 생성으로 진행되는 것을 재현했다. 직원의 역할만 업데이트해도 이름·연락처·입사일·연차 등이 기본값으로 덮인다. 잘못된 action도 일부 모듈에서는 생성 경로로 진행하고, 알 수 없는 모듈은 성공처럼 끝날 수 있다.

조치: create/update/delete를 명확히 분리하고 없는 대상은 404를 반환한다. PUT은 완전한 DTO를 검증하고 PATCH는 전달된 필드만 수정한다. 지원하지 않는 module/action은 400으로 거절한다.

**R13 · P1 · DB 관계·식별자·값 범위 제약이 부족함**

근거: [Equipment.java:28](../backend/src/main/java/com/nexus/groupware/entity/Equipment.java#L28), [Project.java:25](../backend/src/main/java/com/nexus/groupware/entity/Project.java#L25), [Employee.java:31](../backend/src/main/java/com/nexus/groupware/entity/Employee.java#L31), [GroupwareService.java:219](../backend/src/main/java/com/nexus/groupware/service/GroupwareService.java#L219), [EmployeesView.tsx:409](../src/components/employees/EmployeesView.tsx#L409).

엔티티 기준으로 직원·프로젝트·평가·자산·결재 간 FK가 없고, 이름·사번·부서명을 중복 저장한다. 직원 삭제·개명·이동 후 자산 담당자와 평가·공수가 어긋날 수 있으며 동명이인을 구별하지 못한다. 이메일은 유일 제약이 없고 사번 기본값은 입사일이어서 같은 날 입사자가 충돌한다. 프로젝트·문서 발번도 목록 길이 또는 좁은 난수 범위를 사용한다.

진행률 999, 지분율 150, 예산 -100이 서비스에서 허용되는 것을 확인했다. 날짜는 String이라 타입 수준에서 잘못된 날짜·기간 역전을 막지 못한다. `nullable=false`는 빈 문자열과 업무 범위를 검증하지 않는다.

조치: 직원 ID·프로젝트 ID 기반 FK, 고유 계정·사번·문서번호, 평가 대상+평가기간의 업무상 유일성, 날짜 타입, 금액·점수·비율·배분 합계 제약을 도입한다. 금액·비율에는 단위를 명확히 정한 정수 또는 BigDecimal을 사용한다. 이름 스냅샷은 이력 목적일 때만 의도적으로 보존한다.

**R14 · P1 · 동시 수정 충돌과 결재 변경 이력을 추적할 수 없음**

근거: [Approval.java:7](../backend/src/main/java/com/nexus/groupware/entity/Approval.java#L7), [WeeklyMonthlyReportView.tsx:267](../src/components/projects/WeeklyMonthlyReportView.tsx#L267), [WeeklyMonthlyReportView.tsx:398](../src/components/projects/WeeklyMonthlyReportView.tsx#L398).

엔티티에 `@Version`이나 변경 이력이 없고, 한 기간의 여러 프로젝트 보고서를 하나의 JSON으로 저장한다. 두 PM이 같은 버전을 열고 각각 저장하면 먼저 저장한 내용을 나중 저장이 덮을 수 있다. 계약도 모든 시트를 한 번에 덮는다. 현재 승인자 문자열·상태만으로는 누가 어떤 본문에 결재했는지 복원하기 어렵다. 프로젝트 변경 시 인력목록·공급가액만 바꾸고 원가·이익 합계를 다시 계산하지 않는 경로도 있다.

조치: 버전 필드와 충돌 응답을 도입하고, 프로젝트별 보고 항목을 독립 저장한다. 결재 이벤트·본문 버전·수정자·서버 시각을 남기고 승인된 버전을 잠근다. 합계는 서버에서 재계산한다.

**R15 · P1 · 기준정보 저장과 실제 원가 계산이 연결되지 않음**

근거: [MasterDataView.tsx:167](../src/components/master/MasterDataView.tsx#L167), [MasterDataView.tsx:196](../src/components/master/MasterDataView.tsx#L196), [ManpowerSheet.tsx:165](../src/components/contract/sheets/ManpowerSheet.tsx#L165), [ProjectsView.tsx:355](../src/components/projects/ProjectsView.tsx#L355).

노임단가·목표매출은 localStorage에 저장되어 다른 브라우저·직원에게 공유되지 않는다. 인력 시트는 저장된 단가 대신 `STANDARD_UNIT_PRICES.price2026`, 프로젝트 기본 인력 생성은 별도 하드코딩 값을 사용한다. 관리자가 단가 저장 완료를 봐도 실제 계약 인건비가 바뀌지 않는다. 화면별 직급→등급·단가 매핑도 다르다.

조치: 연도·적용기간별 기준정보를 DB와 API로 통일한다. 신규 계약은 해당 기준 버전을 사용하고 승인된 기존 계약은 당시 단가 스냅샷을 유지한다.

**R16 · P1 · 부서 코드가 프런트·백엔드·공통코드로 분산됨**

근거: [DepartmentCode.java:9](../backend/src/main/java/com/nexus/groupware/code/DepartmentCode.java#L9), [DepartmentCode.java:35](../backend/src/main/java/com/nexus/groupware/code/DepartmentCode.java#L35), [groupware.ts:397](../src/types/groupware.ts#L397), [GroupwareService.java:180](../backend/src/main/java/com/nexus/groupware/service/GroupwareService.java#L180).

프런트는 `대표이사/경영지원팀`, 백엔드는 `사장/경영지원`을 사용한다. 알 수 없는 부서는 오류 대신 기술연구소로 바꾼다. 부서명만 `경영지원팀`으로 보내는 자산·평가 등의 경로에서는 잘못 분류될 수 있다. 공통코드를 수정해도 Java enum과 TypeScript 상수는 바뀌지 않는다.

조치: 부서·직급·상태는 안정적인 코드로 통신하고 라벨은 표시용으로 사용한다. 관리 가능한 코드와 코드에 고정된 enum의 역할을 구분한다. 잘못된 코드는 검증 오류로 반환한다.

**R17 · P1 · API 주소가 사용자 PC의 localhost로 고정됨**

근거: [page.tsx:53](../src/app/page.tsx#L53), [LoginPage.tsx:33](../src/components/LoginPage.tsx#L33), [ContractWorkstationModal.tsx:238](../src/components/contract/ContractWorkstationModal.tsx#L238).

브라우저 fetch가 모두 `http://localhost:8080`이다. 회사 서버에 프런트를 배포해도 각 직원 PC의 8080 포트로 요청한다. HTTPS 배포에서는 HTTP 호출과 브라우저 보안 제약도 고려해야 한다.

조치: 동일 출처 `/api` 프록시 또는 환경별 API base URL을 공통 클라이언트에 둔다. 개발·검증·운영 설정을 분리한다.

**R18 · P2 · 탭 권한 가드와 실제 본문 분기가 다르고 일부 기능이 연결되지 않음**

근거: [page.tsx:151](../src/app/page.tsx#L151), [page.tsx:188](../src/app/page.tsx#L188), [page.tsx:227](../src/app/page.tsx#L227), [Sidebar.tsx:46](../src/components/layout/Sidebar.tsx#L46).

권한 가드에서 계산한 `effectiveTab`은 헤더·사이드바에만 전달하고 본문은 `activeTab`으로 렌더링한다. 권한이 바뀌거나 금지 탭 상태가 남으면 본문이 그대로 유지될 수 있다. 결재·영업 탭도 전용 컴포넌트 대신 ProjectsView를 렌더링하며 사이드바에는 해당 진입점이 없다. 구현된 영업·결재 컴포넌트를 실제로 제공할지 제거할지 정리가 필요하다.

조치: 본문도 같은 가드를 사용하고 권한 변경 시 선택 상태를 정리한다. 업무별 URL을 두면 새로고침·뒤로가기·직접 링크·접근성 개선에도 유리하다.

**R19 · P1 · 보고서 기본값에 작성하지 않은 실적·피드백이 포함되고 조회 중 자동 저장됨**

근거: [WeeklyMonthlyReportView.tsx:70](../src/components/projects/WeeklyMonthlyReportView.tsx#L70), [WeeklyMonthlyReportView.tsx:175](../src/components/projects/WeeklyMonthlyReportView.tsx#L175), [WeeklyMonthlyReportView.tsx:296](../src/components/projects/WeeklyMonthlyReportView.tsx#L296), [WeeklyMonthlyReportView.tsx:329](../src/components/projects/WeeklyMonthlyReportView.tsx#L329).

기간 목록이 특정 2026년 9~11월로 고정돼 있다. 보고가 없어도 정상 수행 문장, 사장 피드백·보고 시각, 특정 프로젝트의 제출완료 표시를 기본으로 만든다. 특정 주간보고는 화면 진입 시 useEffect가 자동 저장한다. 작성하지 않은 내용을 실적·결재 기록처럼 보이게 할 수 있고 동시 진입 시 문서번호 충돌도 가능하다.

조치: 운영 기본값은 미작성·빈 본문으로 하고 명시적 저장/제출 시에만 기록한다. 예제 내용은 개발 데이터로 분리한다. 기간 목록은 실제 달력에서 만들고 제출·확인 시각은 서버에서 생성한다.

**R20 · P2 · 장애·미저장·모바일·키보드 사용 흐름이 부족함**

근거: [page.tsx:50](../src/app/page.tsx#L50), [Sidebar.tsx:97](../src/components/layout/Sidebar.tsx#L97), [LoginPage.tsx:82](../src/components/LoginPage.tsx#L82), [ContractWorkstationModal.tsx:424](../src/components/contract/ContractWorkstationModal.tsx#L424), [EvaluationsView.tsx:73](../src/components/evaluations/EvaluationsView.tsx#L73).

- 전체 조회 실패를 console에만 남겨 빈 목록·0원과 장애를 구분하기 어렵다. 재시도·오류 배너·마지막 갱신 시각이 필요하다.
- 큰 계약·보고서 편집창을 닫거나 기간·탭을 바꿀 때 미저장 변경 확인이 없다. 임시저장과 이탈 방지가 필요하다.
- 사이드바가 고정 `w-72`이며 모바일 접힘 동작이 없다. 다열 편집폼·표와 함께 작은 화면에서 검증해야 한다.
- 주요 모달에 dialog 의미·포커스 이동/복귀·포커스 가두기·Escape 닫기 처리가 확인되지 않는다. 로그인 label 연결, 아이콘 버튼 이름도 보완이 필요하다.
- 인사평가 등급은 프런트가 90/80/70, 서버가 93/87/78/68 기준을 사용한다. 예를 들어 90점은 클라이언트 계산 S, 서버 저장 A다. 업무 규칙을 통일해야 한다.
- 페이지네이션 없이 전체 데이터·계약 JSON을 매번 다시 받는다. 사용자 증가와 문서 누적 시 요청·집계 비용이 커진다. 범위 조회와 서버 필터·페이지네이션이 필요하다.

**R21 · P2 · 운영·검증 체계가 개발 PC에 의존함**

근거: [pom.xml:22](../backend/pom.xml#L22), [mvnw:1](../backend/mvnw#L1), [application.yml:8](../backend/src/main/resources/application.yml#L8), [docker-compose.yml:6](../docker-compose.yml#L6), [package-lock.json](../package-lock.json).

테스트 디렉터리·테스트 의존성이 없고 POM에 테스트 생략이 기본 설정되어 있다. `mvnw`는 표준 Maven Wrapper 대신 특정 IntelliJ·JDK 절대 경로를 실행한다. DB 자격정보가 설정에 고정되어 있고 PostgreSQL 포트는 호스트 주소 제한 없이 게시된다. `ddl-auto:update`는 변경 버전·롤백을 관리하지 않으며 프로필별 운영 설정·백업 복구 절차·CI는 저장소에서 확인되지 않았다.

`npm audit`는 Next.js 하위 PostCSS에 high 등급 항목을 보고했다. 공식 [PostCSS 보안 권고](https://github.com/postcss/postcss/security/advisories/GHSA-6g55-p6wh-862q)는 공격자 제어 CSS를 처리할 때의 파일 읽기·정보 노출 조건을 설명한다. 이 프로젝트에서 해당 입력 경로로 공격 가능한지는 확인하지 않았으므로 의존성 취약점과 실제 악용 가능성은 구별해야 한다. 검증된 업데이트 조합으로 재빌드·회귀 확인이 필요하다.

조치: 표준 빌드 도구, 환경변수·프로필, 버전 마이그레이션, DB 포트 제한, 테스트·CI와 백업/복구 검증을 도입한다. 최소 회귀 대상은 비로그인 접근 거절·역할별 접근·비밀번호 변경·초기화 보존·승인 전이·연도별 집계·원자적 저장·동시 수정이다.

**권장 DB 재구성 방향**

현재의 7개 업무 테이블을 모두 버릴 필요는 없다. 화면과 CRUD를 살리면서 관계·이력·업무 규칙을 단계적으로 보강할 수 있다.

| 영역 | 권장 저장 구조와 제약 |
| --- | --- |
| 계정 | employees와 연결한 accounts, 정규화된 유일 username/email, password_hash, 활성 상태, 역할, 감사 시각 |
| 조직 | departments, positions, 필요 시 소속 변경 이력. 직원·프로젝트는 코드/FK 참조 |
| 프로젝트 | projects에 PM 직원 FK, 기간·전체 계약금액·당사 지분율. project_members로 직원 관계 관리 |
| 연도별 매출 | project_revenues(project_id, year, amount), 영업도 대응 구조. 연도별 유일성과 합계 검증 |
| 계약·원가 | contracts에 project_id FK와 계약 버전. 원가·인력·외주·경비 항목을 구조화하고 합계는 서버 계산 |
| 월별 공수 | assignments와 assignment_months에 employee_id, 실제 year_month, M/M. 명시적 추정·확정 구분 |
| 결재 | approval_requests, approval_steps, approval_events. 지정 결재자 FK, 상태 전이, 승인 본문 버전과 서버 시각 |
| 보고서 | reports(period,type)와 report_items(report_id,project_id). 항목별 버전·작성자·제출 상태 |
| 평가 | evaluations에 대상 직원·평가자 FK, 기간·점수 범위·확정 상태·버전. 업무에 맞는 중복 방지 |
| 자산 | equipment에 현재 담당 직원 FK, equipment_assignments로 대여·반납 이력 |
| 기준정보 | 연도·유효기간·버전을 가진 unit_prices/revenue_targets. 과거 계약의 적용 단가는 스냅샷 보존 |

JSON 자체가 문제는 아니다. 변경 불가능한 계약 스냅샷이나 비정형 확장에는 사용할 수 있다. 다만 관계·조회·권한·공수·결재 상태를 JSON 문자열 하나에만 의존하지 않도록 하고, 사용할 때도 스키마와 버전을 검증한다.

**권장 수정 순서와 완료 기준**

1. **데이터 보존과 접근 통제:** 초기화 삭제 제거, DB 백업, R01~R05 수정. 비로그인 조회·변경 거절, 비밀번호 미노출, 재시작 전후 업무 데이터 유지가 확인되어야 한다.
2. **핵심 업무 정합성:** 계약의 금액·지분 기준 확정, 결재 상태 전이, 연도별 매출·공수, 연동 트랜잭션 수정. 저장→재조회→재편집에도 금액·인력·상태가 유지되어야 한다.
3. **스키마와 충돌 방지:** FK·고유 제약·날짜/숫자 검증·버전·감사 이력·마이그레이션 적용. 동시 수정 시 손실 대신 충돌이 표시되어야 한다.
4. **실제 사용 흐름:** 메뉴 연결, 실패·빈 상태, 미저장 보호, 동적 기간, 모바일·키보드 검증, 운영 빌드와 CI 정리.

현재 우선순위는 디자인 세부 조정보다 인증과 데이터 보존이다. 그다음 실제 업무의 금액·공수·결재가 일관되게 저장되는지 확보하는 것이 적절하다.
