export function monthlyAllocations(
  start: string,
  end: string,
  values: number[],
  year: number,
): number[] {
  const match = (s: string) => /^(\d{4})-(\d{2})-\d{2}$/.exec(s);
  const a = match(start),
    b = match(end),
    result = Array<number>(12).fill(0);
  if (!a || !b) return result;
  const first = Number(a[1]) * 12 + Number(a[2]) - 1,
    last = Number(b[1]) * 12 + Number(b[2]) - 1;
  for (let month = 0; month < 12; month++) {
    const absolute = year * 12 + month,
      index = absolute - first;
    if (index >= 0 && absolute <= last)
      result[month] = Number(values[index] ?? 0);
  }
  return result;
}
