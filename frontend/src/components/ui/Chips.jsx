import { campaignState, leadStatusMeta, priorityMeta } from '../../lib/domain.js'

/**
 * Status chips. Each pairs its colour with a word, so meaning survives for
 * anyone who cannot distinguish the hues.
 */

const CHIP =
  'inline-flex items-center gap-1 rounded-control px-1.5 h-[19px] text-2xs tracking-tight'

export function PriorityChip({ value, compact = false }) {
  const meta = priorityMeta(value)
  return (
    <span className={CHIP + ' ' + meta.chip} title={'Priority: ' + meta.label}>
      {compact ? meta.short : meta.label}
    </span>
  )
}

/** For dense rows where a full chip would crowd the line. */
export function PriorityDot({ value }) {
  const meta = priorityMeta(value)
  return (
    <span className="inline-flex items-center gap-1.5" title={'Priority: ' + meta.label}>
      <span className={'h-1.5 w-1.5 shrink-0 rounded-full ' + meta.dot} />
      <span className="text-ink-2">{meta.label}</span>
    </span>
  )
}

export function LeadStatus({ value }) {
  const meta = leadStatusMeta(value)
  return <span className={meta.text}>{meta.label}</span>
}

export function CampaignState({ campaign }) {
  const state = campaignState(campaign)
  return (
    <span className={'inline-flex items-center gap-1.5 ' + state.text}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {state.label}
    </span>
  )
}
