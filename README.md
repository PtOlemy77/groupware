# SPATIAL T 포털·그룹웨어

React 19 / Vite / TypeScript, Spring Boot 3.4.5 / Java 21 이상, PostgreSQL 16 기반이다. 공개 포털은 루트 화면, 그룹웨어 진입은 `/#groupware`, 개인정보 처리방침은 `/#privacy`다.

작업 규칙은 [AGENTS.md](AGENTS.md), 명세와 검증 범위는 [하네스 기준](harness/HARNESS_ENGINEERING.md), 현재/계획 기능은 [PRD](harness/prd.md)를 확인한다. 최근 정비 결과는 [2026-11-02 정비 기록](harness/MAINTENANCE_2026-11-02.md)에 정리했다.

## 개발 실행

1. Java 21 이상, Node.js 22 이상, Docker를 준비한다.
2. `.env.example`을 `.env`로 복사하고 DB·부트스트랩 설정을 실제 값으로 변경한다. `.env`는 Git에서 제외된다.
3. 터미널에서 `set -a; source .env; set +a`로 환경변수를 불러온다.
4. `docker compose up -d postgres`로 개발 DB를 실행한다.
5. 루트에서 `./backend/mvnw -f backend/pom.xml spring-boot:run`을 실행한다.
6. 같은 환경변수를 불러온 별도 터미널에서 `npm ci`, `npm run dev`를 실행한다.
7. http://localhost:3000 에서 임직원 로그인으로 이동한다. 직원 테이블이 비어 있고 부트스트랩 설정이 있는 경우에만 최초 관리자가 생성되며 최초 로그인에서 비밀번호를 변경한다.

Java는 실행 환경의 `JAVA_HOME` 또는 기본 Java를 사용한다. Maven launcher는 설치된 Maven을 우선 사용하며, 없으면 지정 버전을 내려받아 SHA-512를 검증한다. 개인 IDE·JDK 절대 경로를 요구하지 않는다.

## 검증

```sh
npm run verify
# UI·인증·탐색 변경 또는 전체 회귀 검사
npx playwright install chromium
npm run verify:full
```

정확한 실행 순서의 기준은 [verify.mjs](scripts/verify.mjs)다. 전체 모드는 타입·Node/SQL 테스트·Java 테스트/JAR·프론트 빌드·브라우저 검사를 실행한다. `npm run test:e2e`만 실행할 수도 있으며 이 경우 프론트 빌드부터 수행한다. CI는 전체 모드와 의존성 감사를 실행한다.

브라우저 테스트는 새 H2 메모리 DB와 127.0.0.1의 13000·18080 포트를 사용한다. 사용 중인 포트가 있으면 중단하며 기존 서버를 종료하지 않는다. 설치된 Chrome을 쓸 때는 `BROWSER_EXECUTABLE`에 실행 파일 경로를 지정한다. 로그·합성 데이터 캡처는 Git에서 제외되는 `test-results/e2e/`에 남긴다. 운영 DB에는 테스트 자료를 쓰지 않는다.

## API 연결과 운영 배포

- 브라우저는 같은 출처의 `/api`를 호출한다. 개발 `vite`와 로컬 검증용 `vite preview`는 실행 시 `API_INTERNAL_URL`을 읽어 백엔드에 프록시한다. 기본값은 `http://127.0.0.1:8080`이다.
- `npm run build` 결과는 `dist/`의 정적 파일이다. **운영 정적 호스팅은 `/api` 역방향 프록시를 별도로 구성해야 한다.** 환경변수를 넣어 프론트를 빌드하는 것만으로 운영 프록시가 생기지 않는다. `vite preview`를 운영 서버로 사용하지 않는다.
- 앞단은 HTTPS로 제공하고 백엔드·DB는 내부망으로 제한한다. `SPRING_PROFILES_ACTIVE=prod`는 Secure 쿠키와 Flyway 자동 baseline 금지를 적용한다.
- 세션 쿠키는 HttpOnly·SameSite=Strict, 요청 변경은 CSRF 검증을 사용한다. 유휴 세션 30분·최대 12시간·계정당 3세션 및 로그인 시도 제한이 있다. 역할·계정 상태·자격 버전을 서버에서 검사한다.
- 코드 커밋·푸시, 빌드 검증, 운영 배포·마이그레이션 적용은 서로 다른 상태다. 배포 후 환경·접속·로그·업무 흐름을 따로 확인한다.

## 기존 DB 업그레이드와 계정 복구

- 먼저 백업하고 격리 복원 환경에서 마이그레이션을 검증한다. 현재 구조의 기준은 [Flyway](backend/src/main/resources/db/migration)이며 [DB 안내](export/DATABASE_SPECIFICATION.md)는 데이터 없는 요약이다.
- 중복 이메일·잘못된 날짜·고아 참조로 제약을 적용할 수 없으면 원본을 삭제하거나 이름으로 임의 연결하지 말고 실제 ID와 자료를 확인한다.
- 기존 직원이 한 명이라도 있으면 `DataInitializer`는 기존 계정·비밀번호·권한·상태를 변경하지 않는다. **환경변수를 바꾼 뒤 재시작해도 기존 관리자 계정은 복구되지 않는다.**
- 평문 비밀번호 자동 전환과 계정 자동 비활성화는 서버 기동에서 수행하지 않는다. 평문은 정상 인증 수단으로 지원하지 않는다. 활성 관리자가 있으면 직원 관리의 명시적 비밀번호 재설정을 사용한다.
- 활성 관리자가 전혀 없으면 운영 책임자가 백업·대상 ID·권한 부여 사유를 확인한 별도 유지보수 작업이 필요하다. 현재 자동 복구 CLI는 제공하지 않는다. 승인된 대상만 BCrypt 비밀번호·활성 상태·권한·세션 버전을 함께 조정하고, 다음 로그인 변경 강제·기존 세션 폐기·감사 기록을 확인한다. 부트스트랩을 위해 기존 직원 행을 삭제해서는 안 된다.
- 최초 관리자 생성 후 부트스트랩 설정을 제거한다. 자격정보를 명령 인자·문서·채팅·공유 로그에 기록하지 않는다.

## 업무 데이터 규칙

- 직원·프로젝트 관계는 ID로 연결한다. 이름은 표시·과거 스냅샷용이다.
- 모든 기존 데이터 수정·삭제는 조회 당시 `version`이 필요하다. 누락 400, 충돌 409이며 입력을 자동 덮어쓰지 않는다. 프로젝트·계약 연동과 영업 전환은 서버 트랜잭션으로 처리한다.
- 프로젝트 금액은 만원, 계약 원가는 천원이다. 합계·지분·공수·VAT는 서버에서 검증·계산한다. 기간 밖 연도의 매출·공수와 미입력 공수는 임의로 채우지 않는다.
- 고정 시스템 코드(권한·직급·부서·상태)와 관리자가 편집하는 기준정보(연도별 단가·매출 목표 등)는 구분한다. 기존 계약의 당시 단가는 스냅샷으로 보존한다.
- 공지사항은 방문자가 게시글만 조회하고 시스템 관리자만 작성·수정·삭제·게시·고정을 관리한다. 비공개 내용과 작성자 계정 정보는 공개 API에 노출하지 않는다.
- 개인정보 처리방침은 운영 담당자·호스팅·로그 보관기간이 미정인 검토용 초안이다. 해당 운영정보와 시행일을 확정하기 전 정식 시행 방침으로 표현하지 않는다.

## 백업·복원

```sh
mkdir -p backups
docker compose exec -T postgres pg_dump -U nexus -Fc groupware_db > backups/groupware.dump
```

복원은 별도 검증 DB에서 수행한다. 예: 별도 PostgreSQL 인스턴스에서 `createdb -U nexus groupware_restore_check` 후 `pg_restore -U nexus -d groupware_restore_check backups/groupware.dump`. 행 수·계정·계약·평가·관계 ID를 대조한다. 기존 DB의 첫 Flyway 도입은 백업·검증 후 baseline 0과 일회성 baseline 허용 여부를 책임자가 확인한다.

`backups/`, `export/csv/`, 전체 SQL 덤프는 로컬 전용이다. 공유 문서·테스트에는 행 데이터와 비밀번호 해시를 넣지 않는다. 추적에서 제외해도 과거 Git 커밋은 남으므로 과거 공유 범위와 대응은 별도로 검토한다.
