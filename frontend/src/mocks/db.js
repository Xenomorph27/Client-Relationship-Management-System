/**
 * In-memory stand-in for the Postgres database.
 *
 * Every record mirrors backend/app/seed.py, and every field name matches the
 * Pydantic read schemas in backend/app/schemas/. That is deliberate: when the
 * real API is wired in, the screens should look identical, so any difference
 * is a wiring bug rather than a data difference.
 *
 * Users carry no password field, matching schemas/user.py.
 *
 * Rows are written as tuples and expanded by a mapper, which keeps the data
 * readable as a table instead of a wall of repeated keys.
 */

const DAY = 86400000
const now = Date.now()

/** ISO string shaped the way FastAPI serialises a naive datetime. */
const at = (days = 0) => new Date(now + days * DAY).toISOString().replace('Z', '')

const stamps = (days = 0) => ({ created_at: at(days), updated_at: at(days) })

const users = [
  [1, 'sarah.chen', 'sarah.chen@ourcrm.example', 'Sarah Chen', 'high_priority', -120],
  [2, 'marcus.webb', 'marcus.webb@ourcrm.example', 'Marcus Webb', 'medium_priority', -96],
  [3, 'aisha.patel', 'aisha.patel@ourcrm.example', 'Aisha Patel', 'medium_priority', -64],
].map(([id, username, email, full_name, priority_lvl, d]) => ({
  id, username, email, full_name, priority_lvl, ...stamps(d),
}))

const organisations = [
  [1, 'Northwind Logistics', 'northwind.example', 'Logistics', 'high_priority', -110],
  [2, 'Vertex Financial', 'vertexfin.example', 'Financial Services', 'overrider', -98],
  [3, 'Brightline Health', 'brightline.example', 'Healthcare', 'high_priority', -77],
  [4, 'Kestrel Manufacturing', 'kestrel.example', 'Manufacturing', 'medium_priority', -54],
  [5, 'Orion Media', 'orionmedia.example', 'Media', 'low_priority', -31],
].map(([id, name, domain, industry, priority_lvl, d]) => ({
  id,
  name,
  website: 'https://' + domain,
  industry,
  official_email: 'contact@' + domain,
  support_contact: 'support@' + domain,
  priority_lvl,
  ...stamps(d),
}))

const leads = [
  [1, 'Daniel Okafor', 'd.okafor@northwind.example', '555-0110', 'qualified', 1, 'high_priority', -88],
  [2, 'Priya Raman', 'p.raman@northwind.example', '555-0111', 'contacted', 1, 'medium_priority', -71],
  [3, 'Tom Bergstrom', 't.bergstrom@northwind.example', '555-0112', 'new', 1, 'low_priority', -6],
  [4, 'Elena Vasquez', 'e.vasquez@vertexfin.example', '555-0120', 'qualified', 2, 'overrider', -83],
  [5, 'James Whitfield', 'j.whitfield@vertexfin.example', '555-0121', 'proposal_sent', 2, 'high_priority', -62],
  [6, 'Nadia Haddad', 'n.haddad@vertexfin.example', '555-0122', 'contacted', 2, 'medium_priority', -44],
  [7, 'Alan Reyes', 'a.reyes@brightline.example', '555-0130', 'qualified', 3, 'high_priority', -70],
  [8, 'Miriam Osei', 'm.osei@brightline.example', '555-0131', 'new', 3, 'medium_priority', -3],
  [9, 'Victor Lindqvist', 'v.lindqvist@kestrel.example', '555-0140', 'contacted', 4, 'medium_priority', -49],
  [10, 'Hana Suzuki', 'h.suzuki@kestrel.example', '555-0141', 'unqualified', 4, 'expendable', -40],
  [11, 'Grace Mbeki', 'g.mbeki@kestrel.example', '555-0142', 'new', 4, 'low_priority', -9],
  [12, 'Leo Fontaine', 'l.fontaine@orionmedia.example', '555-0150', 'contacted', 5, 'low_priority', -27],
  [13, 'Zara Ahmed', 'z.ahmed@orionmedia.example', '555-0151', 'unqualified', 5, 'expendable', -22],
  [14, 'Ryan Cole', 'r.cole@freelance.example', '555-0160', 'new', null, 'low_priority', -2],
  [15, 'Sofia Marchetti', 's.marchetti@freelance.example', '555-0161', 'contacted', null, 'medium_priority', -15],
].map(([id, name, email, phone, status, organisation_id, priority_lvl, d]) => ({
  id, name, email, phone, status, organisation_id, priority_lvl, ...stamps(d),
}))

const customers = [
  [1, 'Northwind Logistics', 'billing@northwind.example', '555-0210', 'high_priority', -80],
  [2, 'Vertex Financial', 'ap@vertexfin.example', '555-0220', 'overrider', -75],
  [3, 'Brightline Health', 'accounts@brightline.example', '555-0230', 'high_priority', -58],
  [4, 'Copperfield Retail', 'finance@copperfield.example', '555-0240', 'medium_priority', -47],
  [5, 'Saltmarsh Consulting', 'admin@saltmarsh.example', '555-0250', 'medium_priority', -36],
  [6, 'Heron Bay Hotels', 'pay@heronbay.example', '555-0260', 'low_priority', -25],
  [7, 'Tessellate Design', 'hello@tessellate.example', '555-0270', 'low_priority', -18],
  [8, 'Pinehurst Academy', 'bursar@pinehurst.example', '555-0280', 'medium_priority', -11],
].map(([id, name, email, phone, priority_lvl, d]) => ({
  id, name, email, phone, priority_lvl, ...stamps(d),
}))


const SENDER = 'sarah.chen@ourcrm.example'

const emails = [
  [1, 'Intro call follow-up', 'Great speaking today. Sending the deck as promised.', 'd.okafor@northwind.example', 1, null, 'high_priority', true, -30],
  [2, 'Contract sent for signature', 'The agreement is in your inbox for review.', 'd.okafor@northwind.example', 1, null, 'high_priority', true, -24],
  [3, 'Checking in', 'Wanted to see if you had questions about pricing.', 'p.raman@northwind.example', 2, null, 'medium_priority', false, -21],
  [4, 'Welcome to the platform', 'Your account is live. The getting-started guide is attached.', 'billing@northwind.example', null, 1, 'medium_priority', true, -19],
  [5, 'Proposal: enterprise licence', 'Attached is the proposal we discussed.', 'e.vasquez@vertexfin.example', 4, null, 'overrider', true, -17],
  [6, 'Re: security questionnaire', 'Completed questionnaire attached for your team.', 'j.whitfield@vertexfin.example', 5, null, 'high_priority', false, -14],
  [7, 'Compliance module demo', 'Confirming Thursday at 14:00 for the walkthrough.', 'n.haddad@vertexfin.example', 6, null, 'medium_priority', true, -12],
  [8, 'Clinic pilot scope', 'Summary of the pilot scope and success criteria.', 'a.reyes@brightline.example', 7, null, 'high_priority', true, -10],
  [9, 'Quarterly review invite', 'Would you like to book the Q4 review?', 'accounts@brightline.example', null, 3, 'medium_priority', false, -8],
  [10, 'Integration requirements', 'Here is the technical checklist for your plant systems.', 'v.lindqvist@kestrel.example', 9, null, 'medium_priority', true, -7],
  [11, 'Training options', 'Three training tiers are outlined below.', 'g.mbeki@kestrel.example', 11, null, 'low_priority', false, -5],
  [12, 'Thanks for your time', 'Understood on timing. Happy to revisit next year.', 'l.fontaine@orionmedia.example', 12, null, 'low_priority', true, -4],
  [13, 'Renewal confirmed', 'Your renewal is processed. The invoice is attached.', 'finance@copperfield.example', null, 4, 'medium_priority', true, -3],
  [14, 'Onboarding schedule', 'Proposed onboarding timeline for your team.', 'admin@saltmarsh.example', null, 5, 'medium_priority', false, -2],
  [15, 'Pilot results', 'Summary of pilot metrics after week two.', 'pay@heronbay.example', null, 6, 'low_priority', false, -1],
  [16, 'Invoice reminder', 'A reminder that invoice 1042 is due Friday.', 'bursar@pinehurst.example', null, 8, 'medium_priority', false, -0.4],
].map(([id, subject, body, recipient, lead_id, customer_id, priority_lvl, is_opened, d]) => ({
  id, subject, body, recipient, lead_id, customer_id, priority_lvl, is_opened,
  sender: SENDER,
  sendgrid_email_id: null,
  sent_at: at(d),
}))

const campaigns = [
  [1, 'Q4 Enterprise Push', 'Outbound sequence targeting enterprise logistics accounts.', -20, 70, 'high_priority'],
  [2, 'Healthcare Webinar Series', 'Three-part webinar for clinical operations leads.', -5, 45, 'high_priority'],
  [3, 'Manufacturing Newsletter', 'Monthly newsletter for the manufacturing segment.', -60, 120, 'medium_priority'],
  [4, 'Spring Product Launch', 'Launch announcement for the new reporting module.', 30, 60, 'medium_priority'],
  [5, 'Dormant Account Winback', 'Re-engagement emails for accounts inactive six months or more.', -90, 30, 'low_priority'],
].map(([id, name, description, start, duration, priority_lvl]) => ({
  id,
  name,
  description,
  html_content: '<h1>' + name + '</h1><p>' + description + '</p>',
  start_date: at(start),
  end_date: at(start + duration),
  priority_lvl,
}))

/** Mutable session state. Edits persist until the page is reloaded. */
export const tables = {
  users,
  organisations,
  leads,
  customers,
  emails,
  campaigns,
}

export function nextId(collection) {
  return tables[collection].reduce((max, r) => Math.max(max, r.id), 0) + 1
}

/** Server-assigned fields a client never sends, filled in on create. */
export function serverFieldsFor(collection) {
  if (collection === 'emails') {
    return { sent_at: at(0), is_opened: false, sendgrid_email_id: null }
  }
  if (collection === 'campaigns') return {}
  return stamps(0)
}


/**
 * Tasks. A task attaches to at most one record through an explicit nullable
 * foreign key, the same way an email carries lead_id and customer_id, and is
 * always assigned to somebody.
 */
const tasks = [
  ['Call about fleet rollout renewal', -3, false, 'high_priority', 1, 'lead', 1],
  ['Chase signed contract', -1, false, 'overrider', 1, 'order', 1],
  ['Send revised pricing to Priya', 0, false, 'medium_priority', 1, 'lead', 2],
  ['Book technical walkthrough', 0, false, 'high_priority', 2, 'order', 4],
  ['Prepare Vertex compliance demo', 1, false, 'overrider', 2, 'order', 4],
  ['Follow up on security questionnaire', 2, false, 'high_priority', 2, 'lead', 5],
  ['Draft clinic pilot success criteria', 3, false, 'high_priority', 1, 'order', 5],
  ['Confirm Brightline deployment scope', 5, false, 'high_priority', 1, 'customer', 3],
  ['Collect plant system requirements', 6, false, 'medium_priority', 3, 'order', 7],
  ['Send training tier comparison', 8, false, 'low_priority', 3, 'lead', 11],
  ['Quarterly review with Copperfield', 11, false, 'medium_priority', 2, 'customer', 4],
  ['Onboarding kickoff call', 13, false, 'medium_priority', 3, 'customer', 5],
  ['Check Heron Bay pilot metrics', 16, false, 'low_priority', 3, 'order', 12],
  ['Renew Pinehurst site licence', 21, false, 'medium_priority', 2, 'customer', 8],
  ['Review Kestrel account health', 27, false, 'low_priority', 3, 'organisation', 4],
  ['Plan Q1 logistics campaign', 34, false, 'medium_priority', 1, 'campaign', 1],
  ['Re-engage Orion Media', 40, false, 'expendable', 3, 'organisation', 5],
  ['Intro call with Tom Bergstrom', null, false, 'low_priority', 1, 'lead', 3],
  ['Update Northwind contact details', null, false, 'expendable', 2, 'organisation', 1],
  ['Send Vertex enterprise proposal', -12, true, 'overrider', 2, 'order', 3],
  ['Log Brightline discovery notes', -7, true, 'medium_priority', 1, 'lead', 7],
  ['Close out Orion opportunity', -5, true, 'low_priority', 3, 'order', 9],
].map(([title, due, is_done, priority_lvl, assignee_id, kind, ref], index) => ({
  id: index + 1,
  title,
  notes: null,
  due_date: due == null ? null : at(due),
  is_done,
  completed_at: is_done ? at(due + 1) : null,
  priority_lvl,
  assignee_id,
  lead_id: kind === 'lead' ? ref : null,
  order_id: kind === 'order' ? ref : null,
  customer_id: kind === 'customer' ? ref : null,
  organisation_id: kind === 'organisation' ? ref : null,
  campaign_id: kind === 'campaign' ? ref : null,
  ...stamps(due == null ? -20 : Math.min(due - 5, -1)),
}))

tables.tasks = tasks

/* ===========================================================================
   Woodcraft data. Deals is retired; orders carry the money now.
   =========================================================================== */

/**
 * Inventory: finished pieces and raw materials in one table, separated by
 * item_class. They share every field except unit, so two tables would be
 * duplication rather than clarity.
 *
 * Quantities are deliberately mixed: some sit on or below reorder_level so the
 * low-stock path is visible without having to engineer it, and two products
 * are at zero so the out-of-stock ordering rule can be demonstrated.
 */
const inventory = [
  // sku, name, class, category, wood, unit, qty, reorder, price, image
  ['WC-OAK-DT6', 'Oak dining table, 6 seat', 'product', 'furniture', 'Oak', 'piece', 3, 2, '1850.00', 'oak-dining-table.jpg'],
  ['WC-WAL-DESK', 'Walnut writing desk', 'product', 'furniture', 'Walnut', 'piece', 2, 2, '1240.00', 'walnut-writing-desk.jpg'],
  ['WC-ASH-CH4', 'Ash dining chair, set of 4', 'product', 'furniture', 'Ash', 'piece', 6, 3, '960.00', 'ash-dining-chairs.jpg'],
  ['WC-OAK-BKC', 'Oak bookcase, tall', 'product', 'furniture', 'Oak', 'piece', 0, 2, '1420.00', 'oak-bookcase.jpg'],
  ['WC-CHE-SBD', 'Cherry sideboard', 'product', 'furniture', 'Cherry', 'piece', 1, 2, '2100.00', 'cherry-sideboard.jpg'],
  ['WC-MAP-BWL', 'Maple serving bowl', 'product', 'decor', 'Maple', 'piece', 14, 6, '85.00', 'maple-bowl.jpg'],
  ['WC-WAL-BRD', 'Walnut chopping board', 'product', 'decor', 'Walnut', 'piece', 22, 10, '64.00', 'walnut-board.jpg'],
  ['WC-OAK-MIR', 'Oak framed mirror', 'product', 'decor', 'Oak', 'piece', 5, 4, '210.00', 'oak-mirror.jpg'],
  ['WC-CUS-SHF', 'Bespoke shelving, per metre', 'product', 'custom', 'Oak', 'piece', 0, 1, '340.00', 'bespoke-shelving.jpg'],
  ['WC-CUS-KIT', 'Bespoke kitchen island', 'product', 'custom', 'Walnut', 'piece', 1, 1, '3600.00', 'kitchen-island.jpg'],
  ['RM-TIM-OAK', 'European oak, kiln dried', 'material', 'timber', 'Oak', 'board_ft', 420, 150, '14.50', null],
  ['RM-TIM-WAL', 'American black walnut', 'material', 'timber', 'Walnut', 'board_ft', 95, 120, '28.00', null],
  ['RM-TIM-ASH', 'English ash', 'material', 'timber', 'Ash', 'board_ft', 260, 100, '11.20', null],
  ['RM-TIM-MAP', 'Hard maple', 'material', 'timber', 'Maple', 'board_ft', 180, 80, '16.75', null],
  ['RM-HDW-HNG', 'Brass butt hinges', 'material', 'hardware', null, 'pack', 34, 20, '18.00', null],
  ['RM-HDW-SCR', 'Wood screws, assorted', 'material', 'hardware', null, 'pack', 12, 15, '9.50', null],
  ['RM-HDW-RUN', 'Soft-close drawer runners', 'material', 'hardware', null, 'pack', 8, 10, '42.00', null],
  ['RM-FIN-OIL', 'Danish oil', 'material', 'finish', null, 'litre', 26, 12, '22.00', null],
  ['RM-FIN-WAX', 'Beeswax polish', 'material', 'finish', null, 'litre', 7, 8, '17.50', null],
  ['RM-FIN-LAC', 'Water-based lacquer', 'material', 'finish', null, 'litre', 31, 15, '34.00', null],
].map(([sku, name, item_class, category, wood_type, unit, quantity, reorder_level, unit_price, image], i) => ({
  id: i + 1,
  sku,
  name,
  item_class,
  category,
  wood_type,
  unit,
  quantity,
  reorder_level,
  unit_price,
  image,
  ...stamps(-120 + i),
}))

/**
 * Orders. Deliveries and returns share this table: a return is the same
 * document inverted, carrying two extra fields. Keeping them together is what
 * lets the Logistics board and the Orders ledger be the same rows rather than
 * two lists that can drift apart.
 *
 * deposit_paid is stored; the outstanding balance is derived, never stored,
 * so the two can never disagree.
 */
const DELIVERIES = [
  // ref, name, inventory_id, price, deposit, status, source, ordered, due, customer, owner, priority, stock
  ['WC-1021', 'Oak dining table, 6 seat', 1, '1850.00', '600.00', 'delivered', 'website', -84, -24, 1, 1, 'high_priority', 'fulfilled'],
  ['WC-1024', 'Walnut writing desk', 2, '1240.00', '400.00', 'delivered', 'instagram', -72, -18, 2, 2, 'medium_priority', 'fulfilled'],
  ['WC-1028', 'Cherry sideboard', 5, '2100.00', '1050.00', 'delivered', 'direct', -66, -12, 3, 1, 'overrider', 'fulfilled'],
  ['WC-1033', 'Maple serving bowl', 6, '85.00', '85.00', 'delivered', 'facebook', -40, -31, 4, 3, 'low_priority', 'fulfilled'],
  ['WC-1035', 'Ash dining chair, set of 4', 3, '960.00', '300.00', 'in_transit', 'website', -22, 4, 5, 2, 'medium_priority', 'fulfilled'],
  ['WC-1038', 'Oak framed mirror', 8, '210.00', '210.00', 'in_transit', 'instagram', -16, 2, 6, 3, 'low_priority', 'fulfilled'],
  ['WC-1041', 'Walnut chopping board', 7, '64.00', '64.00', 'dispatched', 'facebook', -11, 3, 7, 3, 'low_priority', 'fulfilled'],
  ['WC-1042', 'Oak bookcase, tall', 4, '1420.00', '500.00', 'dispatched', 'website', -9, 7, 8, 1, 'high_priority', 'shortfall'],
  ['WC-1045', 'Bespoke kitchen island', 10, '3600.00', '1800.00', 'processing', 'direct', -6, 38, 2, 1, 'overrider', 'fulfilled'],
  ['WC-1047', 'Bespoke shelving, per metre', 9, '340.00', '0.00', 'processing', 'website', -4, 21, 4, 2, 'medium_priority', 'shortfall'],
  ['WC-1049', 'Maple serving bowl', 6, '85.00', '0.00', 'processing', 'instagram', -2, 12, 5, 3, 'low_priority', 'fulfilled'],
  ['WC-1050', 'Oak framed mirror', 8, '210.00', '105.00', 'processing', 'facebook', -1, 16, 1, 2, 'medium_priority', 'fulfilled'],
]

const RETURNS = [
  // ref, name, inventory_id, price, status, source, ordered, due, customer, owner, type, remarks, original_ref
  ['WC-R108', 'Walnut chopping board', 7, '64.00', 'delivered', 'facebook', -28, -21, 7, 3, 'refund', 'Arrived with a hairline crack along the grain.', 'WC-1041'],
  ['WC-R112', 'Maple serving bowl', 6, '85.00', 'in_transit', 'instagram', -9, 3, 4, 3, 'exchange', 'Wrong size sent, customer ordered the large.', 'WC-1033'],
  ['WC-R114', 'Oak framed mirror', 8, '210.00', 'processing', 'website', -3, 11, 6, 2, 'exchange_modified', 'Customer would like the frame stained darker.', 'WC-1038'],
]

const deliveries = DELIVERIES.map(
  ([order_ref, name, inventory_id, price, deposit_paid, delivery_status, source, ordered, due, customer_id, owner_id, priority_lvl, stock_status], i) => ({
    id: i + 1,
    order_ref,
    name,
    inventory_id,
    price,
    deposit_paid,
    image: inventory.find((item) => item.id === inventory_id)?.image ?? null,
    delivery_status,
    kind: 'delivery',
    source,
    ordered_at: at(ordered),
    delivery_due: at(due),
    delivered_at: delivery_status === 'delivered' ? at(due) : null,
    customer_id,
    owner_id,
    priority_lvl,
    stock_status,
    return_type: null,
    remarks: null,
    returns_order_id: null,
    ...stamps(ordered),
  }),
)

const returns = RETURNS.map(
  ([order_ref, name, inventory_id, price, delivery_status, source, ordered, due, customer_id, owner_id, return_type, remarks, originalRef], i) => ({
    id: deliveries.length + i + 1,
    order_ref,
    name,
    inventory_id,
    price,
    deposit_paid: '0.00',
    image: inventory.find((item) => item.id === inventory_id)?.image ?? null,
    delivery_status,
    kind: 'return',
    source,
    ordered_at: at(ordered),
    delivery_due: at(due),
    delivered_at: delivery_status === 'delivered' ? at(due) : null,
    customer_id,
    owner_id,
    priority_lvl: 'medium_priority',
    stock_status: 'fulfilled',
    return_type,
    remarks,
    returns_order_id: deliveries.find((d) => d.order_ref === originalRef)?.id ?? null,
    ...stamps(ordered),
  }),
)

const orders = [...deliveries, ...returns]

/**
 * Carts. Shaped the way a storefront would send them, so connecting the real
 * site later is a data swap rather than a redesign. Insights treats a cart
 * with two or more items as a prospect worth chasing.
 */
const carts = [
  [1, 3, '2195.00', 'website', -0.2],
  [4, 2, '295.00', 'instagram', -0.5],
  [6, 4, '1684.00', 'website', -1],
  [8, 2, '1504.00', 'facebook', -2],
  [3, 1, '85.00', 'direct', -3],
  [5, 5, '2810.00', 'instagram', -4],
  [7, 1, '64.00', 'website', -6],
].map(([customer_id, item_count, value, source, days], i) => ({
  id: i + 1,
  customer_id,
  item_count,
  value,
  source,
  updated_at: at(days),
}))

tables.inventory = inventory
tables.orders = orders
tables.carts = carts

/**
 * Source, backfilled across the rest of the funnel.
 *
 * Assigned deterministically from each row's id rather than at random, so the
 * numbers on Statistics stay the same between reloads - a figure that moves on
 * refresh is impossible to check against anything.
 */
const SOURCE_CYCLE = ['website', 'instagram', 'facebook', 'direct']
const sourceFor = (seed) => SOURCE_CYCLE[seed % SOURCE_CYCLE.length]

for (const [key, offset] of [['leads', 0], ['customers', 1], ['campaigns', 2]]) {
  tables[key].forEach((row) => {
    row.source = sourceFor(row.id + offset)
  })
}
