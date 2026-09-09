// visualizer.js — the sheet preview: a confirmation glance, not a workspace (spec "Visualizer").
// fitSheet and canLabel are pure and tested; createVisualizer owns the canvas.

const PALETTE = {
  paper: '#ffffff',
  shadow: '#808080',
  ink: '#000000',
  doc: '#dfe3ee',
  docEdge: '#000080',
  score: '#ff00ff',
};
const PAD = 18;

/** Scale and offset that centre a sheet (inches) in a cssWidth x cssHeight box, leaving `pad` px clear. */
export function fitSheet(cssWidth, cssHeight, sheet, pad = PAD) {
  const scale = Math.min((cssWidth - 2 * pad) / sheet.width, (cssHeight - 2 * pad) / sheet.length);
  return {
    scale,
    x: (cssWidth - sheet.width * scale) / 2,
    y: (cssHeight - sheet.length * scale) / 2,
  };
}

/** Whether a document drawn at this pixel size can carry a legible number. */
export function canLabel(docWidthPx, docLengthPx) {
  return docWidthPx >= 26 && docLengthPx >= 16;
}

export function createVisualizer(canvas) {
  let current = null;

  function paint() {
    if (!current) return;
    const { layout, scores, format } = current;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (cssWidth === 0 || cssHeight === 0) return;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const { sheet } = layout;
    const { scale, x: ox, y: oy } = fitSheet(cssWidth, cssHeight, sheet);
    const X = (v) => ox + v * scale;
    const Y = (v) => oy + v * scale;
    const sw = sheet.width * scale;
    const sl = sheet.length * scale;

    // Paper with a hard 98 drop shadow.
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(ox + 3, oy + 3, sw, sl);
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(ox, oy, sw, sl);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, sw - 1, sl - 1);

    // Head marker: the edge the first cut squares.
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.moveTo(ox + sw / 2 - 5, oy - 9);
    ctx.lineTo(ox + sw / 2 + 5, oy - 9);
    ctx.lineTo(ox + sw / 2, oy - 3);
    ctx.closePath();
    ctx.fill();

    // Dimensions along the bottom and left edges, so a turned sheet is unmistakable.
    ctx.font = '11px Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(format(sheet.width), ox + sw / 2, oy + sl + 5);
    ctx.save();
    ctx.translate(ox - 5, oy + sl / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'bottom';
    ctx.fillText(format(sheet.length), 0, 0);
    ctx.restore();

    if (layout.fits) {
      // Past a few thousand, each document is sub-pixel anyway — draw the imposed
      // block as one rect so a mistyped size degrades the preview instead of
      // freezing the page.
      if (layout.docs.length > 5000) {
        ctx.fillStyle = PALETTE.doc;
        ctx.fillRect(X(layout.margins.left), Y(layout.margins.top),
                     layout.imposed.width * scale, layout.imposed.length * scale);
        ctx.strokeStyle = PALETTE.docEdge;
        ctx.strokeRect(X(layout.margins.left) + 0.5, Y(layout.margins.top) + 0.5,
                       layout.imposed.width * scale - 1, layout.imposed.length * scale - 1);
      } else {
        const label = canLabel(layout.doc.width * scale, layout.doc.length * scale);
        ctx.font = `${Math.min(12, Math.max(9, (layout.doc.length * scale) / 3))}px Tahoma, sans-serif`;
        ctx.textBaseline = 'middle';
        layout.docs.forEach((d, i) => {
          const x = X(d.x);
          const y = Y(d.y);
          const w = d.width * scale;
          const l = d.length * scale;
          ctx.fillStyle = PALETTE.doc;
          ctx.fillRect(x, y, w, l);
          ctx.strokeStyle = PALETTE.docEdge;
          ctx.strokeRect(x + 0.5, y + 0.5, w - 1, l - 1);
          if (label) {
            ctx.fillStyle = PALETTE.docEdge;
            ctx.fillText(String(i + 1), x + w / 2, y + l / 2);
          }
        });
      }
    }

    // Scores: dashed magenta on each document, above the fill. Same document-count
    // guard as above: past the threshold, segments explode along with docs, and
    // building/stroking a multi-million-point path is its own freeze risk.
    if (scores.segments.length > 0 && layout.docs.length <= 5000) {
      ctx.save();
      ctx.strokeStyle = PALETTE.score;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (const s of scores.segments) {
        ctx.moveTo(X(s.x1), Y(s.y1));
        ctx.lineTo(X(s.x2), Y(s.y2));
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // Repaint on resize and orientation change; the CSS box decides the size.
  new ResizeObserver(paint).observe(canvas);

  return {
    /** Redraw for a new result. `format(inches)` gives the dimension label text. */
    draw(layout, scores, format) {
      current = { layout, scores, format };
      paint();
    },
  };
}
