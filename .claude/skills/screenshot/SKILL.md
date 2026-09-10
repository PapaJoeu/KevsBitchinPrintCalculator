---
name: screenshot
description: Screenshot and inspect the running app at a real mobile or desktop viewport via the Chrome DevTools protocol. Use whenever verifying a UI change, checking mobile layout, or reading live DOM state — plain `chrome --headless --window-size` gives misleading mobile results.
disable-model-invocation: true
---

# Screenshot the app at a real viewport

## The trap this exists to avoid

`chrome --headless --window-size=390,844 --screenshot=out.png` **does not give a
390px mobile viewport.** Chrome lays the page out at roughly 500px and then crops
the image to 390. The result looks like a phone screenshot but isn't one.

During this project that cost a wasted fix round: content appeared to overflow
the right edge, a fix was written and dispatched, and the overflow turned out to
be the crop. Measuring properly showed `scrollWidth === clientWidth` — no overflow
had ever existed.

Only `Emulation.setDeviceMetricsOverride` over the DevTools protocol sets a true
viewport. `shoot.py` in this directory does that. It has no dependencies (raw
sockets, no pip install), matching this project's zero-dependency constraint.

## Prerequisite

The dev server must be running:

```bash
npm start          # serves http://localhost:8080
```

Check with `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/`.

## Usage

```bash
# Phone viewport (the default check)
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 shot.png

# Desktop, to check the 900px breakpoint's two-column layout
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 1200 900 desk.png

# Just one section — takes any CSS selector, clips to its bounding box
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 seq.png \
  --clip "#sequence"

# The whole scrollable page
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 1900 all.png --full
```

Then **Read the PNG** to actually look at it.

## Driving and measuring, not just looking

`--eval` runs JS before the shot (repeatable, applied in order). `--print`
evaluates an expression and prints the result. Prefer `--print` over squinting at
pixels — read the real numbers.

```bash
# Click a fold style, then count the resulting score rows
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 out.png \
  --eval "document.querySelector('#foldInputs button[data-style=\"trifold\"]').click()" \
  --print "document.querySelectorAll('#scores tbody tr').length"

# Prove there is no horizontal scrolling (the check that was misread before)
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 out.png \
  --print "document.documentElement.scrollWidth + ' vs ' + document.documentElement.clientWidth"

# Confirm the canvas is DPR-correct rather than soft
python .claude/skills/screenshot/shoot.py http://localhost:8080/ 390 844 out.png \
  --print "const c=document.getElementById('canvas'); c.width+'x'+c.height+' backing / '+c.clientWidth+'x'+c.clientHeight+' css'"
```

Note `--eval` and `--print` run **before** the screenshot, so a click and its
resulting shot happen in one invocation.

## Selectors worth knowing

| What | Selector |
|---|---|
| n-up figure | `#summary .nup` |
| Orientation hint | `#summary .hint-box` |
| Sequence step rows | `li.step` |
| Turn bands | `li.turn` |
| Step measurements | `.step-pos` |
| Sheet canvas | `#canvas` |
| Score table rows | `#scores tbody tr` |
| Size preset chips | `#sheetInputs .chips button` |
| Fold style buttons | `#foldInputs button[data-style="bifold"]` |
| Fold axis buttons | `#foldInputs button[data-axis="W"]` |
| Unit toggle | `#unitChips button[data-unit="mm"]` |

## Expected baseline

On load with the default business-card job (3.5x2 on 12x18, 1/8" gutters):
**24-up**, 22 step rows, 4 turn bands, and the "fits 25-up instead of 24-up"
orientation hint. If those differ, something regressed.

## Offline testing

`shoot.py` does not cover the service worker. To test offline, drive
`Network.emulateNetworkConditions {"offline": true}` over CDP after a first
online load, then navigate again — and confirm the app still *recalculates*
(click a different document preset) rather than only rendering cached HTML.
