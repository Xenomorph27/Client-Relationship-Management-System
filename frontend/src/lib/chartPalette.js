/**
 * Colour for chart marks.
 *
 * Three different jobs, three different answers - picking one at random is how
 * a page ends up all one blue:
 *
 *   Stage-shaped data  -> borrow the pipeline ramp from domain.js. A bar for
 *                         "Negotiation" should be the colour Negotiation
 *                         already is everywhere else in the app.
 *   Categorical data   -> the validated set below. Industries are unrelated
 *                         identities, so they get unrelated hues.
 *   Magnitude data     -> one hue. Different colours per row would imply the
 *                         rows are different kinds of thing rather than
 *                         different sizes of the same thing.
 *
 * The categorical set measures deltaE 12.0 at its closest pair under
 * protanopia and 19.3 in normal vision, checked with the palette validator
 * rather than by eye. Assign in fixed order, never cycled: a seventh category
 * folds into "Other" instead of wrapping back to slot one.
 */

export const CATEGORICAL = [
  '#5b8ff9', // blue
  '#5ad8a6', // green
  '#f6bd16', // gold
  '#e8684a', // coral
  '#9270ca', // violet
  '#6dc8ec', // sky
]

/** Beyond the palette, everything collapses into one neutral "Other". */
const OVERFLOW = '#6b7a91'

export const categorical = (index) =>
  index < CATEGORICAL.length ? CATEGORICAL[index] : OVERFLOW

/** Single hue for magnitude, matching the Statistics screen's own identity. */
export const MAGNITUDE = '#ffb03a'

/** The two-series pair used by the trend chart, validated at deltaE 24. */
export const SERIES = { primary: '#5b8ff9', secondary: '#3fd4a2' }
