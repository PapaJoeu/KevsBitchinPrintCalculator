# Kev's Bitchin' Print Calculator

A phone-first calculator for print production. Enter sheet, document, and gutter
sizes; get the imposition, the guillotine program sequence to key into the cutter,
and score positions for folds. Windows 98 style. Works offline once opened.

## Run locally

    npm start

Then open http://localhost:8080. ES modules need an HTTP origin, so `file://` will not work.

## Tests

    npm test

The core (`js/core/`) is pure and covered by `node:test`, including two
hand-verified program sequences (`tests/sequence.test.js`). Change the cutting
model only with those fixtures passing.

## Deploy

Push to `main`; GitHub Pages serves the repo root. **Bump `VERSION` in `sw.js`**
whenever a cached file changes, or phones keep the old build.

## Icons

    node tools/make-icons.mjs

## Design

- Spec: `docs/superpowers/specs/2026-09-09-mobile-print-calculator-design.md`
- Plan: `docs/superpowers/plans/2026-09-09-mobile-print-calculator.md`
