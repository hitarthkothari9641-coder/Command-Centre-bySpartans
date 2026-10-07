import { esc } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

/**
 * StatCard — animated count-up metric tile.
 * @param {{label: string, value: string|number, meta?: string, icon?: string,
 *          tone?: 'cyan'|'gold'|'crimson'|'emerald'|'violet', countKey: string,
 *          raw?: boolean, index?: number}} options
 */
export function StatCard({
  label,
  value,
  meta = '',
  icon: iconName = 'gauge',
  tone = 'cyan',
  countKey,
  raw = false,
  index = 0,
  spark = [],
}) {
  const numeric = !raw && typeof value === 'number';
  return `
    <article class="stat glass" data-tone="${tone}" style="--i:${index}">
      <div class="stat__top">
        <span class="stat__icon">${icon(iconName, 14)}</span>
        <span class="stat__label">${esc(label)}</span>
      </div>
      ${
        numeric
          ? `<div class="stat__value" data-count-to="${value}" data-count-key="${esc(countKey || label)}">${value}</div>`
          : `<div class="stat__value">${esc(String(value))}</div>`
      }
      ${meta ? `<div class="stat__meta">${esc(meta)}</div>` : ''}
      ${
        spark.length
          ? `<div class="stat__spark"><div class="spark">${spark
              .map((v) => `<i style="height:${Math.max(12, Math.min(100, v))}%"></i>`)
              .join('')}</div></div>`
          : ''
      }
    </article>
  `;
}
