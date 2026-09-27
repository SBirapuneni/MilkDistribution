// Small, dependency-free SVG chart helpers. Each render* function returns an
// HTML string; call attachTooltips() on the containing element after it's
// inserted into the DOM to wire up hover tooltips on any element carrying a
// data-tooltip attribute.

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CATEGORICAL = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
];

export function assignColors(labels: string[]): Map<string, string> {
  const map = new Map<string, string>();
  labels.forEach((label, i) => map.set(label, CATEGORICAL[i % CATEGORICAL.length]));
  return map;
}

let tooltipEl: HTMLDivElement | null = null;

function getTooltip(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'chart-tooltip';
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

export function attachTooltips(container: HTMLElement) {
  const tooltip = getTooltip();
  container.querySelectorAll<HTMLElement>('[data-tooltip]').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      tooltip.textContent = el.dataset.tooltip || '';
      tooltip.style.display = 'block';
    });
    el.addEventListener('mousemove', (e) => {
      tooltip.style.left = `${(e as MouseEvent).pageX + 14}px`;
      tooltip.style.top = `${(e as MouseEvent).pageY + 14}px`;
    });
    el.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

/** Part-to-whole ring. Per dataviz guidance, only meaningful for >=3 segments
 * (a 2-slice pie should be a stat/split-bar instead — see renderSplitBar). */
export function renderDonutChart(
  data: { label: string; value: number; color: string }[],
  formatValue: (n: number) => string,
): string {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const size = 160;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let acc = 0;
  const segments = data
    .map((d) => {
      const frac = d.value / total;
      const len = frac * circumference;
      const dashoffset = -acc;
      acc += len;
      const pct = (frac * 100).toFixed(1);
      return `<circle
        cx="${size / 2}" cy="${size / 2}" r="${radius}"
        fill="none" stroke="${d.color}" stroke-width="${strokeWidth}"
        stroke-dasharray="${len.toFixed(2)} ${(circumference - len).toFixed(2)}"
        stroke-dashoffset="${dashoffset.toFixed(2)}"
        transform="rotate(-90 ${size / 2} ${size / 2})"
        data-tooltip="${escapeHtml(d.label)}: ${escapeHtml(formatValue(d.value))} (${pct}%)"
      ></circle>`;
    })
    .join('');

  const legend = data
    .map(
      (d) =>
        `<li><span class="legend-dot" style="background:${d.color}"></span>${escapeHtml(d.label)} <span class="legend-value">${escapeHtml(formatValue(d.value))}</span></li>`,
    )
    .join('');

  return `
    <div class="donut-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="var(--color-track-bg)" stroke-width="${strokeWidth}"></circle>
        ${segments}
        <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="middle" class="donut-total">${escapeHtml(formatValue(total))}</text>
      </svg>
      <ul class="chart-legend">${legend}</ul>
    </div>
  `;
}

/** A single 100%-wide bar split into segments — the correct part-to-whole form
 * for exactly two categories (a 2-slice pie is an anti-pattern). */
export function renderSplitBar(data: { label: string; value: number; color: string }[], formatValue: (n: number) => string): string {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const segments = data
    .map((d) => {
      const pct = (d.value / total) * 100;
      return `<div class="split-bar-segment" style="width:${pct}%; background:${d.color}" data-tooltip="${escapeHtml(d.label)}: ${escapeHtml(formatValue(d.value))} (${pct.toFixed(0)}%)"></div>`;
    })
    .join('');
  const legend = data
    .map(
      (d) =>
        `<span><span class="legend-dot" style="background:${d.color}"></span>${escapeHtml(d.label)} <span class="legend-value">${escapeHtml(formatValue(d.value))}</span></span>`,
    )
    .join('');

  return `
    <div class="split-bar-wrap">
      <div class="split-bar">${segments}</div>
      <div class="chart-legend inline">${legend}</div>
    </div>
  `;
}

/** A single-series trend line over ordered categories (usually dates). */
export function renderLineChart(
  points: { x: string; y: number; extra?: string }[],
  color: string,
  formatValue: (n: number) => string,
): string {
  if (points.length === 0) return '<p class="muted">No data.</p>';

  const width = 640;
  const height = 200;
  const padding = 32;
  const maxY = Math.max(...points.map((p) => p.y), 1);
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const scaleY = (v: number) => height - padding - (v / maxY) * (height - padding * 2);

  const coords = points.map((p, i) => ({ x: padding + i * stepX, y: scaleY(p.y), p }));
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const baseY = (height - padding).toFixed(1);
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baseY} L ${coords[0].x.toFixed(1)} ${baseY} Z`;

  const dots = coords
    .map(
      (c) =>
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" fill="${color}" data-tooltip="${escapeHtml(c.p.x)}: ${escapeHtml(formatValue(c.p.y))}${c.p.extra ? ' · ' + escapeHtml(c.p.extra) : ''}"></circle>`,
    )
    .join('');

  const labelIdxs =
    points.length <= 6 ? coords.map((_, i) => i) : [0, Math.floor((coords.length - 1) / 2), coords.length - 1];
  const xLabels = labelIdxs
    .map((i) => `<text x="${coords[i].x.toFixed(1)}" y="${height - 8}" text-anchor="middle" class="chart-axis-label">${escapeHtml(points[i].x)}</text>`)
    .join('');

  return `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="line-chart">
      <line x1="${padding}" y1="${baseY}" x2="${width - padding}" y2="${baseY}" class="chart-baseline"></line>
      <path d="${areaPath}" fill="${color}" opacity="0.12" stroke="none"></path>
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      ${dots}
      ${xLabels}
    </svg>
  `;
}

/** Two side-by-side mini bars per row — for comparing two measures per category,
 * e.g. dispatched vs returned quantity per product. */
export function renderGroupedBars(
  rows: { label: string; a: number; b: number }[],
  opts: { aLabel: string; bLabel: string; aColor: string; bColor: string; formatValue: (n: number) => string },
): string {
  if (rows.length === 0) return '<p class="muted">No data.</p>';
  const max = Math.max(...rows.flatMap((r) => [r.a, r.b]), 1);

  const body = rows
    .map(
      (r) => `
        <div class="grouped-bar-row">
          <div class="grouped-bar-label">${escapeHtml(r.label)}</div>
          <div class="grouped-bar-tracks">
            <div class="mini-bar-track">
              <div class="mini-bar-fill" style="width:${Math.max(2, (r.a / max) * 100)}%; background:${opts.aColor}" data-tooltip="${escapeHtml(r.label)} — ${escapeHtml(opts.aLabel)}: ${escapeHtml(opts.formatValue(r.a))}"></div>
            </div>
            <div class="mini-bar-track">
              <div class="mini-bar-fill" style="width:${Math.max(2, (r.b / max) * 100)}%; background:${opts.bColor}" data-tooltip="${escapeHtml(r.label)} — ${escapeHtml(opts.bLabel)}: ${escapeHtml(opts.formatValue(r.b))}"></div>
            </div>
          </div>
        </div>
      `,
    )
    .join('');

  return `
    <div class="grouped-bars">
      ${body}
      <div class="chart-legend inline">
        <span><span class="legend-dot" style="background:${opts.aColor}"></span>${escapeHtml(opts.aLabel)}</span>
        <span><span class="legend-dot" style="background:${opts.bColor}"></span>${escapeHtml(opts.bLabel)}</span>
      </div>
    </div>
  `;
}
