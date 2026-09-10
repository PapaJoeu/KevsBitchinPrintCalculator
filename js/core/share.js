// share.js — the job as a URL hash and back. Pure: no DOM, no storage, no unit
// conversion. The hash mirrors the job as entered, in its own unit; keys at their
// default are omitted so the common link stays short. Anything malformed decodes
// to null — never a partial job. Defaults arrive as a parameter: core never
// imports from js/ui/.
//
//   v=1&u=in&s=12x18&d=3.5x2&g=0.125x0.125[&n=t,b,l,r][&c=AxD][&a=edge=n,...][&f=style|axis|allowance][&x=n,...]

const UNITS = ['in', 'mm'];
const EDGES = ['top', 'bottom', 'left', 'right'];
const FOLD_STYLES = ['bifold', 'trifold', 'zfold'];
const AXES = ['L', 'W'];

// A plain non-negative decimal as typed: "3.5", ".125", "0". No sign, no exponent, no hex.
const NUMBER = /^(?:\d+\.?\d*|\.\d+)$/;
const nonNegative = (text) => (typeof text === 'string' && NUMBER.test(text) ? Number(text) : null);
const positive = (text) => {
  const n = nonNegative(text);
  return n !== null && n > 0 ? n : null;
};

/** "AxB" → { [keys[0]]: A, [keys[1]]: B }, each part checked by `each`; null if malformed. */
function pairOf(text, each, keys) {
  if (typeof text !== 'string') return null;
  const parts = text.split('x');
  if (parts.length !== 2) return null;
  const a = each(parts[0]);
  const b = each(parts[1]);
  return a === null || b === null ? null : { [keys[0]]: a, [keys[1]]: b };
}

/** The hash body for a job, without the leading '#'. `defaults` is DEFAULTS[unit]. */
export function encodeJob(unit, job, defaults) {
  const parts = [
    'v=1',
    `u=${unit}`,
    `s=${job.sheet.width}x${job.sheet.length}`,
    `d=${job.doc.width}x${job.doc.length}`,
    `g=${job.gutter.columns}x${job.gutter.rows}`,
  ];
  if (EDGES.some((edge) => job.npa[edge] !== defaults.npa[edge])) parts.push(`n=${EDGES.map((edge) => job.npa[edge]).join(',')}`);
  if (job.count.across !== undefined || job.count.down !== undefined) parts.push(`c=${job.count.across ?? ''}x${job.count.down ?? ''}`);
  const aligned = EDGES.filter((edge) => edge in job.align);
  if (aligned.length) parts.push(`a=${aligned.map((edge) => `${edge}=${job.align[edge]}`).join(',')}`);
  if (job.fold.style !== 'none') parts.push(`f=${job.fold.style}|${job.fold.axis}|${job.fold.allowance}`);
  if (job.fold.custom.length) parts.push(`x=${job.fold.custom.join(',')}`);
  return parts.join('&');
}

/** A job from a hash (with or without '#', percent-encoded or not), or null. `defaultsByUnit` is DEFAULTS. */
export function decodeJob(hash, defaultsByUnit) {
  let text;
  try {
    text = decodeURIComponent(String(hash ?? '').replace(/^#/, ''));
  } catch {
    return null;
  }
  if (!text) return null;

  const fields = new Map();
  for (const piece of text.split('&')) {
    const at = piece.indexOf('=');
    if (at <= 0) return null;
    fields.set(piece.slice(0, at), piece.slice(at + 1));
  }
  if (fields.get('v') !== '1') return null;
  const unit = fields.get('u');
  if (!UNITS.includes(unit)) return null;
  const defaults = defaultsByUnit[unit];

  const sheet = pairOf(fields.get('s'), positive, ['width', 'length']);
  const doc = pairOf(fields.get('d'), positive, ['width', 'length']);
  const gutter = pairOf(fields.get('g'), nonNegative, ['columns', 'rows']);
  if (!sheet || !doc || !gutter) return null;
  const job = { sheet, doc, gutter, npa: { ...defaults.npa }, count: {}, align: {}, fold: structuredClone(defaults.fold) };

  if (fields.has('n')) {
    const values = fields.get('n').split(',').map(nonNegative);
    if (values.length !== 4 || values.includes(null)) return null;
    job.npa = Object.fromEntries(EDGES.map((edge, i) => [edge, values[i]]));
  }

  if (fields.has('c')) {
    const parts = fields.get('c').split('x');
    if (parts.length !== 2 || (parts[0] === '' && parts[1] === '')) return null;
    for (const [key, part] of [['across', parts[0]], ['down', parts[1]]]) {
      if (part === '') continue;
      const n = nonNegative(part);
      if (n === null || !Number.isInteger(n) || n < 1) return null;
      job.count[key] = n;
    }
  }

  if (fields.has('a')) {
    for (const item of fields.get('a').split(',')) {
      const [edge, value] = item.split('=');
      const n = nonNegative(value);
      if (!EDGES.includes(edge) || n === null || edge in job.align) return null;
      job.align[edge] = n;
    }
    if (('top' in job.align && 'bottom' in job.align) || ('left' in job.align && 'right' in job.align)) return null;
  }

  if (fields.has('f')) {
    const [style, axis, allowance, ...rest] = fields.get('f').split('|');
    const n = nonNegative(allowance);
    if (rest.length || !FOLD_STYLES.includes(style) || !AXES.includes(axis) || n === null) return null;
    job.fold = { style, axis, allowance: n, custom: [] };
  }

  if (fields.has('x')) {
    const values = fields.get('x').split(',').map(nonNegative);
    if (values.includes(null)) return null;
    job.fold.custom = values;
  }

  return { unit, job };
}
