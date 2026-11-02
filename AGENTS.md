# AI 에이전트 작업 규칙

이 저장소의 구현·문서·검증 작업에 적용한다. 작업 전에 이 파일과 [하네스 기준](harness/HARNESS_ENGINEERING.md)을 읽는다.

## 프로젝트와 기준 문서

- 공개 포털 및 임직원 그룹웨어: React 19, Vite, TypeScript, Tailwind CSS v4, Lucide React.
- 백엔드: Spring Boot 3.4.5, Java 21 이상. CI 기준 JDK는 21이며 개발 환경에서 25를 사용할 수 있다.
- DB: PostgreSQL 16, 개발 기본 포트 5433, DB명 `groupware_db`.
- 요구사항: [PRD](harness/prd.md). UI 범위별 규칙: [디자인 가이드](harness/design.md).
- 현재 DB 구조의 기준은 [Flyway 마이그레이션](backend/src/main/resources/db/migration)이다. [DB 구조 안내](export/DATABASE_SPECIFICATION.md)는 이를 설명한다. 과거 추출본은 최신 스키마의 기준이 아니다.

## 필수 불변식

1. **기존 데이터 보존**: 모든 데이터는 별도 실행을 하기전까지는 서버 기동시 변경하지 말고, `DataInitializer`는 최신 데이터 상태로 유지한다. 데이터 작업은 별도 백업·대상 확인·명시적 유지보수 절차로 수행한다.
2. **코드 기반 판정**: 권한은 `RoleCode`, 직급은 `PositionCode`, 부서는 `DepartmentCode`, 재직 상태는 `StatusCode`, 프로젝트 단계는 `ProjectStageCode`를 사용한다. 표시용 한글 라벨로 권한·업무 분기를 추가하지 않는다. 레거시 입력 정규화와 표시용 라벨은 구분한다. DB 관리 코드와 고정 시스템 코드는 [PRD](harness/prd.md)의 구분을 따른다.
3. **전역 알림·확인**: `useModal()`의 `showAlert`·`showConfirm`만 사용한다. `window.alert/confirm`, 전역 함수 치환, 네이티브 함수로의 fallback은 금지한다. 확인 결과를 `await`한 뒤 작업한다. 브라우저가 직접 제공하는 미저장 페이지 이탈 보호(`beforeunload`)는 별도 기능이며 앱 확인창 대용으로 사용하지 않는다.
4. **PK/FK 관계**: 모든 테이블 관계는 ID(PK/FK)로 연결한다.
5. **충돌 방지**: 기존 업무 데이터의 수정·삭제·결재 전이는 조회 당시 `version`이 필수다. 누락은 400, 오래된 버전은 409로 거절한다. 연동 저장은 관련 프로젝트 버전도 검사한다. `@Version`만으로 클라이언트의 오래된 편집을 검출한다고 가정하지 않는다.
6. **민감 데이터 분리**: 실제 직원·평가·계약 데이터, 계정 비밀, 비밀번호 해시를 문서·테스트 픽스처·스크린샷·로그에 넣지 않는다. 테스트는 식별 가능한 합성 자료를 사용한다. 개인용 CSV·전체 덤프는 Git 추적에서 제외한다. Git 추적 제외가 과거 커밋의 삭제를 의미하지는 않는다.

## 검증 게이트: 저장소 루트에서 실행

```sh
npm run verify
# UI·탐색·인증·브라우저 동작 변경, 또는 전체 회귀 확인
npm run verify:full
```

명령의 단일 정의는 [scripts/verify.mjs](scripts/verify.mjs)다. `verify`는 정적 하네스 검사, TypeScript, Node/SQL 테스트, Maven `verify`(Java 테스트·JAR 패키징), 프론트엔드 빌드를 순서대로 실행한다. `verify:full`은 여기에 Vite 프로덕션 빌드 기반 브라우저 검증을 추가한다. CI는 전체 게이트와 의존성 감사를 실행한다.

Java 21 이상을 기본 Java로 선택하거나 호출 환경의 `JAVA_HOME`을 지정한다. 개인 PC의 절대 JDK 경로를 공통 문서·스크립트에 고정하지 않는다. 브라우저는 최초 1회 `npx playwright install chromium`으로 준비하거나 `BROWSER_EXECUTABLE`을 지정한다. 실패·미실행 항목은 완료 보고에 명시하며 전체 통과로 표현하지 않는다.

## 작업 흐름

1. 변경 전 `git status`를 확인하고 다른 작업자의 수정은 보존한다. 요청 범위, 영향 파일, 완료 기준을 정한다.
2. DB·API·TypeScript 계약과 기존 데이터 보존 범위를 확인한다. 새 스키마는 새 Flyway 파일로 추가하고 적용 이력이 있는 파일은 수정하지 않는다.
3. 필요한 범위만 구현한다. 공통 코드 변경은 호출부 영향을 확인한다. 인접 기능 리팩토링·전체 포맷 변경은 섞지 않는다.
4. 동작·권한·데이터 보존을 검증하는 테스트를 추가하고 해당 게이트를 실행한다. 운영 DB를 테스트 대상으로 쓰지 않는다.
5. 검증 결과와 제한을 기록하고 대상 파일만 명시적으로 커밋·푸시한다. 작업 완료는 운영 배포 완료와 구분한다. 공유 브랜치 강제 푸시·Git 이력 재작성·운영 데이터 변경은 일반 코드 정비에 포함하지 않는다.
