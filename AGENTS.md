# AI 에이전트 지침서 (AGENTS.md)

이 파일은 본 저장소에서 작업을 수행하는 모든 AI 코딩 에이전트(Cursor, Claude Code, Gemini Antigravity, GitHub Copilot, OpenAI Codex 등)가 반드시 준수해야 하는 최우선 엔지니어링 규칙입니다.

---

## 1. 프로젝트 개요 및 아키텍처

- **프로젝트명**: (주)스패셜티(SPATIAL T) 통합 그룹웨어
- **프론트엔드**: React 19 (Vite), TypeScript, Tailwind CSS v4, Lucide React
- **백엔드**: Spring Boot 3.4.5, Java 21/25, Spring Security, Spring Data JPA
- **데이터베이스**: PostgreSQL 16 (포트 5433, DB명 `groupware_db`)
- **저장소**: `https://github.com/PtOlemy77/groupware.git` (`main` 브랜치)

---

## 2. 하네스 엔지니어링 4대 절대 규칙 (Invariants)

1. **초기화 데이터 임의 덮어쓰기 금지 (Data Preservation)**:
   - `DataInitializer.java`는 DB에 기존 행이 1개라도 존재하는 경우 절대 비밀번호, 권한, 직원 정보 등을 임의로 갱신하거나 덮어써서는 안 됩니다.
2. **구분값 코드 기반 관리 (Code-based Discrimination)**:
   - 권한(`RoleCode`: `ROLE_ADMIN`, `ROLE_EXEC`, `ROLE_PM`, `ROLE_STAFF`), 직급(`PositionCode`), 부서(`DepartmentCode`), 상태(`CommonCode`)를 한글 문자열로 하드코딩 비교하지 말고 정의된 코드 상수로만 판정해야 합니다.
3. **네이티브 알림 금지 및 전역 모달 사용 (No window.alert / window.confirm)**:
   - 모든 사용자 알림 및 확인창은 `@/contexts/ModalContext`의 `useModal()` (`showAlert`, `showConfirm`)을 사용해야 합니다.
4. **엄격한 PK/FK 관계 유지**:
   - 직원명이나 부서명 문자열로 조인하지 않고, `id` (PK) 및 `_id` (FK)를 기준으로 데이터를 관계 맺어야 합니다.

---

## 3. 작업 전/후 하네스 검증 명령 (Verification Gates)

코드를 수정한 후 다음 검증 게이트를 반드시 통과해야 합니다:

```bash
# 1. 프론트엔드 타입 안전성 검증 (0 errors 필수)
npx tsc --noEmit

# 2. 백엔드 컴파일 및 빌드 검증 (BUILD SUCCESS 필수)
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-25.jdk/Contents/Home ./backend/mvnw -f backend/pom.xml compile -DskipTests

# 3. 백엔드 패키징 (JAR 재생성 시)
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-25.jdk/Contents/Home ./backend/mvnw -f backend/pom.xml package -DskipTests

# 4. 프론트엔드 빌드 검증
npm run build
```

---

## 4. 다중 AI 협업 워크플로우

1. **기능 명세(Spec)**: 사용자의 요청을 분석하고, 수정 대상 파일과 영향 범위를 명시합니다.
2. **설계(Design)**: DB 컬럼, TypeScript 인터페이스 변경 사항을 사전 점검합니다.
3. **구현(Implement)**: 요청된 범위 외의 다른 파일(인접 컴포넌트)을 임의로 건드리지 않습니다.
4. **테스트(Test)**: 위의 하네스 검증 명령을 직접 실행하여 이상이 없음을 확인한 후 커밋 및 푸시합니다.
