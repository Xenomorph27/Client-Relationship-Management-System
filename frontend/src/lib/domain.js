/**
 * Domain vocabulary and its visual encoding, defined once.
 *
 * Two separate colour systems, kept strictly apart so a coloured cell is never
 * ambiguous:
 *
 *   priority_lvl  an ORDINAL scale, so it reads as one heat ramp - loud solid
 *                 fill at the top, receding to a bare outline at the bottom.
 *                 Never five unrelated hues, which would imply five unrelated
 *                 categories.
 *   stage         a PIPELINE position, so it runs cool to warm as a deal
 *                 progresses, with the two closed outcomes visually final.
 *
 * Blue is reserved for interaction and appears in neither ramp, so anything
 * blue in the UI means "you can act on this".
 *
 * Each entry pairs colour with a word. Colour alone would fail anyone who
 * cannot distinguish these hues.
 */

/** Matches Priority_Level in backend/app/models/enums.py, highest first. */
export const PRIORITIES = [
  'overrider',
  'high_priority',
  'medium_priority',
  'low_priority',
  'expendable',
]

const PRIORITY_META = {
  overrider: {
    label: 'Overrider',
    short: 'OVR',
    // The only solid fill in the ramp. Reserved for the top of the scale so it
    // stays rare enough to mean something.
    //
    // heat-1-ink is near-black: white on this crimson measured only 3.65:1.
    chip: 'bg-heat-1 text-heat-1-ink font-semibold',
    dot: 'bg-heat-1',
    text: 'text-heat-1',
    rank: 5,
  },
  high_priority: {
    label: 'High',
    short: 'HIGH',
    chip: 'bg-heat-2/15 text-heat-2 ring-1 ring-inset ring-heat-2/30',
    dot: 'bg-heat-2',
    text: 'text-heat-2',
    rank: 4,
  },
  medium_priority: {
    label: 'Medium',
    short: 'MED',
    chip: 'bg-heat-3/12 text-heat-3 ring-1 ring-inset ring-heat-3/25',
    dot: 'bg-heat-3',
    text: 'text-heat-3',
    rank: 3,
  },
  low_priority: {
    label: 'Low',
    short: 'LOW',
    chip: 'bg-heat-4/10 text-heat-4 ring-1 ring-inset ring-heat-4/20',
    dot: 'bg-heat-4',
    text: 'text-heat-4',
    rank: 2,
  },
  expendable: {
    label: 'Expendable',
    short: 'EXP',
    // No fill at all: the bottom of the scale should recede.
    chip: 'text-ink-3 ring-1 ring-inset ring-rule-strong',
    dot: 'bg-heat-5',
    text: 'text-ink-3',
    rank: 1,
  },
}

export const priorityMeta = (value) =>
  PRIORITY_META[value] ?? {
    label: value ? String(value) : 'Unset',
    short: '—',
    chip: 'text-ink-3 ring-1 ring-inset ring-rule',
    dot: 'bg-rule-strong',
    text: 'text-ink-3',
    rank: 0,
  }



/** Lead statuses seen in the data. Free text on the backend, same as stage. */
export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'unqualified',
]

const LEAD_STATUS_META = {
  new: { label: 'New', text: 'text-accent' },
  contacted: { label: 'Contacted', text: 'text-ink' },
  qualified: { label: 'Qualified', text: 'text-won' },
  proposal_sent: { label: 'Proposal sent', text: 'text-heat-3' },
  unqualified: { label: 'Unqualified', text: 'text-ink-3 line-through decoration-ink-3/50' },
}

export const leadStatusMeta = (value) =>
  LEAD_STATUS_META[value] ?? { label: value ? String(value) : 'Unset', text: 'text-ink-2' }

/** Campaign state is derived from its dates, not stored. */
export function campaignState(campaign) {
  const now = Date.now()
  const start = campaign.start_date ? new Date(campaign.start_date).getTime() : null
  const end = campaign.end_date ? new Date(campaign.end_date).getTime() : null
  if (start && now < start) return { key: 'upcoming', label: 'Upcoming', text: 'text-accent' }
  if (end && now > end) return { key: 'ended', label: 'Ended', text: 'text-ink-3' }
  return { key: 'running', label: 'Running', text: 'text-won' }
}

/* ===========================================================================
   Woodcraft vocabulary.

   Replaces the sales-pipeline language above. A workshop does not negotiate a
   deal through stages; it takes an order and fulfils it.
   =========================================================================== */

/**
 * Fulfilment, in the order it actually happens: the piece is made, it leaves
 * the workshop, it is on the road, it arrives. A board people drag left to
 * right has to follow real time order or the gesture lies.
 *
 * Sequential ramp in one hue, like the old stage ramp: position is ordinal, so
 * it is read by lightness, not by hue identity. Verified monotonic, every step
 * at least 3:1 on the panel.
 */
export const DELIVERY_STATUSES = ['processing', 'dispatched', 'in_transit', 'delivered']

const DELIVERY_META = {
  processing: { label: 'Processing', accent: '#6c4fd6', done: false },
  dispatched: { label: 'Dispatched', accent: '#8b63f0', done: false },
  in_transit: { label: 'In transit', accent: '#a97bff', done: false },
  delivered: { label: 'Delivered', accent: '#00e093', done: true },
}

export const deliveryMeta = (value) =>
  DELIVERY_META[value] ?? { label: value ? String(value) : 'Unknown', accent: '#77879f', done: false }

/** An order is either going out or coming back. Both live in one table. */
export const ORDER_KINDS = ['delivery', 'return']

const KIND_META = {
  delivery: { label: 'Delivery', plural: 'Deliveries' },
  return: { label: 'Return', plural: 'Returns' },
}
export const kindMeta = (value) => KIND_META[value] ?? KIND_META.delivery

/**
 * What the customer wants done. The stock consequence differs for each, which
 * is the whole reason this is an enum and not a free-text note:
 * a refund puts the piece back on the shelf, a modification does not.
 */
export const RETURN_TYPES = ['refund', 'exchange', 'exchange_modified']

const RETURN_META = {
  refund: { label: 'Refund', short: 'Refund', restocks: true, text: 'text-heat-2' },
  exchange: { label: 'Exchange', short: 'Exchange', restocks: true, text: 'text-heat-3' },
  exchange_modified: {
    label: 'Exchange with modification',
    short: 'Modify',
    // Goes to the workshop, not back to the shelf.
    restocks: false,
    text: 'text-accent',
  },
}
export const returnMeta = (value) =>
  RETURN_META[value] ?? { label: value ? String(value) : 'Unset', short: '—', restocks: false, text: 'text-ink-3' }

/** Where an order came from. Carried across the whole funnel. */
export const SOURCES = ['website', 'instagram', 'facebook', 'direct']

const SOURCE_META = {
  website: { label: 'Website', accent: '#5b8ff9' },
  instagram: { label: 'Instagram', accent: '#e8684a' },
  facebook: { label: 'Facebook', accent: '#6dc8ec' },
  direct: { label: 'Direct', accent: '#5ad8a6' },
}
export const sourceMeta = (value) =>
  SOURCE_META[value] ?? { label: value ? String(value) : 'Unknown', accent: '#6b7a91' }

/** Whether an order could be met from stock when it was placed. */
export const stockMeta = (value) =>
  value === 'shortfall'
    ? { label: 'Not in stock', short: 'Make', text: 'text-heat-2', chip: 'bg-heat-1/15 text-heat-2 ring-1 ring-inset ring-heat-1/30' }
    : { label: 'From stock', short: 'Stock', text: 'text-ink-3', chip: 'text-ink-3 ring-1 ring-inset ring-rule-strong' }

/* --- Inventory ----------------------------------------------------------- */

export const ITEM_CLASSES = ['product', 'material']

const CLASS_META = {
  product: { label: 'Finished piece', plural: 'Finished pieces' },
  material: { label: 'Raw material', plural: 'Raw materials' },
}
export const itemClassMeta = (value) => CLASS_META[value] ?? CLASS_META.product

export const PRODUCT_CATEGORIES = ['furniture', 'decor', 'custom']
export const MATERIAL_CATEGORIES = ['timber', 'hardware', 'finish']

export const categoryLabel = (value) =>
  !value ? '—' : String(value).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** Units differ by class, which is why both classes share one table. */
export const UNITS = ['piece', 'board_ft', 'litre', 'pack']

const UNIT_META = {
  piece: { label: 'pcs', long: 'Pieces' },
  board_ft: { label: 'bd ft', long: 'Board feet' },
  litre: { label: 'L', long: 'Litres' },
  pack: { label: 'pack', long: 'Packs' },
}
export const unitMeta = (value) => UNIT_META[value] ?? { label: '', long: '' }

export const isLowStock = (item) =>
  item != null && Number(item.quantity) <= Number(item.reorder_level)
