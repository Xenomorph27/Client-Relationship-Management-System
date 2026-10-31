import { ExternalLink } from 'lucide-react'
import { getWebOrder } from '../../api/webOrders.js'
import { useAsync } from '../../hooks/useAsync.js'
import { formatAmountExact, formatDate } from '../../lib/format.js'
import { DetailList, DetailRow, DetailSection } from '../ui/Drawer.jsx'

/**
 * "Shop order" section for a piece that came from the online shop: where to
 * send it, how it was paid, and the other pieces in the same parcel.
 *
 * Renders nothing for orders entered in the CRM, which have no shop order.
 */
export function ShopOrderDetails({ webOrderId }) {
  const { data, error, loading } = useAsync(() => getWebOrder(webOrderId), [webOrderId])
  if (webOrderId == null) return null

  const action = data?.shop_admin_url ? (
    <a
      href={data.shop_admin_url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-2xs text-ink-3 hover:text-ink"
    >
      Open in shop <ExternalLink size={11} />
    </a>
  ) : null

  return (
    <DetailSection title={data ? 'Shop order #' + data.number : 'Shop order'} action={action}>
      {loading && <p className="px-4 pb-3 text-xs text-ink-3">Loading shop order…</p>}
      {error && <p className="px-4 pb-3 text-xs text-heat-2">{error.message}</p>}
      {data && (
        <DetailList>
          <DetailRow label="Deliver to">
            {data.address_lines.length ? (
              <span className="block whitespace-pre-line select-all">{data.address_lines.join('\n')}</span>
            ) : null}
          </DetailRow>
          <DetailRow label="Delivery">{data.shipping_method}</DetailRow>
          <DetailRow label="Contact">
            {[data.email, data.phone].filter(Boolean).join(' · ') || null}
          </DetailRow>
          <DetailRow label="Payment">
            {data.payment_method}
            {data.paid_at ? <span className="ml-2 text-ink-3">paid {formatDate(data.paid_at)}</span> : null}
          </DetailRow>
          <DetailRow label="Shop status">
            <span className="capitalize">{data.status.replace('-', ' ')}</span>
          </DetailRow>
          <DetailRow label="Order total" mono>
            {formatAmountExact(data.total)}
            {Number(data.shipping_total) > 0 && (
              <span className="ml-2 text-ink-3">incl. {formatAmountExact(data.shipping_total)} delivery</span>
            )}
          </DetailRow>
          {data.customer_note && <DetailRow label="Customer note">{data.customer_note}</DetailRow>}
          {data.pieces.length > 1 && (
            <DetailRow label="In this parcel">
              <ul className="space-y-0.5">
                {data.pieces.map((piece) => (
                  <li key={piece.id} className="flex justify-between gap-3 text-xs">
                    <span className="truncate">
                      <span className="tnum text-ink-3">{piece.order_ref}</span> {piece.name}
                    </span>
                    <span className="tnum shrink-0">{formatAmountExact(piece.price)}</span>
                  </li>
                ))}
              </ul>
            </DetailRow>
          )}
        </DetailList>
      )}
    </DetailSection>
  )
}
