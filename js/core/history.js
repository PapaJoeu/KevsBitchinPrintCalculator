// history.js — the recent-jobs list as pure data. Recording is dedupe-on-top with a
// cap; when and whether to record (the settle timer, "only if it fits") is the app's
// call. No storage, no DOM.

export const MAX_HISTORY = 20;

/** A canonical string for structural comparison: keys sorted, undefined-valued keys dropped. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    return `{${keys.map((key) => `${key}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sameJob(a, b) {
  return canonical(a) === canonical(b);
}

/**
 * A new entries array with { unit, job, at } on top. A matching entry (same unit,
 * structurally equal job) is removed from wherever it was, so re-running a setup
 * bumps it rather than repeating it. Never more than MAX_HISTORY; never mutates.
 */
export function recordJob(entries, unit, job, now) {
  const rest = entries.filter((entry) => !(entry.unit === unit && sameJob(entry.job, job)));
  return [{ unit, job: structuredClone(job), at: now }, ...rest].slice(0, MAX_HISTORY);
}
