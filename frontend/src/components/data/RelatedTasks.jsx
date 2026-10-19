import { Check } from 'lucide-react'
import { listTasks, setTaskDone } from '../../api/tasks.js'
import { useAsync } from '../../hooks/useAsync.js'
import { DetailSection } from '../ui/Drawer.jsx'
import { PriorityChip } from '../ui/Chips.jsx'
import { daysUntil, formatDateShort } from '../../lib/format.js'

const FIELD = {
  lead: 'lead_id',
  order: 'order_id',
  customer: 'customer_id',
  organisation: 'organisation_id',
}

/**
 * The tasks attached to one record, shown inside its detail drawer.
 *
 * This is the point of linking tasks to records at all: looking at a lead
 * should tell you what you owe them without going to another screen. Ticking
 * one here works exactly as it does on the Todo page.
 */
export function RelatedTasks({ kind, id }) {
  const key = FIELD[kind]
  const tasks = useAsync(() => listTasks({ limit: 500 }), [id, kind])

  const mine = (tasks.data ?? [])
    .filter((task) => task[key] === id)
    .sort((a, b) => Number(a.is_done) - Number(b.is_done))

  const open = mine.filter((task) => !task.is_done)

  async function toggle(task) {
    await setTaskDone(task.id, !task.is_done)
    tasks.reload()
  }

  return (
    <DetailSection title={'Tasks (' + open.length + ' open)'}>
      {tasks.loading ? (
        <p className="px-4 pb-3 text-ink-3">Loading tasks...</p>
      ) : mine.length === 0 ? (
        <p className="px-4 pb-3 text-ink-3">Nothing outstanding on this record.</p>
      ) : (
        <ul className="divide-y divide-rule/70 border-t border-rule/70">
          {mine.map((task) => {
            const days = daysUntil(task.due_date)
            const overdue = !task.is_done && days != null && days < 0
            return (
              <li key={task.id} className="flex items-center gap-2.5 px-4 py-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={task.is_done}
                  aria-label={(task.is_done ? 'Mark not done: ' : 'Mark done: ') + task.title}
                  onClick={() => toggle(task)}
                  className={
                    'grid h-4 w-4 shrink-0 place-items-center rounded-[4px] ring-1 ring-inset ' +
                    (task.is_done
                      ? 'bg-won text-[#04120b] ring-won'
                      : 'ring-rule-strong hover:ring-ink-3')
                  }
                >
                  {task.is_done && <Check size={11} strokeWidth={3} />}
                </button>
                <span
                  className={
                    'min-w-0 flex-1 truncate ' +
                    (task.is_done ? 'text-ink-3 line-through decoration-ink-3/60' : 'text-ink')
                  }
                >
                  {task.title}
                </span>
                <PriorityChip value={task.priority_lvl} compact />
                <span
                  className={
                    'tnum w-16 shrink-0 text-right text-2xs ' +
                    (overdue ? 'text-heat-2' : 'text-ink-3')
                  }
                >
                  {task.due_date ? formatDateShort(task.due_date) : '—'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </DetailSection>
  )
}
