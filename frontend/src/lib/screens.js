/**
 * Per-screen identity.
 *
 * Each screen owns a hue so you can tell at a glance which room you are in.
 * That hue is applied to CHROME ONLY - the sidebar's active item, the page
 * header, the hover tint on rows and columns - and never inside a data cell.
 *
 * This is what keeps it from fighting the encodings in domain.js: priority and
 * stage colour live in chips and marks, screen colour lives in the furniture
 * around them. The two never appear in the same place, so a coloured thing is
 * never ambiguous.
 *
 * The hues sit as little as 24 degrees apart in the blue-violet run, which
 * would be too close for a categorical palette read side by side. These are
 * never read side by side: exactly one is visible at a time, and the screen
 * name is always written next to it.
 */

// The two newest hues sit in the largest remaining gap on the wheel
// (Campaigns at 334 degrees round to People at 81), spaced 28 to 45 degrees -
// wider than the 24 degree minimum already in use, so they crowd nothing
// further. Both clear 7:1 against chrome.
// Fourteen screens is a crowded wheel, so the constraint that actually matters
// is separation between screens sitting NEXT TO EACH OTHER in the sidebar -
// those are the only ones seen at the same time. Every nav-adjacent pair
// clears 49 degrees, with one deliberate exception:
//
//   Orders / Returns are 20 degrees apart ON PURPOSE. They are the same table
//   inverted, and Returns is a deeper step of the Orders green, so the colour
//   says "sibling" rather than "unrelated thing".
//
// Insights was moved to magenta because it shares a sidebar group with
// Statistics: at amber and yellow the two were 16 degrees apart and would have
// been read side by side, the one case where "only one is visible at a time"
// does not hold. Logistics inherits the violet that Deals vacated.
const SCREENS = {
  '/': { key: 'overview', label: 'Overview', accent: '#3d9bff' },
  '/todo': { key: 'todo', label: 'Todo', accent: '#ff6f59' },
  '/leads': { key: 'leads', label: 'Leads', accent: '#17c8d4' },
  '/orders': { key: 'orders', label: 'Orders', accent: '#55d94f' },
  '/returns': { key: 'returns', label: 'Returns', accent: '#2f9e4f' },
  '/logistics': { key: 'logistics', label: 'Logistics', accent: '#9b6dff' },
  '/inventory': { key: 'inventory', label: 'Inventory', accent: '#e8d44a' },
  '/customers': { key: 'customers', label: 'Customers', accent: '#2fd08a' },
  '/organisations': { key: 'organisations', label: 'Organisations', accent: '#7b85ff' },
  '/emails': { key: 'emails', label: 'Emails', accent: '#d96bff' },
  '/campaigns': { key: 'campaigns', label: 'Campaigns', accent: '#ff7eb6' },
  '/insights': { key: 'insights', label: 'Insights', accent: '#e863d9' },
  '/statistics': { key: 'statistics', label: 'Statistics', accent: '#ffb03a' },
  '/users': { key: 'people', label: 'People', accent: '#a8d94a' },
}

const FALLBACK = { key: 'other', label: '', accent: '#8093b0' }

export function screenTheme(pathname) {
  if (pathname === '/') return SCREENS['/']
  const match = Object.keys(SCREENS).find(
    (path) => path !== '/' && pathname.startsWith(path),
  )
  return match ? SCREENS[match] : FALLBACK
}

export const screenAccent = (pathname) => screenTheme(pathname).accent

/** Sidebar links read their own hue, so each destination previews its screen. */
export const accentFor = (path) => (SCREENS[path] ?? FALLBACK).accent
