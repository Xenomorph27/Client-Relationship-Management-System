import { NavLink } from 'react-router-dom'
import { accentFor } from '../../lib/screens.js'
import {
  Building2,
  ChartNoAxesColumn,
  ChevronsLeft,
  ChevronsRight,
  GaugeCircle,
  Boxes,
  ChartPie,
  Package,
  Truck,
  Undo2,
  ListTodo,
  Mail,
  Megaphone,
  UserRound,
  Users,
} from 'lucide-react'

/**
 * Navigation grouped by the job being done, not alphabetically. The grouping
 * is the information: pipeline work is separate from account records, which is
 * separate from outreach. A flat list of eight links would hide that.
 */
const GROUPS = [
  {
    heading: null,
    items: [
      { to: '/', label: 'Overview', icon: GaugeCircle, end: true },
      { to: '/todo', label: 'Todo', icon: ListTodo },
    ],
  },
  {
    heading: 'Sales',
    items: [
      { to: '/leads', label: 'Leads', icon: UserRound },
      { to: '/orders', label: 'Orders', icon: Package },
      { to: '/returns', label: 'Returns', icon: Undo2 },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { to: '/logistics', label: 'Logistics', icon: Truck },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
    ],
  },
  {
    heading: 'Accounts',
    items: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/organisations', label: 'Organisations', icon: Building2 },
    ],
  },
  {
    heading: 'Outreach',
    items: [
      { to: '/emails', label: 'Emails', icon: Mail },
      { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
    ],
  },
  {
    heading: 'Insight',
    items: [
      { to: '/insights', label: 'Insights', icon: ChartPie },
      { to: '/statistics', label: 'Statistics', icon: ChartNoAxesColumn },
    ],
  },
  {
    heading: 'Team',
    items: [{ to: '/users', label: 'People', icon: Users }],
  },
]

export function Sidebar({ collapsed, onToggle }) {
  return (
    <nav
      aria-label="Main"
      className={
        'flex shrink-0 flex-col border-r border-rule bg-chrome transition-[width] duration-150 ' +
        (collapsed ? 'w-[52px]' : 'w-[196px]')
      }
    >
      <div className="flex h-11 items-center gap-2 border-b border-rule px-3">
        {/* The mark carries the current screen's hue, so the brand doubles as
            a constant read-out of where you are. */}
        <span
          aria-hidden="true"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-[4px] text-[11px] font-semibold text-[#04121f] transition-colors duration-200"
          style={{ backgroundColor: 'var(--screen)' }}
        >
          C
        </span>
        {!collapsed && (
          <span className="truncate text-sm font-medium tracking-tight text-ink">
            Client Desk
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {GROUPS.map((group, index) => (
          <div key={group.heading ?? index} className={group.heading ? 'mt-3' : ''}>
            {group.heading && !collapsed && (
              <div className="px-3 pb-1 text-2xs text-ink-3">{group.heading}</div>
            )}
            {group.heading && collapsed && <div className="mx-3 mb-1.5 border-t border-rule" />}
            <ul>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      'group mx-1.5 flex h-7 items-center gap-2 rounded-control px-1.5 ' +
                      'transition-colors ' +
                      (isActive
                        ? 'text-ink'
                        : 'text-ink-2 hover:bg-raised hover:text-ink')
                    }
                    style={({ isActive }) =>
                      isActive
                        ? {
                            // The destination's own hue, at a strength that
                            // marks the row without shouting over the label,
                            // plus a solid bar on the leading edge.
                            backgroundColor:
                              'color-mix(in oklab, ' + accentFor(item.to) + ' 20%, transparent)',
                            boxShadow: 'inset 2px 0 0 0 ' + accentFor(item.to),
                          }
                        : undefined
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          size={15}
                          className="shrink-0 transition-colors"
                          // Each destination previews its own colour on hover,
                          // so the palette teaches itself as you move around.
                          style={isActive ? { color: accentFor(item.to) } : undefined}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-rule p-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="flex h-7 w-full items-center gap-2 rounded-control px-1.5 text-ink-3 hover:bg-raised hover:text-ink"
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </nav>
  )
}
