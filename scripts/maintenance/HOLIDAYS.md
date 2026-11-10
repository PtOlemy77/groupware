# 대한민국 휴일 2024~2040

2026-11-09에 확인했다. 음력은 중국 음력이 아닌 한국천문연구원 평달 변환값을 사용한다.

- [한국천문연구원 음양력 변환](https://astro.kasi.re.kr/life/pageView/8): `/life/lunc/between?start_yyyy=2024&end_yyyy=2040&mm=01&dd=01&isLeap=false`, 같은 방식의 `04/08`, `08/15`. 날짜만 추린 원본은 [음력 기준 자료](../../src/data/korean-lunar-holidays.json)에 보관했다.
- [관공서의 공휴일에 관한 규정 개정문](https://www.law.go.kr/lsInfoP.do?lsiSeq=285779&viewCls=lsRvsDocInfoR): 2026년 노동절·제헌절 및 대체공휴일 반영.
- [우주항공청 2027년 월력요항](https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431): 2027년 일요일 제외 공휴일 24일, 설날 2월 7일 및 노동절·제헌절 대체휴일 대조.
- [KASI 달력자료](https://astro.kasi.re.kr/life/post/calendarData): 2028년 명절과 공휴일 중복에 따른 대체휴일 대조. 2025년 어린이날/부처님오신날 중복은 5월 6일 하루, 2028년 추석/개천절 중복은 10월 5일 하루의 대체휴일이다.
- [공직선거법 제34조](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1013464623): 임기만료 선거 예상일 계산. 2028년 이후 선거는 임기가 이어진다는 가정으로 계산하며 ‘예정’으로 표시한다. 공휴일과 전후일이 겹치면 다음 주 수요일로 이동한다.
- [2025년 1월 27일 임시공휴일 공고](https://www.mpm.go.kr/mpm/comm/noti/mpmNotice/?boardId=bbs_0000000000000205&cntId=904&mode=view): 기존 누락 보완. 2024년 국군의 날 및 2025년 대통령선거 임시공휴일도 포함한다.

2028~2040년은 현행법 기준 예상이며 앞으로 지정될 임시공휴일, 법령 개정, 선거 일정 변경을 모두 확정할 수는 없다. 토·일요일은 달력의 기존 주말 표시로 처리한다. 회사 휴일은 국가 공휴일과 구분하고 기존 등록 내용을 보존한다.

`node scripts/generate-holidays.mjs`로 프론트 공통 자료와 별도 유지보수 SQL을 재생성한다. 앱 기동/Flyway/DataInitializer에서는 이 SQL을 실행하지 않는다.

DB 적용은 대상 DB를 확인하고 `holidays` 테이블을 `pg_dump -Fc -t public.holidays`로 백업한 다음 [등록 SQL](holidays-through-2040.sql)을 `psql -X -v ON_ERROR_STOP=1 --single-transaction`으로 실행한다. 기존 PK·사용자 등록 휴일을 보존하고 알려진 V5 기본 데이터 오류만 조건부 수정한다. 동일 날짜/이름은 중복 삽입하지 않는다. 직원 등 다른 테이블은 변경하지 않는다.

이번 로컬 개발 DB 적용 전 백업은 Git에서 제외한 `backups/holidays-before-2040-20261109.dump`에 보관했다. 2028년 부처님오신날을 6월 2일에서 5월 2일로 정정하고 2026년 이후 기존 근로자의 날 기본 행을 노동절로 반영했다. 회사 지정 휴일은 삭제하지 않았다.

검증은 [휴일 테스트](../../tests/holidays.test.mjs)의 재생성 일치·음력 날짜·대체휴일·기존 데이터 및 재실행 보존과, 전체 브라우저 게이트의 2027/2028/2040년 달력·목록·필터 표시로 수행한다.

2026-11-09 검증 결과: 하네스 정적 검사, TypeScript, Node/SQL 48건, Java 31건, 프로덕션 빌드가 통과했다. `verify:full`의 최초 브라우저 단계는 Chromium 미설치로, 설치된 Chrome을 지정한 재시도는 로그인 연결 오류로 실패했다. Playwright 전용 Chromium 설치 후 `npm run test:e2e`를 재실행하여 전체 브라우저 검증이 통과했다. 최종 모바일 휴일명 보완 후 타입·하네스·휴일 테스트와 `test:e2e`를 다시 실행해 통과했다. 390px 달력의 2040년 추석 이름·붉은 날짜·가로 넘침·필터·목록 표시를 확인했다. DB 등록 대상 363건의 누락은 0건이며 기존 회사 휴일 등을 포함한 저장 행은 총 374건이다. 운영 배포는 수행하지 않았다.
