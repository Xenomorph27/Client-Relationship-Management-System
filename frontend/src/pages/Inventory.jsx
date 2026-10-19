import { useMemo, useState } from 'react'
import { Boxes, Plus, TriangleAlert } from 'lucide-react'
import { createItem, deleteItem, listInventory, updateItem } from '../api/inventory.js'
import { listOrders } from '../api/orders.js'
import { useAsync } from '../hooks/useAsync.js'
import { PageHeader, Panel, Screen } from '../components/layout/PageHeader.jsx'
import { DataTable } from '../components/data/DataTable.jsx'
import { FilterSelect, SearchInput, Toolbar } from '../components/data/Toolbar.jsx'
import { FormDrawer, optionsFrom } from '../components/data/FormDrawer.jsx'
import { Button } from '../components/ui/Button.jsx'
import { ItemImage } from '../components/ui/ItemImage.jsx'
import { DetailList, DetailRow, DetailSection, Drawer } from '../components/ui/Drawer.jsx'
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import {
  ITEM_CLASSES,
  MATERIAL_CATEGORIES,
  PRODUCT_CATEGORIES,
  UNITS,
  categoryLabel,
  isLowStock,
  itemClassMeta,
  unitMeta,
} from '../lib/domain.js'
import { formatAmount, formatDate } from '../lib/format.js'

const BLANK = {
  sku: '',
  name: '',
  item_class: 'product',
  category: 'furniture',
  wood_type: '',
  unit: 'piece',
  quantity: '',
  reorder_level: '',
  unit_price: '',
  image: '',
}

export default function Inventory() {
  const inventory = useAsync(() => listInventory({ limit: 500 }), [])
  const orders = useAsync(() => listOrders({ limit: 500 }), [])

  const [query, setQuery] = useState('')
  const [cls, setCls] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = inventory.data ?? []
  const low = rows.filter(isLowStock)

  // Orders accepted with nothing on the shelf. The workshop's to-make list.
  const shortfalls = (orders.data ?? []).filter((o) => o.stock_status === 'shortfall')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((item) => {
      if (cls && item.item_class !== cls) return false
      if (lowOnly && !isLowStock(item)) return false
      if (!needle) return true
      return [item.name, item.sku, item.category, item.wood_type]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(needle))
    })
  }, [rows, query, cls, lowOnly])

  const heldValue = rows.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price ?? 0), 0)

  const columns = [
    {
      key: 'image',
      header: '',
      width: '5%',
      sortable: false,
      render: (row) => <ItemImage file={row.image} name={row.name} size={26} />,
    },
    { key: 'sku', header: 'SKU', width: '11%', mono: true },
    { key: 'name', header: 'Item', width: '24%' },
    {
      key: 'item_class',
      header: 'Class',
      width: '12%',
      sortValue: (row) => itemClassMeta(row.item_class).label,
      render: (row) => <span className="text-ink-2">{itemClassMeta(row.item_class).label}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      width: '11%',
      render: (row) => <span className="text-ink-2">{categoryLabel(row.category)}</span>,
    },
    {
      key: 'wood_type',
      header: 'Wood',
      width: '9%',
      render: (row) => row.wood_type ?? <span className="text-ink-3">—</span>,
    },
    {
      key: 'quantity',
      header: 'In stock',
      width: '12%',
      align: 'right',
      mono: true,
      sortValue: (row) => Number(row.quantity),
      render: (row) => (
        <span className={isLowStock(row) ? 'text-heat-2' : 'text-ink'}>
          {row.quantity} <span className="text-ink-3">{unitMeta(row.unit).label}</span>
          {isLowStock(row) && <span className="ml-1.5 text-2xs">low</span>}
        </span>
      ),
    },
    {
      key: 'unit_price',
      header: 'Unit price',
      width: '10%',
      align: 'right',
      mono: true,
      sortValue: (row) => Number(row.unit_price ?? 0),
      render: (row) => formatAmount(row.unit_price),
    },
  ]

  async function save(values) {
    setBusy(true)
    try {
      const num = (v) => (v === '' || v == null ? 0 : Number(v))
      const payload = {
        ...values,
        quantity: num(values.quantity),
        reorder_level: num(values.reorder_level),
        unit_price: values.unit_price == null ? null : String(values.unit_price),
        wood_type: values.wood_type || null,
        image: values.image || null,
      }
      if (editing?.id) await updateItem(editing.id, payload)
      else await createItem(payload)
      setEditing(null)
      inventory.reload()
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteItem(deleting.id)
      setDeleting(null)
      setSelected(null)
      inventory.reload()
    } finally {
      setBusy(false)
    }
  }

  const categoriesFor = (itemClass) =>
    itemClass === 'material' ? MATERIAL_CATEGORIES : PRODUCT_CATEGORIES

  return (
    <Screen>
      <PageHeader
        title="Inventory"
        count={inventory.loading ? null : rows.length}
        description={
          low.length > 0
            ? low.length + ' below reorder level · ' + formatAmount(heldValue) + ' held'
            : formatAmount(heldValue) + ' held'
        }
        actions={
          <Button variant="primary" onClick={() => setEditing({ ...BLANK })}>
            <Plus size={14} />
            Add item
          </Button>
        }
      />

      <Panel className="overflow-y-auto">
        {shortfalls.length > 0 && (
          <section className="border-b border-rule">
            <header className="flex items-baseline gap-2 px-4 pt-4 pb-2">
              <TriangleAlert size={14} className="text-heat-2" />
              <h2 className="text-sm text-ink">Needs making</h2>
              <span className="tnum text-xs text-ink-3">{shortfalls.length}</span>
              <span className="text-xs text-ink-3">
                accepted with nothing on the shelf
              </span>
            </header>
            <ul className="divide-y divide-rule/70 border-t border-rule">
              {shortfalls.map((order) => (
                <li key={order.id} className="flex items-center gap-3 px-4 py-2">
                  <ItemImage file={order.image} name={order.name} size={24} />
                  <span className="min-w-0 flex-1 truncate text-ink">{order.name}</span>
                  <span className="tnum text-xs text-ink-3">{order.order_ref}</span>
                  <span className="tnum w-20 text-right text-xs text-ink-2">
                    {formatAmount(order.price)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Toolbar count={filtered.length} total={rows.length}>
          <SearchInput value={query} onChange={setQuery} placeholder="Search item, SKU, wood" />
          <FilterSelect value={cls} onChange={setCls} label="Filter by class">
            <option value="">Everything</option>
            {ITEM_CLASSES.map((c) => (
              <option key={c} value={c}>
                {itemClassMeta(c).plural}
              </option>
            ))}
          </FilterSelect>
          <Button
            size="sm"
            variant={lowOnly ? 'primary' : 'secondary'}
            onClick={() => setLowOnly((v) => !v)}
          >
            {lowOnly ? 'Showing low stock' : 'Low stock only'}
          </Button>
        </Toolbar>

        <DataTable
          columns={columns}
          rows={filtered}
          loading={inventory.loading}
          error={inventory.error}
          onRetry={inventory.reload}
          onRowClick={setSelected}
          activeId={selected?.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          empty={
            <EmptyState
              icon={Boxes}
              title={rows.length === 0 ? 'Nothing in stock' : 'Nothing matches those filters'}
              body={
                rows.length === 0
                  ? 'Inventory holds both finished pieces and the timber, hardware and finishes they are made from.'
                  : 'Widen the search or clear a filter.'
              }
            />
          }
        />
      </Panel>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? selected.sku + ' · ' + itemClassMeta(selected.item_class).label : ''}
        footer={
          <>
            <Button variant="dangerGhost" onClick={() => setDeleting(selected)}>
              Delete
            </Button>
            <Button
              variant="primary"
              onClick={() => setEditing({ ...selected, wood_type: selected.wood_type ?? '', image: selected.image ?? '' })}
            >
              Edit item
            </Button>
          </>
        }
      >
        {selected && (
          <>
            <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
              <ItemImage file={selected.image} name={selected.name} size={56} rounded="rounded-panel" />
              <div>
                <div className={'tnum text-base ' + (isLowStock(selected) ? 'text-heat-2' : 'text-ink')}>
                  {selected.quantity} {unitMeta(selected.unit).long.toLowerCase()}
                </div>
                <div className="text-xs text-ink-3">
                  reorder at {selected.reorder_level}
                  {isLowStock(selected) && <span className="ml-2 text-heat-2">below level</span>}
                </div>
              </div>
            </div>

            <DetailList>
              <DetailRow label="SKU" mono>
                {selected.sku}
              </DetailRow>
              <DetailRow label="Class">{itemClassMeta(selected.item_class).label}</DetailRow>
              <DetailRow label="Category">{categoryLabel(selected.category)}</DetailRow>
              <DetailRow label="Wood">{selected.wood_type}</DetailRow>
              <DetailRow label="Unit price" mono>
                {formatAmount(selected.unit_price)}
              </DetailRow>
              <DetailRow label="Value held" mono>
                {formatAmount(Number(selected.quantity) * Number(selected.unit_price ?? 0))}
              </DetailRow>
              <DetailRow label="Added" mono>
                {formatDate(selected.created_at)}
              </DetailRow>
            </DetailList>

            <DetailSection title="Image">
              <p className="px-4 pb-3 text-xs text-ink-3">
                {selected.image
                  ? 'Looks for public/orders/' + selected.image
                  : 'No file set. A wood-tone swatch is shown instead.'}
              </p>
            </DetailSection>
          </>
        )}
      </Drawer>

      <FormDrawer
        value={editing}
        busy={busy}
        onCancel={() => setEditing(null)}
        onSave={save}
        titleNew="Add item"
        titleEdit="Edit item"
        submitNew="Add item"
        subtitle={editing?.id ? editing.sku : 'A finished piece, or the material it is made from'}
        width="max-w-lg"
        fields={[
          { name: 'name', label: 'Item name', required: true, placeholder: 'Oak dining table, 6 seat' },
          { name: 'sku', label: 'SKU', required: true, span: 1, placeholder: 'WC-OAK-DT6' },
          {
            name: 'item_class',
            label: 'Class',
            type: 'select',
            span: 1,
            options: optionsFrom(ITEM_CLASSES, (c) => itemClassMeta(c).label),
          },
          {
            name: 'category',
            label: 'Category',
            type: 'select',
            span: 1,
            options: optionsFrom(
              [...new Set([...categoriesFor(editing?.item_class), ...categoriesFor('product'), ...categoriesFor('material')])],
              categoryLabel,
            ),
          },
          { name: 'wood_type', label: 'Wood', span: 1, nullable: true, placeholder: 'Oak', hint: 'Optional' },
          {
            name: 'unit',
            label: 'Unit',
            type: 'select',
            span: 1,
            options: optionsFrom(UNITS, (u) => unitMeta(u).long),
          },
          { name: 'unit_price', label: 'Unit price', type: 'number', span: 1, placeholder: '0.00' },
          { name: 'quantity', label: 'In stock', type: 'number', span: 1 },
          { name: 'reorder_level', label: 'Reorder at', type: 'number', span: 1 },
          {
            name: 'image',
            label: 'Image file',
            nullable: true,
            hint: 'Filename in public/orders/',
            placeholder: 'oak-dining-table.jpg',
          },
        ]}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={'Delete ' + (deleting?.name ?? 'this item') + '?'}
        body="The item is removed from inventory. Orders referencing it are not deleted."
      />
    </Screen>
  )
}
