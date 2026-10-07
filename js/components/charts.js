/**
 * Chart primitives — dependency-free inline SVG.
 *
 * Every chart is a real `<figure>` with a `role="img"` and a text summary in
 * `aria-label`, so the analytics view is usable with a screen reader and in the
 * test suite without any canvas or charting library.
 */
import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

let chartSeq = 0;
const nextId = () => `chart${++chartSeq}`;

const TONES = {
  cyan: { stroke: '#22d3ee', soft: 'rgba(34,211,238,.22)' },
  violet: { stroke: '#8b5cf6', soft: 'rgba(139,92,246,.22)' },
  crimson: { stroke: '#ef4444', soft: 'rgba(239,68,68,.22)' },
  amber: { stroke: '#f59e0b', soft: 'rgba(245,158,11,.22)' },
  emerald: { stroke: '#10b981', soft: 'rgba(16,185,129,.22)' },
  gold: { stroke: '#facc15', soft: 'rgba(250,204,21,.22)' },
};
const toneOf = (name) => TONES[name] || TONES.cyan;

const num = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });

/** A chart shell: figure + caption + the text summary screen readers get. */
function frame({ kind, label, summary, body, note = '' }) {
  return `
    <figure class="chart" data-chart="${esc(kind)}">
      <div class="chart__canvas">${body}</div>
      <figcaption class="chart__caption">
        <span class="chart__legend">${esc(label)}</span>
        ${note ? `<span class="chart__note">${esc(note)}</span>` : ''}
        <span class="chart__summary">${esc(summary)}</span>
      </figcaption>
    </figure>
  `;
}

/**
 * Line + area chart with min/max/grid guides.
 * @param {number[]} values
 * @param {{tone?: string, height?: number, label: string, summary?: string, format?: (v:number)=>string, note?: string}} options
 */
export function AreaChart(values, { tone = 'cyan', height = 62, label, summary, format = num, note = '', markers = [] } = {}) {
  const series = values.length ? values : [0, 0];
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const step = 100 / Math.max(1, series.length - 1);
  const y = (value) => 38 - ((value - min) / span) * 32;

  const points = series.map((value, index) => [index * step, y(value)]);
  const line = points.map(([px, py], index) => `${index ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)}`).join(' ');
  const area = `${line} L100 40 L0 40 Z`;
  const id = nextId();
  const { stroke, soft } = toneOf(tone);

  const body = `
    <svg class="chart__svg" viewBox="0 0 100 40" preserveAspectRatio="none" style="height:${height}px" role="img"
      aria-label="${esc(summary || label)}">
      <title>${esc(label)}</title>
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity=".42" />
          <stop offset="100%" stop-color="${stroke}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line class="chart__grid" x1="0" y1="38" x2="100" y2="38" />
      <line class="chart__grid" x1="0" y1="22" x2="100" y2="22" />
      <line class="chart__grid" x1="0" y1="6" x2="100" y2="6" />
      <path d="${area}" fill="url(#${id})" stroke="none" />
      <path d="${line}" fill="none" stroke="${stroke}" stroke-width="1.6" vector-effect="non-scaling-stroke"
        stroke-linejoin="round" stroke-linecap="round" />
      ${points
        .map(([px, py], index) =>
          markers.includes(index)
            ? `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="1.6" fill="${soft}" stroke="${stroke}" stroke-width="1.2" vector-effect="non-scaling-stroke" />`
            : '',
        )
        .join('')}
    </svg>
    <div class="chart__axis"><span>${esc(format(min))}</span><span>${esc(format(max))}</span></div>
  `;

  return frame({ kind: 'area', label, summary: summary || `${label}: min ${format(min)}, max ${format(max)}`, body, note });
}

/**
 * Horizontal bar list — one row per category. Reads better than a vertical
 * chart on a dashboard full of narrow cards.
 */
export function BarChart(rows, { tone = 'cyan', label, summary, format = num, note = '', empty = 'No data in range' } = {}) {
  if (!rows.length) {
    return frame({ kind: 'bar', label, summary: summary || label, note, body: `<p class="chart__empty">${esc(empty)}</p>` });
  }
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  const body = `
    <ul class="bars" role="img" aria-label="${esc(summary || label)}">
      ${rows
        .map(
          (row) => `
        <li class="bars__row" data-tone="${esc(row.tone || tone)}">
          <span class="bars__label">${esc(row.label)}</span>
          <span class="bars__track"><i style="width:${Math.max(2, Math.round((Math.abs(row.value) / max) * 100))}%"></i></span>
          <span class="bars__value">${esc(format(row.value))}</span>
        </li>`,
        )
        .join('')}
    </ul>
  `;
  return frame({ kind: 'bar', label, summary: summary || label, body, note });
}

/** Donut with a centre label — share-of-total breakdowns. */
export function Donut(slices, { size = 138, thickness = 13, label, summary, tone = 'cyan', note = '' } = {}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 50 - thickness / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const body = `
    <div class="donut" style="--donut-size:${size}px">
      <svg viewBox="0 0 100 100" role="img" aria-label="${esc(summary || label)}">
        <title>${esc(label)}</title>
        <circle cx="50" cy="50" r="${radius}" fill="none" stroke="var(--hairline)" stroke-width="${thickness}" />
        ${slices
          .map((slice) => {
            const share = total ? slice.value / total : 0;
            const dash = `${(share * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
            const node = `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="${toneOf(slice.tone || tone).stroke}"
              stroke-width="${thickness}" stroke-dasharray="${dash}" stroke-dashoffset="${(-offset).toFixed(2)}"
              transform="rotate(-90 50 50)" stroke-linecap="butt" />`;
            offset += share * circumference;
            return node;
          })
          .join('')}
      </svg>
      <div class="donut__centre">
        <span class="donut__value">${esc(slices[0] ? slices[0].label : '—')}</span>
        <span class="donut__label">${esc(slices[0] ? `${slices[0].value} pts` : 'no data')}</span>
      </div>
    </div>
    <ul class="legend">
      ${slices
        .map(
          (slice) => `
        <li class="legend__item" data-tone="${esc(slice.tone || tone)}">
          <i class="legend__swatch"></i>
          <span class="legend__name">${esc(slice.label)}</span>
          <span class="legend__value">${esc(String(slice.value))} <em>(${total ? Math.round((slice.value / total) * 100) : 0}%)</em></span>
        </li>`,
        )
        .join('')}
    </ul>
  `;
  return frame({ kind: 'donut', label, summary: summary || label, body, note });
}

/** Tiny inline series used inside stat tiles and table rows. */
export function Sparkline(values, { tone = 'cyan', width = 96, height = 26 } = {}) {
  const series = values.length > 1 ? values : [0, ...(values.length ? values : [0])];
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const step = width / (series.length - 1);
  const d = series
    .map((value, index) => `${index ? 'L' : 'M'}${(index * step).toFixed(1)} ${(height - 3 - ((value - min) / span) * (height - 6)).toFixed(1)}`)
    .join(' ');
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${toneOf(tone).stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
  </svg>`;
}

/** A KPI tile that reuses the dashboard stat styling plus a trend chip. */
export function KpiCard({ label, value, meta = '', icon: iconName = 'gauge', tone = 'cyan', delta = null, spark = [], index = 0 }) {
  return `
    <article class="stat glass kpi" data-tone="${tone}" style="--i:${index}">
      <div class="stat__top">
        <span class="stat__icon">${icon(iconName, 14)}</span>
        <span class="stat__label">${esc(label)}</span>
        ${
          delta === null
            ? ''
            : `<span class="kpi__delta" data-sign="${delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}">
                ${icon(delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'minus', 12)}${delta > 0 ? '+' : ''}${esc(String(delta))}%
              </span>`
        }
      </div>
      <div class="stat__value">${esc(String(value))}</div>
      ${meta ? `<div class="stat__meta">${esc(meta)}</div>` : ''}
      ${spark.length ? `<div class="kpi__spark">${Sparkline(spark, { tone })}</div>` : ''}
    </article>
  `;
}
