# (주)스패셜티(SPATIAL T) 그룹웨어 디자인 시스템 가이드 (design.md)

- **문서 버전**: v1.0.0
- **최종 수정일**: 2026-11-02
- **적용 프레임워크**: React 19, Tailwind CSS v4, Lucide React
- **적용 범위**: 본 그룹웨어의 모든 화면 컴포넌트, 모달, 테이블, 입력 폼 및 네비게이션

---

## 1. 디자인 철학 및 기본 원칙 (Design Principles)

(주)스패셜티 그룹웨어는 **공간정보(GIS) 및 엔지니어링 기업의 고밀도 업무 환경**을 지원하기 위해 다음 4가지 핵심 가치를 준수합니다:

1. **정돈된 시각적 위계 (Visual Hierarchy)**: 
   - 사용자가 한눈에 데이터 현황, 작업 상태, 액션 버튼을 구분할 수 있도록 폰트 크기, 명도, 여백을 규칙화합니다.
2. **반드시 일관된 모달 시스템 (Global Modal Invariant)**:
   - 브라우저 기본 `window.alert()` / `window.confirm()`은 절대 사용하지 않으며, 일관된 UX를 위해 [`ModalContext`](file:///Users/ugwang-il/study/groupware/src/contexts/ModalContext.tsx)의 `showAlert`와 `showConfirm`만을 사용합니다.
3. **가독성 높은 듀얼 톤 레이아웃 (Dual-Tone Contrast)**:
   - 좌측 네비게이션은 안정감 있는 다크 테마(`slate-900`), 메인 작업 영역은 가독성과 눈의 피로를 최소화하는 소프트 라이트 테마(`slate-50`)를 엄격히 유지합니다.
4. **군더더기 없는 모던 UI (Subtle & Clean)**:
   - 과도한 그라디언트나 강한 그림자를 지양하고, 미세한 보더라인(`border-slate-200/80`), 부드러운 라운딩(`rounded-2xl`, `rounded-xl`), 가벼운 그림자(`shadow-xs`, `shadow-sm`)를 기본으로 합니다.

---

## 2. 컬러 팔레트 시스템 (Color Palette)

### 2.1 브랜드 및 주요 컬러 (Primary & Brand)
- **Primary Main**: `indigo-600` (`#4f46e5`) - 핵심 액션 버튼, 활성 탭 인디케이터, 포커스 링
- **Primary Hover**: `indigo-700` (`#4338ca`) - 버튼 마우스 오버 상태
- **Primary Soft Background**: `indigo-50` (`#eef2ff`) - 선택된 행, 액티브 뱃지 배경
- **Primary Border**: `indigo-200` (`#c7d2fe`)

### 2.2 중립 컬러 및 배경 (Neutrals & Layout)
- **메인 캔버스 배경**: `bg-slate-50` (`#f8fafc`)
- **컨텐츠 카드 / 모달 배경**: `bg-white` (`#ffffff`)
- **다크 사이드바 배경**: `bg-slate-900` (`#0f172a`)
- **다크 사이드바 서브/헤더**: `bg-slate-800` (`#1e293b`)
- **기본 텍스트 (Title/Body)**: `text-slate-900` (`#0f172a`), `text-slate-800` (`#1e293b`)
- **보조 텍스트 (Muted/Caption)**: `text-slate-500` (`#64748b`), `text-slate-400` (`#94a3b8`)
- **경계선 (Dividers/Borders)**: `border-slate-200` (`#e2e8f0`), 미세선 `border-slate-100` (`#f1f5f9`)

### 2.3 시맨틱 상태 컬러 (Semantic States)
상태 뱃지 및 알림 배너에는 반드시 의미에 맞는 시맨틱 컬러를 쌍으로 적용합니다:

| 상태 의미 | 적용 예시 (공통코드/상태) | 뱃지 배경 / 텍스트 클래스 | 보더 클래스 |
| :--- | :--- | :--- | :--- |
| **Success (완료/가용/정상)** | 완료, 승인, 가용(장비), 재직 | `bg-emerald-50 text-emerald-700` | `border-emerald-200` |
| **Info / Primary (진행)** | 진행 중, 착수, 사용 중(장비) | `bg-blue-50 text-blue-700` | `border-blue-200` |
| **Warning (검토/주의/보류)** | 검토 중, 보류, 수리 중(장비) | `bg-amber-50 text-amber-700` | `border-amber-200` |
| **Danger (반려/오류/폐기)** | 반려, 오류, 폐기(장비), 퇴직 | `bg-rose-50 text-rose-700` | `border-rose-200` |
| **Neutral (대기/준비)** | 작성 중, 대기, 계획 | `bg-slate-100 text-slate-700` | `border-slate-200` |

---

## 3. 타이포그래피 규칙 (Typography)

- **기본 폰트**: `-apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif`
- **행간 및 자간**: 본문 `leading-relaxed`, 타이틀 `tracking-tight`

### 계층별 권장 클래스
- **페이지 타이틀**: `text-xl md:text-2xl font-bold text-slate-900 tracking-tight`
- **페이지 서브설명**: `text-xs md:text-sm text-slate-500 mt-1`
- **카드 섹션 타이틀**: `text-base md:text-lg font-bold text-slate-800`
- **일반 본문 / 테이블 셀**: `text-sm text-slate-700`
- **부속 캡션 / 메타 정보**: `text-xs font-medium text-slate-500`
- **미세 라벨 / 코드 뱃지**: `text-[11px] font-semibold tracking-wider uppercase`

---

## 4. 공통 UI 컴포넌트 표준 스펙 (Component Specs)

### 4.1 버튼 (Buttons)
버튼은 목적에 따라 명확한 시각적 무게감을 부여합니다:

```tsx
// 1. Primary Action (등록, 저장, 제출, 승인)
<button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold shadow-xs hover:shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
  저장하기
</button>

// 2. Secondary / Cancel (취소, 닫기, 이전)
<button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 text-sm font-medium shadow-2xs transition cursor-pointer">
  취소
</button>

// 3. Danger Action (삭제, 반려, 폐기)
<button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-xs transition cursor-pointer">
  삭제
</button>

// 4. Compact Table Action (행 내 상세/수정)
<button className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer">
  수정
</button>
```

### 4.2 입력 폼 (Form Controls)
- 폼 컨트롤은 통일된 보더, 라운딩, 포커스 링을 가집니다:

```tsx
// Label + Input 세트
<div className="space-y-1.5">
  <label className="block text-xs font-semibold text-slate-700">
    프로젝트명 <span className="text-rose-500">*</span>
  </label>
  <input
    type="text"
    placeholder="프로젝트명을 입력하세요"
    className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
  />
</div>
```

### 4.3 테이블 및 그리드 (Data Tables)
고밀도 정보 표시를 위해 아래 마크업 표준을 유지합니다:
- **헤더 (`thead`)**: `bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-semibold py-3 px-4 text-left uppercase`
- **행 (`tbody tr`)**: `border-b border-slate-100 hover:bg-slate-50/60 transition`
- **셀 (`td`)**: `py-3.5 px-4 text-sm text-slate-700 align-middle`

### 4.4 카드 컨테이너 (Cards)
- `bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6 transition hover:border-slate-300/80`

### 4.5 상태 뱃지 (Status Badges)
```tsx
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
  진행 중
</span>
```

---

## 5. 모달 및 팝업 규약 (Modal Standards)

### 5.1 전역 알림/확인 모달 (`ModalContext`)
- 단순 안내: `await showAlert('정상적으로 저장되었습니다.', '성공')`
- 위험 확인:
```tsx
const confirmed = await showConfirm(
  '선택한 직원을 퇴직 처리하시겠습니까?\n이 작업은 즉시 반영됩니다.',
  '직원 상태 변경 확인'
);
if (!confirmed) return;
```

### 5.2 복합 데이터 입력/상세 팝업 모달 구조
- **백드롭**: `fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150`
- **모달 박스**: `bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden`
- **헤더**: `p-6 border-b border-slate-100 flex items-center justify-between`
- **바디**: `p-6 overflow-y-auto space-y-6 flex-1`
- **푸터**: `p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3`

---

## 6. 아이콘 및 반응형 레이아웃 규칙

1. **아이콘 라이브러리**:
   - `lucide-react` 단일 라이브러리만 사용합니다.
   - 표준 스트로크 굵기: `stroke-[1.8]` (일관된 선 두께).
   - 표준 크기: 인라인 아이콘 `w-4 h-4`, 메뉴 아이콘 `w-5 h-5`, 대시보드 메인 아이콘 `w-6 h-6`.
2. **반응형 브레이크포인트**:
   - `md` (768px): 모바일 드로어 ➔ 고정 데스크탑 사이드바(`w-72`) 전환.
   - `lg` (1024px): 2열 그리드 ➔ 3~4열 통계 카드 그리드 전환.
   - 모바일 환경에서도 가로 스크롤 테이블(`overflow-x-auto`)을 제공하여 데이터 잘림 방지.

---

## 7. AI 에이전트 체크리스트 (Design Sanity Check)

새로운 화면이나 컴포넌트를 추가할 때 아래 항목을 반드시 자가 점검합니다:

- [ ] `window.alert` 또는 `window.confirm` 코드가 1개도 없는가? (`useModal()` 사용 여부)
- [ ] 버튼이나 카드 테두리에 하드코딩된 어색한 색상 대신 본 가이드의 `slate`, `indigo` 팔레트를 사용했는가?
- [ ] 테이블 헤더와 셀 폰트 크기 및 패딩이 통일되어 있는가? (`text-xs font-semibold py-3 px-4`)
- [ ] 모든 입력창에 포커스 링(`focus:ring-2 focus:ring-indigo-500/20`)이 적용되어 있는가?
- [ ] 상태 표시에 하드코딩 한글 비교 대신 시맨틱 뱃지 컬러 규칙을 따랐는가?
