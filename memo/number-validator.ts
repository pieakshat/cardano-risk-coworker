const numberPattern = /\b\d[\d,]*(?:\.\d+)?\b/g;

export function numbersIn(value: string): string[] {
  return value.match(numberPattern) ?? [];
}

export function numbersAreGrounded(prose: string, report: unknown): boolean {
  const allowed = new Set(numbersIn(JSON.stringify(report)));
  return numbersIn(prose).every((number) => allowed.has(number));
}
