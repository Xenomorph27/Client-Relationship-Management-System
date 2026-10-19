import { ItemImage } from '../ui/ItemImage.jsx'
import { PriorityChip } from '../ui/Chips.jsx'
import { daysUntil, formatAmount } from '../../lib/format.js'
import { deliveryMeta, returnMeta, sourceMeta } from '../../lib/domain.js'

/**
 * A card on the logistics board.
 *
 * The due date appears only when it is worth acting on - overdue, or inside a
 * fortnight. A date on every card is noise, and noise is what stops a board
 * being scannable.
 */
export function OrderCard({ order, account, selected, onOpen }) {
  const days = daysUntil(order.delivery_due)
  const settled = deliveryMeta(order.delivery_status).done
  const overdue = !settled && days != null && days < 0
  const soon = !settled && days != null && days >= 0 && days <= 14
  const source = sourceMeta(order.source)

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', String(order.id))
        event.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      tabIndex={0}
      className={
        'lift cursor-pointer rounded-control bg-raised px-2.5 py-2 ring-1 ring-inset ' +
        'active:cursor-grabbing ' +
        (selected ? 'ring-accent bg-accent-wash/50' : 'ring-rule hover:ring-rule-strong')
      }
    >
      <div className="flex items-start gap-2">
        <ItemImage file={order.image} name={order.name} size={30} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm leading-snug text-ink">{order.name}</h3>
          <div className="tnum mt-0.5 text-2xs text-ink-3">{order.order_ref}</div>
        </div>
        <span className="tnum shrink-0 text-sm text-ink">{formatAmount(order.price)}</span>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 text-2xs text-ink-3"
          title={'Came from ' + source.label}
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: source.accent }}
          />
          {source.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{account ?? ''}</span>
        {order.kind === 'return' ? (
          <span className={'text-2xs ' + returnMeta(order.return_type).text}>
            {returnMeta(order.return_type).short}
          </span>
        ) : (
          <PriorityChip value={order.priority_lvl} compact />
        )}
      </div>

      {order.stock_status === 'shortfall' && (
        <div className="mt-1.5 text-2xs text-heat-2">Not in stock, needs making</div>
      )}

      {(overdue || soon) && (
        <div className={'mt-1 text-2xs ' + (overdue ? 'text-heat-2' : 'text-heat-3')}>
          {overdue ? Math.abs(days) + ' days overdue' : 'Due in ' + days + ' days'}
        </div>
      )}
    </article>
  )
}
