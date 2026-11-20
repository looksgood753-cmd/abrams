/**
 * art.js — 素材加载与注入。
 *
 * 规则：
 *  1. 用 DOMParser 解析，只取 svg > g（不能要整个 <svg>，嵌套 viewport 会二次缩放）。
 *  2. 各车型素材的 id 有大量重名，统一前缀化为 "<prefix>--<id>"，url(#…) 一并改写。
 *  3. 注入主 <svg><defs> 之前先临时挂到 measure 容器里量 getBBox；
 *     量完再挪进 defs。绝不给 defs 里的图元加 vector-effect。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {Record<string, any>} variants
 * @param {{ defsHost: SVGDefsElement, measureHost: SVGSVGElement }} hosts
 */
export async function loadAllArt(variants, hosts) {
  for (const id of Object.keys(variants)) {
    const v = variants[id];
    const res = await fetch(v.file, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`素材加载失败 ${v.file}：HTTP ${res.status}`);
    }
    const source = await res.text();
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (doc.querySelector('parsererror')) {
      throw new Error(`素材解析失败 ${v.file}：XML 结构错误`);
    }
    const root = doc.documentElement;
    if (!root || root.localName !== 'svg') {
      throw new Error(`素材解析失败 ${v.file}：根节点不是 <svg>`);
    }

    // 只取直接子级 <g id="…-structure">
    let struct = null;
    for (const child of root.children) {
      if (child.localName === 'g') { struct = child; break; }
    }
    if (!struct) throw new Error(`素材结构异常 ${v.file}：找不到 <svg> 下的 <g>`);
    if (struct.getAttribute('id') !== v.structId) {
      console.warn(`[art] ${v.file} 的根 g id 是 "${struct.getAttribute('id')}"，预期 "${v.structId}"`);
    }

    // 结构自检：所有 path/circle 必须都在这个 g 里，否则导入会静默丢图元
    const total = root.querySelectorAll('path, circle').length;
    const inside = struct.querySelectorAll('path, circle').length;
    if (total !== inside) {
      throw new Error(`素材结构异常 ${v.file}：${total - inside} 个图元在 <g> 之外`);
    }

    const imported = document.importNode(struct, true);
    prefixIds(imported, v.prefix);

    // 量 bbox：先挂进 measure 容器（真实渲染、但不可见），量完再移走
    hosts.measureHost.appendChild(imported);
    v.bbox = measureGeometry(imported, v.prefix);
    v.artBox = unionAll(v.bbox);
    hosts.measureHost.removeChild(imported);

    if (v.bbox.size === 0) {
      throw new Error(`素材结构异常 ${v.file}：量不到任何图元包围盒`);
    }

    const wrap = document.createElementNS(SVG_NS, 'g');
    wrap.setAttribute('id', `art-${v.id}`);
    wrap.appendChild(imported);
    hosts.defsHost.appendChild(wrap);

    v.imported = imported;
    v.ids = Array.from(imported.querySelectorAll('[id]')).map((el) => el.getAttribute('id'));
  }
}

/** 统一前缀化所有 id，并把 url(#…) / href="#…" 的引用一起改掉 */
function prefixIds(root, prefix) {
  const nodes = [root, ...root.querySelectorAll('[id]')];
  const rename = new Map();

  for (const el of nodes) {
    const oldId = el.getAttribute('id');
    if (oldId) rename.set(oldId, `${prefix}--${oldId}`);
  }
  for (const [oldId, newId] of rename) {
    for (const el of nodes) {
      if (el.getAttribute('id') === oldId) el.setAttribute('id', newId);
    }
  }

  for (const el of nodes) {
    for (const attr of Array.from(el.attributes)) {
      const value = attr.value;
      if (!value.includes('#')) continue;
      let next = value.replace(/url\(\s*#([^)\s]+)\s*\)/g, (m, ref) => {
        return `url(#${rename.get(ref) || ref})`;
      });
      if ((attr.name === 'href' || attr.name === 'xlink:href') && next.startsWith('#')) {
        const ref = next.slice(1);
        next = `#${rename.get(ref) || ref}`;
      }
      if (next !== value) el.setAttribute(attr.name, next);
    }
  }
}

/** 返回 Map<短 id, {x,y,w,h}>，短 id 即素材里的原始局部 id */
function measureGeometry(root, prefix) {
  const out = new Map();
  const short = (id) => (id.startsWith(`${prefix}--`) ? id.slice(prefix.length + 2) : id);
  for (const el of root.querySelectorAll('[id]')) {
    if (el.localName === 'g') continue;
    const id = short(el.getAttribute('id'));
    const box = bboxOf(el);
    if (!box || (box.w === 0 && box.h === 0)) continue;
    out.set(id, box);
  }
  return out;
}

function bboxOf(el) {
  try {
    const b = el.getBBox();
    if (b && (b.width > 0 || b.height > 0)) {
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    }
  } catch {
    /* 极个别引擎对未渲染节点会抛错，走下面的兜底 */
  }
  return fallbackBBox(el);
}

/** 兜底：素材只有 M/L/Z 与 circle，直接读坐标即可，不依赖渲染 */
function fallbackBBox(el) {
  if (el.localName === 'circle') {
    const cx = Number(el.getAttribute('cx'));
    const cy = Number(el.getAttribute('cy'));
    const r = Number(el.getAttribute('r'));
    if (![cx, cy, r].every(Number.isFinite)) return null;
    return { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
  }
  if (el.localName === 'path') {
    const d = el.getAttribute('d') || '';
    const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
    if (!nums || nums.length < 2) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = Number(nums[i]);
      const y = Number(nums[i + 1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    if (!Number.isFinite(x0)) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  return null;
}

function unionAll(map) {
  let box = null;
  for (const b of map.values()) {
    box = box
      ? {
          x: Math.min(box.x, b.x),
          y: Math.min(box.y, b.y),
          x1: Math.max(box.x1, b.x + b.w),
          y1: Math.max(box.y1, b.y + b.h),
        }
      : { x: b.x, y: b.y, x1: b.x + b.w, y1: b.y + b.h };
  }
  if (!box) return null;
  return { x: box.x, y: box.y, w: box.x1 - box.x, h: box.y1 - box.y };
}
