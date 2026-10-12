/* LIGHT IS THE DEFAULT, DARK IS THE CHOICE.

   The default lives on the tag, not in a script: <html> carries no data-theme,
   and no data-theme is light. index.html's head script only PUTS dark on, for
   somebody who chose it, before the first paint - so storage can fail outright
   and the page still opens in the default. This module is the switch. */

const KEY = 'enerops-theme';

export const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

export function toggleTheme(): boolean {
  const dark = !isDark();
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch { /* the choice lasts the tab */ }
  return dark;
}
