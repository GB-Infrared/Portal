import { ignoreErrors } from './ignoreErrors';

const KEY = 'enerops-theme';

export const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

export function toggleTheme(): boolean {
  const dark = !isDark();
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  ignoreErrors(() => localStorage.setItem(KEY, dark ? 'dark' : 'light'));
  return dark;
}
