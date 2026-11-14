/**
 * 하루의 일정 목록을 카테고리 순서와 개별 레코드 순서를 보존한 채 그룹화한다.
 */
export function groupCalendarEvents<T extends { category: string }>(events: T[]) {
  const groups = new Map<T['category'], T[]>();

  for (const event of events) {
    const entries = groups.get(event.category) || [];
    entries.push(event);
    groups.set(event.category, entries);
  }

  return [...groups].map(([category, categoryEvents]) => ({
    category,
    events: categoryEvents,
  }));
}

/**
 * 계약 기간(start ~ end)과 프로젝트 개월차별 M/M 배열(values)을 지정된 연도(year)의 1~12월 배열로 매핑한다.
 */
export function monthlyAllocations(
  start: string,
  end: string,
  values: number[],
  year: number,
): number[] {
  const datePattern = /^(\d{4})-(\d{2})-\d{2}$/;
  const startMatch = datePattern.exec(start);
  const endMatch = datePattern.exec(end);
  const result = Array<number>(12).fill(0);

  if (!startMatch || !endMatch) {
    return result;
  }

  const firstMonthIndex = Number(startMatch[1]) * 12 + Number(startMatch[2]) - 1;
  const lastMonthIndex = Number(endMatch[1]) * 12 + Number(endMatch[2]) - 1;

  for (let month = 0; month < 12; month++) {
    const absoluteMonth = year * 12 + month;
    const planIndex = absoluteMonth - firstMonthIndex;

    if (planIndex >= 0 && absoluteMonth <= lastMonthIndex) {
      result[month] = Number(values[planIndex] ?? 0);
    }
  }

  return result;
}

/**
 * 주간/월간 보고용 기간 목록을 생성한다.
 * 서버·브라우저 간 타임존 오차를 막기 위해 한국 표준시(Asia/Seoul) 날짜와 UTC 날짜 연산을 사용한다.
 */
export function reportPeriods(kind: 'weekly' | 'monthly', now = new Date()) {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const getPart = (type: string) =>
    Number(dateParts.find((part) => part.type === type)?.value);

  const today = new Date(
    Date.UTC(getPart('year'), getPart('month') - 1, getPart('day')),
  );
  const pad2 = (value: number) => String(value).padStart(2, '0');
  const count = kind === 'weekly' ? 53 : 24;

  return Array.from({ length: count }, (_, offset) => {
    const start = new Date(today);

    if (kind === 'monthly') {
      start.setUTCDate(1);
      start.setUTCMonth(start.getUTCMonth() - offset);

      const year = start.getUTCFullYear();
      const month = start.getUTCMonth() + 1;
      return {
        key: `${year}-${pad2(month)}-M`,
        label: `${year}년 ${month}월 월간보고`,
      };
    }

    // 해당 주의 월요일을 기준 시작일로 맞추고 offset주 만큼 이전으로 이동
    const daysFromMonday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - daysFromMonday - offset * 7);

    // 금요일(평일 종료일) 계산
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 4);

    const year = start.getUTCFullYear();
    const month = start.getUTCMonth() + 1;
    const weekOfMonth = Math.floor((start.getUTCDate() - 1) / 7) + 1;
    const startText = `${pad2(month)}.${pad2(start.getUTCDate())}`;
    const endText = `${pad2(end.getUTCMonth() + 1)}.${pad2(end.getUTCDate())}`;

    return {
      key: `${year}-${pad2(month)}-W${weekOfMonth}`,
      label: `${year}년 ${month}월 ${weekOfMonth}주차 (${startText} ~ ${endText})`,
    };
  });
}
