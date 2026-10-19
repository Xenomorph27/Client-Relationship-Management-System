import { Check } from 'lucide-react'
import { PriorityChip } from '../ui/Chips.jsx'
import { daysUntil, formatDateShort, initialsOf } from '../../lib/format.js'

/** Due date wording, coloured only when it is actually worth acting on. */
function Due({ value, done }) {
  if (!value) return <span className="text-ink-3">No date</span>
  const days = daysUntil(value)
  if (done) return <span className="text-ink-3">{formatDateShort(value)}</span>
  if (days < 0) return <span className="text-heat-2">{Math.abs(days)}d overdue</span>
  if (days === 0) return <span className="text-heat-3">Today</span>
  if (days === 1) return <span className="text-heat-3">Tomorrow</span>
  return <span className="text-ink-3">{formatDateShort(value)}</span>
}

/**
 * A task as a line, not a table row: a checkbox, what it is, and what it is
 * about. Ticking it is optimistic - the strike-through lands immediately
 * rather than waiting on the request, because a checkbox has to feel instant.
 */
export function TaskRow({ task, related, assignee, onToggle, onOpen }) {
  return (
    <li className="hover-screen flex items-center gap-3 border-b border-rule/60 px-4 py-2 transition-colors">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.is_done}
        aria-label={task.is_done ? 'Mark not done: ' + task.title : 'Mark done: ' + task.title}
        onClick={(event) => {
          event.stopPropagation()
          onToggle(task)
        }}
        className={
          'grid h-4 w-4 shrink-0 place-items-center rounded-[4px] ring-1 ring-inset transition-colors ' +
          (task.is_done
            ? 'bg-won text-[#04120b] ring-won'
            : 'ring-rule-strong hover:ring-ink-3')
        }
      >
        {task.is_done && <Check size={11} strokeWidth={3} />}
      </button>

      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 text-left"
      >
        <span
          className={
            'block truncate ' +
            (task.is_done ? 'text-ink-3 line-through decoration-ink-3/60' : 'text-ink')
          }
        >
          {task.title}
        </span>
        {related && (
          <span className="block truncate text-xs text-ink-3">
            {related.label}
            <span className="text-ink-3/60"> · {related.kind}</span>
          </span>
        )}
      </button>

      <span className="w-20 shrink-0 text-right text-xs">
        <Due value={task.due_date} done={task.is_done} />
      </span>

      <PriorityChip value={task.priority_lvl} compact />

      <span
        aria-hidden="true"
        title={assignee?.full_name ?? 'Unassigned'}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-raised-2 text-2xs text-ink-2"
      >
        {assignee ? initialsOf(assignee.full_name) : '—'}
      </span>
    </li>
  )
}
