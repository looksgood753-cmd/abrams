/**
 * app.js — 舞台、可悬停部件、过渡、路由、时间轴、debug。
 *
 * 三条铁律在这里落地：
 *  1. 配准只写内层 <g class="registration"> 的 transform 属性；
 *     动画只写外层 .vehicle 的 CSS opacity。任何元素不同时碰两者。
 *  2. opacity / visibility 只挂在 .vehicle、.leader-layer、.label-layer 上，
 *     绝不碰 <defs> 里的 art，否则时间轴缩略图会跟着消失。
 *  3. 过渡全部由 CSS 类驱动；JS 只切类，并用 transitionend 收尾，
 *     没有 setTimeout 链，快速连点由浏览器自然续接。
 *
 * 交互：悬停部件时才出现引线与数据卡。命中区是素材图元的透明克隆，
 * 不是手画的矩形，所以悬停范围与车体轮廓一致。
 */

import { STAGE, BAND, VARIANTS, ORDER, MARKS } from './data.js';
import { loadAllArt } from './art.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 命中/高亮的绘制顺序：大件在下，小件在上，保证炮管、指挥塔优先于车体 */
const PAINT_ORDER = ['hull', 'era', 'engine', 'track', 'suspension', 'turret', 'rws', 'cupola', 'gun'];

const state = {
  current: null,
  first: true,
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  debug: new URLSearchParams(location.search).get('debug') === '1',
  photoMode: false,
  startPart: null,
  startPhoto: false,
};

/** 每车一份构建结果 */
const built = new Map();

const dom = {};
let activeEntry = null;
let activeHotspot = null;

/* ------------------------------------------------------------------ 小工具 */

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const fmt = (n) => String(Math.round(n * 100) / 100);
const pctX = (x) => ((x - STAGE.x) / STAGE.w) * 100;
const pctY = (y) => ((y - STAGE.y) / STAGE.h) * 100;

/* ------------------------------------------------------------------ 启动 */

boot().catch(fatal);

async function boot() {
  dom.frame = document.getElementById('stage-frame');
  dom.stage = document.getElementById('stage-svg');
  dom.defs = document.getElementById('art-defs');
  dom.vehicles = document.getElementById('vehicles');
  dom.leaders = document.getElementById('leaders');
  dom.debugLayer = document.getElementById('debug-layer');
  dom.labels = document.getElementById('labels-layer');
  dom.measure = document.getElementById('measure');
  dom.wrap = document.querySelector('.stage-wrap');
  dom.year = document.getElementById('meta-year');
  dom.name = document.getElementById('meta-name');
  dom.note = document.getElementById('meta-note');
  dom.brief = document.getElementById('brief-text');
  dom.delta = document.getElementById('delta-list');
  dom.timeline = document.getElementById('timeline');
  dom.track = document.getElementById('timeline-track');
  dom.debugBadge = document.getElementById('debug-badge');
  dom.backdrop = document.getElementById('backdrop');
  dom.backdropSharp = document.getElementById('backdrop-sharp');
  dom.photoToggle = document.getElementById('photo-toggle');

  const params = readParams();
  if (params.get('dump') === '1') {
    renderDump();
    return;
  }
  state.startPart = params.get('part');
  state.startPhoto = params.get('mode') === 'photo';

  if (state.debug) document.documentElement.dataset.debug = '1';
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    state.reduced = e.matches;
  });

  await loadAllArt(VARIANTS, { defsHost: dom.defs, measureHost: dom.measure });

  buildVehicles();
  buildParts();
  buildTimeline();
  document.getElementById('route-list').textContent = ORDER.map((id) => `#/${id}`).join(' · ');
  buildBackdrop();
  buildDebug();

  layoutStage();
  layoutParts();
  renderRoute(true);
  if (state.startPhoto) setPhotoMode(true);
  if (state.startPart) openPartByKey(state.current, state.startPart);

  window.addEventListener('hashchange', () => renderRoute(false));
  window.addEventListener('resize', onResize);
  new ResizeObserver(onResize).observe(dom.wrap);
  dom.timeline.addEventListener('keydown', onTimelineKeydown);
  dom.timeline.addEventListener('click', onTimelineClick);
  dom.photoToggle.addEventListener('click', onPhotoToggle);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.photoMode) setPhotoMode(false);
  });

  dom.stage.addEventListener('pointermove', onPointerMove);
  dom.stage.addEventListener('pointerdown', onPointerMove);
  dom.stage.addEventListener('pointerleave', () => closeAll());
  dom.stage.addEventListener('pointercancel', () => closeAll());

  window.__abrams = { STAGE, BAND, VARIANTS, ORDER, MARKS, built, route: () => state.current };
}


/** ?part= / ?mode= / ?dump= 同时支持写在 search 和 #/m1?part=gun 里 */
function readParams() {
  const params = new URLSearchParams(location.search);
  const hash = location.hash;
  const q = hash.indexOf('?');
  if (q >= 0) {
    const hp = new URLSearchParams(hash.slice(q + 1));
    for (const [key, value] of hp) if (!params.has(key)) params.set(key, value);
  }
  return params;
}


/* ------------------------------------------------------------------ 机器可读导出 */

function renderDump() {
  const data = {
    site: '艾布拉姆斯型号演进',
    about: '七型号侧视对照。内容为静态数据；交互状态可以用 URL 参数直接打开。',
    urls: {
      part: '?part=<部件 key>#/<型号 id>',
      photoMode: '?mode=photo#/<型号 id>',
      debug: '?debug=1#/<型号 id>',
      dump: '?dump=1',
    },
    order: [...ORDER],
    variants: ORDER.map((id) => {
      const v = VARIANTS[id];
      return {
        id,
        name: v.name,
        year: v.year,
        note: v.note,
        brief: v.brief,
        delta: v.delta,
        parts: v.parts.map((part) => ({
          key: part.key,
          name: part.name,
          tag: part.tag || null,
          band: part.band,
          rows: part.rows,
        })),
      };
    }),
  };

  document.title = 'dump · 艾布拉姆斯型号演进';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(data, null, 2);
  document.body.textContent = '';
  document.body.appendChild(pre);
  document.body.classList.add('dump');
}

function fatal(error) {
  console.error(error);
  const box = document.createElement('div');
  box.style.cssText =
    'position:absolute;inset:0;display:grid;place-items:center;padding:32px;text-align:center;' +
    'font-size:14px;color:#252d2a;background:#b1b99f;white-space:pre-wrap;z-index:10;';
  box.textContent =
    `素材没能加载或解析：\n${error && error.message ? error.message : error}\n\n` +
    '请用 python -m http.server 打开本页（file:// 会拦截 ES Modules 与 fetch）。';
  dom.frame.appendChild(box);
}

/* ------------------------------------------------------------------ 车辆 */

function buildVehicles() {
  for (const id of ORDER) {
    const v = VARIANTS[id];
    const transform = `translate(${v.reg.tx},${v.reg.ty}) scale(${v.reg.s})`;

    const vehicle = svg('g', { class: 'vehicle', 'data-variant': id, 'aria-hidden': 'true' });

    const reg = svg('g', { class: 'registration', transform });
    reg.appendChild(svg('use', { href: `#art-${id}` }));

    // 命中层与配准层同一个 transform，但它是独立元素，不参与任何 CSS transform
    const hotspots = svg('g', { class: 'hotspots', transform, 'data-variant': id });

    vehicle.append(reg, hotspots);
    dom.vehicles.appendChild(vehicle);

    const leaderLayer = svg('g', { class: 'leader-layer', 'data-variant': id, 'aria-hidden': 'true' });
    dom.leaders.appendChild(leaderLayer);

    const labelLayer = h('div', 'label-layer');
    labelLayer.dataset.variant = id;
    labelLayer.setAttribute('aria-hidden', 'true');
    dom.labels.appendChild(labelLayer);

    built.set(id, { id, vehicle, reg, hotspotLayer: hotspots, leaderLayer, labelLayer, parts: [], openKey: null });

    vehicle.addEventListener('transitionend', (event) => {
      if (event.target !== vehicle || event.propertyName !== 'opacity') return;
      const entry = built.get(id);
      const active = state.current === id;
      if (vehicle.classList.contains('is-entering')) {
        vehicle.classList.remove('is-entering');
        vehicle.classList.add('is-shown');
      } else if (vehicle.classList.contains('is-leaving')) {
        vehicle.classList.remove('is-leaving');
      }
      setMode(entry.labelLayer, active ? 'is-shown' : '');
      setMode(entry.leaderLayer, active ? 'is-shown' : '');
    });
  }
}

/* ------------------------------------------------------------------ 部件 */

function buildParts() {
  for (const id of ORDER) {
    const v = VARIANTS[id];
    const entry = built.get(id);

    for (const key of PAINT_ORDER) {
      const spec = v.parts.find((p) => p.key === key);
      if (!spec) continue;

      const anchor = resolveAnchor(v, spec);
      if (!anchor) {
        console.warn(`[${id}] 跳过部件「${spec.name}」：素材里找不到命中图元`);
        continue;
      }

      const group = createHotspotGroup(v, spec);
      if (!group) {
        console.warn(`[${id}] 跳过部件「${spec.name}」：没有可用命中区`);
        continue;
      }
      entry.hotspotLayer.appendChild(group);

      const card = createCard(spec);
      entry.labelLayer.appendChild(card);

      const leader = svg('polyline', {
        class: 'part-leader',
        fill: 'none',
        'vector-effect': 'non-scaling-stroke',
      });
      const dot = svg('circle', { class: 'part-dot', r: 2.6 });
      entry.leaderLayer.append(leader, dot);

      const part = {
        key: spec.key,
        spec,
        anchor,
        band: spec.band,
        pctRaw: pctX(anchor.x),
        group,
        card,
        leader,
        dot,
      };
      entry.parts.push(part);

      group.addEventListener('focus', () => openPart(entry, part));
      group.addEventListener('blur', () => {
        if (entry.openKey === part.key) closeAll(entry);
      });
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (entry.openKey === part.key) closeAll(entry);
          else openPart(entry, part);
        }
      });
    }
  }
}

/** 舞台坐标锚点：内部结构用热区，其余用素材 bbox 并集 */
function resolveAnchor(v, spec) {
  if (spec.zone) {
    const z = spec.zone;
    return { x: z.x + z.w / 2, y: spec.band === 'top' ? z.y : z.y + z.h };
  }

  let box = null;
  const ids = spec.anchor || spec.hits;
  for (const targetId of ids) {
    const b = v.bbox && v.bbox.get(targetId);
    if (!b) continue;
    box = box
      ? {
          x0: Math.min(box.x0, b.x),
          y0: Math.min(box.y0, b.y),
          x1: Math.max(box.x1, b.x + b.w),
          y1: Math.max(box.y1, b.y + b.h),
        }
      : { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h };
  }
  if (!box) return null;

  const localX = (box.x0 + box.x1) / 2;
  const localY = spec.band === 'top' ? box.y0 : box.y1;
  return {
    x: localX * v.reg.s + v.reg.tx,
    y: localY * v.reg.s + v.reg.ty,
  };
}

/** 命中区 = 素材图元的透明克隆；内部结构用舞台坐标热区 */
function createHotspotGroup(v, spec) {
  const group = svg('g', { class: 'hotspot', 'data-part': spec.key, 'data-variant': v.id });
  // 让键盘和读屏/AI 都能枚举部件：可聚焦 + 自带数据摘要
  const head = [v.name, spec.name, spec.tag].filter(Boolean).join(' ');
  const rows = spec.rows.map(([term, value]) => `${term} ${value}`).join('；');
  group.setAttribute('role', 'button');
  group.setAttribute('tabindex', '0');
  group.setAttribute('aria-label', `${head}：${rows}`);
  let count = 0;

  if (spec.zone) {
    const z = spec.zone;
    group.appendChild(
      svg('rect', {
        class: 'hit-shape hit-zone',
        x: fmt((z.x - v.reg.tx) / v.reg.s),
        y: fmt((z.y - v.reg.ty) / v.reg.s),
        width: fmt(z.w / v.reg.s),
        height: fmt(z.h / v.reg.s),
      }),
    );
    count += 1;
  } else {
    for (const hitId of spec.hits) {
      const source = document.getElementById(`${v.prefix}--${hitId}`);
      if (!source) continue;
      const clone = document.importNode(source, true);
      clone.removeAttribute('id');
      clone.setAttribute('class', 'hit-shape');
      group.appendChild(clone);
      count += 1;
    }
  }

  return count ? group : null;
}

function createCard(spec) {
  const card = h('div', 'part-card');
  card.dataset.part = spec.key;

  const title = h('p', 'part-card-title');
  title.appendChild(h('span', 'part-name', spec.name));
  if (spec.tag) title.appendChild(h('span', 'part-tag', spec.tag));

  const rows = h('dl', 'part-rows');
  for (const [term, value] of spec.rows) {
    const row = h('div', 'part-row');
    row.append(h('dt', null, term), h('dd', null, value));
    rows.appendChild(row);
  }

  card.append(title, rows);
  return card;
}

/* ------------------------------------------------------------------ 悬停 */

function onPointerMove(event) {
  const target = event.target;
  const hotspot = target instanceof Element ? target.closest('.hotspot') : null;

  if (!hotspot) {
    closeAll();
    return;
  }
  if (hotspot === activeHotspot) return;

  const entry = built.get(hotspot.dataset.variant);
  const part = entry && entry.parts.find((p) => p.group === hotspot);
  if (!entry || !part) return;

  if (activeEntry && activeEntry !== entry) closeAll(activeEntry);
  activeHotspot = hotspot;
  activeEntry = entry;
  openPart(entry, part);
}

function openPartByKey(id, key) {
  const entry = built.get(id);
  if (!entry) return;
  const part = entry.parts.find((p) => p.key === key);
  if (!part) {
    console.warn(`[${id}] 没有部件 ${key}`);
    return;
  }
  activeEntry = entry;
  activeHotspot = part.group;
  openPart(entry, part);
}

function openPart(entry, part) {
  if (entry.openKey === part.key) return;
  entry.openKey = part.key;
  for (const p of entry.parts) setOpen(p, p.key === part.key);
}

function closeAll(entry = activeEntry) {
  if (!entry) return;
  entry.openKey = null;
  for (const p of entry.parts) setOpen(p, false);
  if (activeEntry === entry) {
    activeEntry = null;
    activeHotspot = null;
  }
}

function setOpen(part, open) {
  part.group.classList.toggle('is-open', open);
  part.card.classList.toggle('is-open', open);
  part.leader.classList.toggle('is-open', open);
  part.dot.classList.toggle('is-open', open);
}


/* ------------------------------------------------------------------ 背景照片 */

/** 每个有照片的车型两层：磨砂层（常态背景）与清晰层（纯照片模式） */
function buildBackdrop() {
  for (const id of ORDER) {
    const v = VARIANTS[id];
    if (!v.photo) continue;

    const blurred = h('div', 'backdrop-layer');
    blurred.dataset.variant = id;
    dom.backdrop.appendChild(blurred);

    const sharp = h('div', 'backdrop-layer backdrop-layer--sharp');
    sharp.dataset.variant = id;
    dom.backdropSharp.appendChild(sharp);

    built.get(id).photoLayer = blurred;
    built.get(id).sharpLayer = sharp;
  }

  const initial = state.current || readRoute() || 'm1';
  ensurePhoto(initial);

  // 其余磨砂图等空闲再拉，不占首屏；清晰图等进纯照片模式时再按需加载
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  idle(() => {
    for (const id of ORDER) if (id !== initial) ensurePhoto(id);
  });
}

function ensurePhoto(id) {
  const v = VARIANTS[id];
  const entry = built.get(id);
  const layer = entry && entry.photoLayer;
  if (!v || !v.photo || !layer || layer.dataset.state) return;

  layer.dataset.state = 'loading';
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    layer.style.backgroundImage = `url("${v.photo}")`;
    layer.dataset.state = 'ready';
    if (state.current === id && !state.photoMode) layer.classList.add('is-shown');
  };
  img.onerror = () => {
    layer.dataset.state = 'error';
  };
  img.src = v.photo;
}

function ensureSharp(id) {
  const v = VARIANTS[id];
  const entry = built.get(id);
  const layer = entry && entry.sharpLayer;
  if (!v || !v.photoSharp || !layer || layer.dataset.state) return;

  layer.dataset.state = 'loading';
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    layer.style.backgroundImage = `url("${v.photoSharp}")`;
    layer.dataset.state = 'ready';
    if (state.current === id && state.photoMode) layer.classList.add('is-shown');
  };
  img.onerror = () => {
    layer.dataset.state = 'error';
  };
  img.src = v.photoSharp;
}

function applyBackdrop(id) {
  ensurePhoto(id);
  if (state.photoMode) ensureSharp(id);
  for (const key of ORDER) {
    const entry = built.get(key);
    if (!entry) continue;
    const active = key === id;
    if (entry.photoLayer) entry.photoLayer.classList.toggle('is-shown', active && !state.photoMode);
    if (entry.sharpLayer) entry.sharpLayer.classList.toggle('is-shown', active && state.photoMode);
  }
}

function setPhotoMode(on) {
  state.photoMode = on;
  document.body.classList.toggle('is-photo', on);
  dom.photoToggle.setAttribute('aria-pressed', String(on));
  applyBackdrop(state.current);
}

function onPhotoToggle() {
  setPhotoMode(!state.photoMode);
}

/* ------------------------------------------------------------------ 布局 */

function layoutStage() {
  if (!dom.wrap || !dom.frame) return;
  const cs = getComputedStyle(dom.wrap);
  const availW = dom.wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const availH = dom.wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  if (availW < 32 || availH < 32) return;
  const aspect = STAGE.w / STAGE.h;
  const width = Math.max(320, Math.min(availW, availH * aspect, 1520));
  dom.frame.style.width = `${Math.floor(width)}px`;
}

function layoutParts() {
  const rect = dom.frame.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return;

  for (const id of ORDER) {
    for (const part of built.get(id).parts) {
      // 先按锚点百分比摆，再按实测宽度钳制，保证不越出舞台
      part.card.style.left = `${part.pctRaw}%`;
      const width = part.card.offsetWidth;
      const halfPct = (width / 2 / rect.width) * 100;
      const lo = halfPct + 0.35;
      const hi = 100 - halfPct - 0.35;
      const pct = lo <= hi ? Math.min(Math.max(part.pctRaw, lo), hi) : 50;
      part.card.style.left = `${pct}%`;

      const cardX = STAGE.x + (pct / 100) * STAGE.w;
      const hUnits = (part.card.offsetHeight / rect.height) * STAGE.h;
      const stageBottom = STAGE.y + STAGE.h;
      let topUnits;

      if (part.band === 'top') {
        topUnits = -BAND.gap - hUnits;
        if (topUnits < STAGE.y + 4) topUnits = STAGE.y + 4;
      } else {
        topUnits = STAGE.artH + BAND.gap;
        if (topUnits + hUnits > stageBottom - 4) topUnits = stageBottom - 4 - hUnits;
      }
      part.card.style.top = `${pctY(topUnits)}%`;

      // 引线：锚点 → 竖直到 rail → 横移到卡片 x → 短竖直到卡片边缘
      const nearEdge = part.band === 'top' ? topUnits + hUnits : topUnits;
      const dir = part.band === 'top' ? 1 : -1;
      const edgeY = nearEdge + dir * 3;
      const railY = nearEdge + dir * 14;
      part.leader.setAttribute(
        'points',
        `${fmt(part.anchor.x)},${fmt(part.anchor.y)} ` +
          `${fmt(part.anchor.x)},${fmt(railY)} ` +
          `${fmt(cardX)},${fmt(railY)} ` +
          `${fmt(cardX)},${fmt(edgeY)}`,
      );
      part.dot.setAttribute('cx', fmt(part.anchor.x));
      part.dot.setAttribute('cy', fmt(part.anchor.y));
    }
  }
}

let resizeRaf = 0;
function onResize() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    layoutStage();
    layoutParts();
  });
}

/* ------------------------------------------------------------------ 时间轴 */

function buildTimeline() {
  for (const id of ORDER) {
    const v = VARIANTS[id];
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'milestone';
    link.href = `#/${id}`;
    link.dataset.variant = id;

    const thumb = h('span', 'thumb');
    const tsvg = svg('svg', {
      viewBox: `0 0 ${v.art.w} ${v.art.h}`,
      'aria-hidden': 'true',
      focusable: 'false',
    });
    tsvg.appendChild(svg('use', { href: `#art-${id}` }));
    thumb.appendChild(tsvg);

    const meta = h('span', 'milestone-meta');
    meta.append(h('span', 'milestone-year', String(v.year)), h('span', 'milestone-name', v.name));

    link.append(thumb, meta);
    li.appendChild(link);
    dom.track.appendChild(li);
  }
}

function onTimelineClick(event) {
  const link = event.target.closest ? event.target.closest('.milestone') : null;
  if (!link) return;
  // 只接管普通左键：新标签页/新窗口留给浏览器
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const id = link.dataset.variant;
  if (location.hash !== `#/${id}`) location.hash = `#/${id}`;
  // 同步切换，不等 hashchange（hashchange 会因 state.current 相同而直接返回）
  renderRoute(false);
}

function onTimelineKeydown(event) {
  const keys = new Set(['ArrowRight', 'ArrowLeft', 'Home', 'End']);
  if (!keys.has(event.key)) return;

  const items = Array.from(dom.timeline.querySelectorAll('.milestone'));
  if (!items.length) return;

  const index = items.indexOf(document.activeElement);
  let next = index;
  if (event.key === 'ArrowRight') next = index < 0 ? 0 : (index + 1) % items.length;
  else if (event.key === 'ArrowLeft') next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
  else if (event.key === 'Home') next = 0;
  else next = items.length - 1;

  event.preventDefault();
  items[next].focus();
  items[next].click();
}

/* ------------------------------------------------------------------ 路由与过渡 */

const ROUTE_RE = new RegExp(`^#\/(${ORDER.join('|')})\/?$`);

function readRoute() {
  const match = ROUTE_RE.exec(location.hash);
  return match ? match[1] : null;
}

function renderRoute(initial) {
  let id = readRoute();
  if (!id) {
    id = 'm1';
    history.replaceState(null, '', '#/m1');
  }
  if (state.current === id && !initial) return;

  const v = VARIANTS[id];
  state.current = id;
  document.documentElement.dataset.variant = id;
  document.title = `${v.name} · 艾布拉姆斯型号演进`;

  dom.year.textContent = String(v.year);
  dom.name.textContent = v.name;
  dom.note.textContent = v.note;
  dom.brief.textContent = v.brief;
  dom.delta.replaceChildren(...v.delta.map((text) => h('li', null, text)));

  const instant = Boolean(initial) || state.first || state.reduced;
  applyBackdrop(id);

  for (const link of dom.timeline.querySelectorAll('.milestone')) {
    if (link.dataset.variant === id) {
      link.setAttribute('aria-current', 'page');
      scrollTimelineTo(link, instant);
    } else link.removeAttribute('aria-current');
  }

  for (const key of ORDER) closeAll(built.get(key));
  activeEntry = null;
  activeHotspot = null;

  applyLayers(id, instant);
  updateDebugActive(id);
  state.first = false;
}


function scrollTimelineTo(link, instant) {
  const track = dom.timeline;
  if (track.scrollWidth <= track.clientWidth + 1) return;
  const target = link.offsetLeft - (track.clientWidth - link.offsetWidth) / 2;
  track.scrollTo({ left: Math.max(0, target), behavior: instant ? 'auto' : 'smooth' });
}

function setMode(el, mode) {
  el.classList.remove('is-shown', 'is-entering', 'is-leaving');
  if (mode) el.classList.add(mode);
}

function applyLayers(nextId, instant) {
  for (const id of ORDER) {
    const entry = built.get(id);
    const isNext = id === nextId;
    for (const el of [entry.vehicle, entry.leaderLayer, entry.labelLayer]) {
      if (instant) {
        setMode(el, isNext ? 'is-shown' : '');
        continue;
      }
      const busy =
        el.classList.contains('is-shown') ||
        el.classList.contains('is-entering') ||
        el.classList.contains('is-leaving');
      if (isNext) setMode(el, 'is-entering');
      else if (busy) {
        // 完全透明时再挂 is-leaving 不会产生 transition（起止值相同 → 没有 transitionend），
        // 会把它永远留在 visibility:visible 上。直接归位。
        const opacity = el === entry.vehicle ? Number.parseFloat(getComputedStyle(el).opacity) : 1;
        setMode(el, opacity <= 0.001 ? '' : 'is-leaving');
      } else setMode(el, '');
    }
    entry.vehicle.setAttribute('aria-hidden', isNext ? 'false' : 'true');
    entry.labelLayer.setAttribute('aria-hidden', isNext ? 'false' : 'true');
  }
}

/* ------------------------------------------------------------------ Debug */

function buildDebug() {
  if (!state.debug) return;
  dom.debugBadge.hidden = false;

  const layer = dom.debugLayer;

  // 100 单位网格
  const grid = [];
  for (let x = 0; x <= 1600; x += MARKS.gridStep) grid.push(`M${x} -140 L${x} 746`);
  for (let y = -100; y <= 700; y += MARKS.gridStep) grid.push(`M0 ${y} L1681 ${y}`);
  layer.appendChild(svg('path', { class: 'dbg-grid', d: grid.join(' ') }));

  // 车体本体上下界
  layer.appendChild(svg('path', { class: 'dbg-bounds', d: 'M0 0 H1681 M0 606 H1681' }));

  // 配准基准线：1 号 / 7 号负重轮中心
  layer.appendChild(
    svg('path', {
      class: 'dbg-rail',
      d: `M${MARKS.wheel1X} -140 V746 M${MARKS.wheel7X} -140 V746`,
    }),
  );

  // 每车：配准后的素材包围盒 + 锚点十字 + 内部结构热区
  for (const id of ORDER) {
    const v = VARIANTS[id];
    const entry = built.get(id);
    const group = svg('g', { class: 'dbg-variant', 'data-variant': id, 'data-active': 'false' });

    if (v.artBox) {
      const x = v.artBox.x * v.reg.s + v.reg.tx;
      const y = v.artBox.y * v.reg.s + v.reg.ty;
      group.appendChild(
        svg('rect', {
          class: 'dbg-bbox',
          x: fmt(x),
          y: fmt(y),
          width: fmt(v.artBox.w * v.reg.s),
          height: fmt(v.artBox.h * v.reg.s),
        }),
      );
    }

    for (const part of entry.parts) {
      group.appendChild(
        svg('path', {
          class: 'dbg-anchor',
          d: `M${fmt(part.anchor.x - 8)} ${fmt(part.anchor.y)} H${fmt(part.anchor.x + 8)} ` +
            `M${fmt(part.anchor.x)} ${fmt(part.anchor.y - 8)} V${fmt(part.anchor.y + 8)}`,
        }),
      );
      if (part.spec.zone) {
        const z = part.spec.zone;
        group.appendChild(
          svg('rect', { class: 'dbg-zone', x: fmt(z.x), y: fmt(z.y), width: fmt(z.w), height: fmt(z.h) }),
        );
      }
    }
    layer.appendChild(group);
  }
}

function updateDebugActive(id) {
  if (!state.debug) return;
  for (const group of dom.debugLayer.querySelectorAll('.dbg-variant')) {
    group.dataset.active = group.dataset.variant === id ? 'true' : 'false';
  }
}
