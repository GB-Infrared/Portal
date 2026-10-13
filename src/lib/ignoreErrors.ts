export function ignoreErrors(fn: () => void): void {
  try {
    fn();
  } catch {
    return;
  }
}
