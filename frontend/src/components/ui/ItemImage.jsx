import { useState } from 'react'
import { initialsOf } from '../../lib/format.js'

/**
 * A photo of a piece, with a fallback that is not a broken image.
 *
 * Files live in public/orders/ and rows store only the filename, so moving the
 * folder never invalidates the data. Until a file exists, onError swaps in a
 * generated wood-tone swatch carrying the item's initials.
 *
 * That fallback is the point: without it every row shows the browser's broken
 * image glyph from now until the photographs arrive, which makes a working app
 * look broken.
 */

/** Deterministic tone per item, so a given piece always looks the same. */
const TONES = [
  ['#6b4a2f', '#8c6239'], // walnut
  ['#9c6b3f', '#b98b54'], // oak
  ['#7a5230', '#a06c3f'], // cherry
  ['#8a6a45', '#ab8a60'], // ash
  ['#5e4229', '#7d5a39'], // dark stain
]

const toneFor = (seed) => {
  const text = String(seed ?? '')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return TONES[Math.abs(hash) % TONES.length]
}

export function ItemImage({ file, name, size = 36, rounded = 'rounded-control', className = '' }) {
  const [failed, setFailed] = useState(false)
  const [from, to] = toneFor(name || file)
  const box = { width: size, height: size }

  if (!file || failed) {
    return (
      <span
        aria-hidden="true"
        title={name ?? undefined}
        style={{ ...box, background: 'linear-gradient(140deg, ' + from + ', ' + to + ')' }}
        className={
          'grid shrink-0 place-items-center text-[10px] font-semibold text-white/85 ' +
          'ring-1 ring-inset ring-white/10 ' +
          rounded +
          ' ' +
          className
        }
      >
        {initialsOf(name) }
      </span>
    )
  }

  return (
    <img
      src={'/orders/' + file}
      alt={name ?? ''}
      loading="lazy"
      onError={() => setFailed(true)}
      style={box}
      className={'shrink-0 object-cover ring-1 ring-inset ring-rule ' + rounded + ' ' + className}
    />
  )
}
