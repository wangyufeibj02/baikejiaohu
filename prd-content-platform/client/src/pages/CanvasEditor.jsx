import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function NumInput({ value, onChange, min, max, step, className, style, placeholder }) {
  const ref = useRef(null);
  const [local, setLocal] = useState(String(value ?? ''));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setLocal(String(value ?? ''));
  }, [value, focused]);
  function commit() {
    setFocused(false);
    let v = parseFloat(local);
    if (isNaN(v)) { setLocal(String(value ?? '')); return; }
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    setLocal(String(v));
    onChange(v);
  }
  return (
    <input ref={ref} type="number" className={className} style={style} placeholder={placeholder}
      step={step} value={focused ? local : String(value ?? '')}
      onFocus={() => { setFocused(true); setLocal(String(value ?? '')); }}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { commit(); ref.current?.blur(); } }}
    />
  );
}

const DEFAULT_CANVAS_W = 1624;
const DEFAULT_CANVAS_H = 1050;
const DEFAULT_SAFE_TOP = 150;
const DEFAULT_SAFE_BOTTOM = 900;
const SNAP = 10;
const MAX_HISTORY = 50;

const ELEMENT_PRESETS = {
  back_btn:      { label: '返回按钮', w: 40, h: 30,  color: '#64748b', type: 'backBtn',      defaultX: 58,  defaultY: 80 },
  progress_bar:  { label: '进度条',   w: 240, h: 10, color: '#22c55e', type: 'progressBar',  defaultX: 440, defaultY: 78 },
  bottom_pill:   { label: '底部横条', w: 160, h: 6,  color: '#1e293b', type: 'bottomPill',   defaultX: 732, defaultY: 960 },
  rect:          { label: '矩形',     w: 200, h: 150, color: '#6366f1', type: 'rect' },
  circle:        { label: '圆形',     w: 120, h: 120, color: '#3b82f6', type: 'circle' },
  text:          { label: '文字',     w: 200, h: 50,  color: '#f59e0b', type: 'text' },
};

const FONT_OPTIONS = [
  { value: '"PingFang SC", sans-serif', label: '苹方' },
  { value: '"Microsoft YaHei", sans-serif', label: '微软雅黑' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Arial, sans-serif', label: 'Arial' },
];

function uid() { return 'ce_' + Math.random().toString(36).slice(2, 9); }

function ResizableField({ id, width, children }) {
  const key = id ? `rf_${id}` : null;
  const saved = key ? parseInt(localStorage.getItem(key)) : null;
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !key) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        if (w > 20) localStorage.setItem(key, String(w));
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [key]);
  return (
    <div ref={ref} style={{
      width: saved || width, minWidth: 36, resize: 'horizontal', overflow: 'hidden',
      flexShrink: 0, display: 'inline-block',
    }}>{children}</div>
  );
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function snapV(v, on) { return on ? Math.round(v / SNAP) * SNAP : Math.round(v); }

function hexToRgba(hex, a) {
  const c = (hex || '#999').replace('#', '');
  return `rgba(${parseInt(c.substring(0, 2), 16) || 0},${parseInt(c.substring(2, 4), 16) || 0},${parseInt(c.substring(4, 6), 16) || 0},${a})`;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

const AI = { size: 16, vb: '0 0 16 16' };
const AlignIcon = ({ d, title, onClick, disabled }) => (
  <button className="icon-btn" onClick={onClick} title={title} disabled={disabled}>
    <svg width={AI.size} height={AI.size} viewBox={AI.vb}><path d={d} fill="currentColor" /></svg>
  </button>
);

export default function CanvasEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const imgCache = useRef({});
  const fileRef = useRef(null);

  const [name, setName] = useState('新画布');
  const [canvasW, setCanvasW] = useState(DEFAULT_CANVAS_W);
  const [canvasH, setCanvasH] = useState(DEFAULT_CANVAS_H);
  const [safeTop, setSafeTop] = useState(DEFAULT_SAFE_TOP);
  const [safeBottom, setSafeBottom] = useState(DEFAULT_SAFE_BOTTOM);
  const [isDefault, setIsDefault] = useState(false);

  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tool, setTool] = useState('select');
  const [snapOn, setSnapOn] = useState(true);
  const [measureOn, setMeasureOn] = useState(true);
  const [scale, setScale] = useState(0.65);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const MIN_SCALE = 0.15;
  const MAX_SCALE = 2.5;

  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [draggingLine, setDraggingLine] = useState(null);
  const [drawStart, setDrawStart] = useState(null);
  const [marquee, setMarquee] = useState(null);

  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);

  const selEls = elements.filter(e => selectedIds.includes(e.id));
  const selected = selEls.length === 1 ? selEls[0] : null;
  const multi = selEls.length >= 2;

  function pushHistory(els) {
    setHistory(prev => {
      const next = [...prev.slice(0, histIdx + 1), JSON.parse(JSON.stringify(els))];
      if (next.length > MAX_HISTORY) next.shift();
      setHistIdx(next.length - 1);
      return next;
    });
  }

  function commitElements(els) { setElements(els); pushHistory(els); }

  function undo() {
    if (histIdx <= 0) return;
    const ni = histIdx - 1;
    setHistIdx(ni); setElements(JSON.parse(JSON.stringify(history[ni])));
  }
  function redo() {
    if (histIdx >= history.length - 1) return;
    const ni = histIdx + 1;
    setHistIdx(ni); setElements(JSON.parse(JSON.stringify(history[ni])));
  }

  const fitScaleVal = useCallback(() => {
    if (!wrapRef.current) return 0.65;
    return Math.min(0.75, (wrapRef.current.clientWidth - 40) / canvasW);
  }, []);

  function resetView() { setScale(fitScaleVal()); setPan({ x: 0, y: 0 }); }

  useEffect(() => { setScale(fitScaleVal()); }, [fitScaleVal]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function onWheel(e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = (mx - pan.x) / scale;
      const worldY = (my - pan.y) / scale;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
      setPan({ x: mx - worldX * ns, y: my - worldY * ns });
      setScale(ns);
    }
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [scale, pan]);

  useEffect(() => {
    function onDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); setSpaceHeld(true); }
    }
    function onUp(e) { if (e.code === 'Space') { setSpaceHeld(false); setPanning(null); } }
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  useEffect(() => {
    if (!id || id === 'new') {
      const defaultEls = [
        { id: uid(), type: 'backBtn', label: '返回按钮', x: 58, y: 80, w: 40, h: 30, color: '#64748b', opacity: 1, borderRadius: 0, presetKey: 'back_btn' },
        { id: uid(), type: 'progressBar', label: '进度条', x: 440, y: 78, w: 240, h: 10, color: '#22c55e', opacity: 1, borderRadius: 5, presetKey: 'progress_bar' },
        { id: uid(), type: 'bottomPill', label: '底部横条', x: 732, y: 960, w: 160, h: 6, color: '#1e293b', opacity: 1, borderRadius: 3, presetKey: 'bottom_pill' },
      ];
      setElements(defaultEls);
      pushHistory(defaultEls);
      return;
    }
    fetch(`/api/canvas-presets/${id}`).then(r => r.json()).then(d => {
      if (!d.success) return;
      const p = d.data;
      setName(p.name || '');
      setCanvasW(p.canvasWidth ?? DEFAULT_CANVAS_W);
      setCanvasH(p.canvasHeight ?? DEFAULT_CANVAS_H);
      setSafeTop(p.safeTop ?? DEFAULT_SAFE_TOP);
      setSafeBottom(p.safeBottom ?? DEFAULT_SAFE_BOTTOM);
      setIsDefault(!!p.isDefault);

      let els = p.elements || [];
      if (els.length === 0) {
        els = [];
        if (p.showBackBtn !== false) els.push({ id: uid(), type: 'backBtn', label: '返回按钮', x: p.backBtnX ?? 58, y: p.backBtnY ?? 80, w: 40, h: 30, color: '#64748b', opacity: 1, borderRadius: 0, presetKey: 'back_btn' });
        if (p.showProgressBar !== false) els.push({ id: uid(), type: 'progressBar', label: '进度条', x: p.progressBarX ?? 440, y: p.progressBarY ?? 78, w: p.progressBarW ?? 240, h: 10, color: '#22c55e', opacity: 1, borderRadius: 5, presetKey: 'progress_bar' });
        if (p.showBottomPill !== false) els.push({ id: uid(), type: 'bottomPill', label: '底部横条', x: canvasW / 2 - 80, y: p.bottomPillY ?? 960, w: 160, h: 6, color: '#1e293b', opacity: 1, borderRadius: 3, presetKey: 'bottom_pill' });
      }
      setElements(els);
      pushHistory(els);
    });
  }, [id]);

  async function handleSave() {
    const backEl = elements.find(e => e.type === 'backBtn');
    const progEl = elements.find(e => e.type === 'progressBar');
    const pillEl = elements.find(e => e.type === 'bottomPill');
    const payload = {
      name, safeTop, safeBottom, canvasWidth: canvasW, canvasHeight: canvasH,
      showBackBtn: !!backEl, showProgressBar: !!progEl, showBottomPill: !!pillEl,
      backBtnX: backEl?.x ?? 58, backBtnY: backEl?.y ?? 80,
      progressBarX: progEl?.x ?? 440, progressBarY: progEl?.y ?? 78, progressBarW: progEl?.w ?? 240,
      bottomPillY: pillEl?.y ?? 960,
      elements,
    };
    const url = id && id !== 'new' ? `/api/canvas-presets/${id}` : '/api/canvas-presets';
    const method = id && id !== 'new' ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.success) {
      if (!id || id === 'new') navigate(`/canvas/${json.data.id}`, { replace: true });
      alert('保存成功');
    }
  }

  function addElement(presetKey) {
    const p = ELEMENT_PRESETS[presetKey];
    if (!p) return;
    const el = {
      id: uid(), type: p.type, presetKey,
      label: p.label, color: p.color,
      x: p.defaultX ?? Math.round(canvasW / 2 - p.w / 2),
      y: p.defaultY ?? Math.round((safeTop + safeBottom) / 2 - p.h / 2),
      w: p.w, h: p.h, opacity: 1, borderRadius: p.type === 'circle' ? 999 : 0,
    };
    if (p.type === 'text') {
      el.textContent = '文字内容';
      el.fontSize = 24; el.textColor = '#333333';
      el.fontFamily = '"PingFang SC", sans-serif';
      el.fontWeight = 'normal'; el.textAlign = 'center';
    }
    const next = [...elements, el];
    commitElements(next);
    setSelectedIds([el.id]);
    setTool('select');
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const el = {
        id: uid(), type: 'image', presetKey: 'image',
        label: file.name.split('.')[0], color: '#94a3b8',
        x: Math.round(canvasW / 2 - 150), y: Math.round((safeTop + safeBottom) / 2 - 100),
        w: 300, h: 200, opacity: 1, borderRadius: 8, src: ev.target.result,
      };
      const next = [...elements, el];
      commitElements(next);
      setSelectedIds([el.id]);
      setTool('select');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function updateSelected(patch) {
    const next = elements.map(el => selectedIds.includes(el.id) ? { ...el, ...patch } : el);
    commitElements(next);
  }

  function deleteSelected() {
    commitElements(elements.filter(el => !selectedIds.includes(el.id)));
    setSelectedIds([]);
  }

  function duplicateSelected() {
    const dupes = selEls.map(el => ({ ...el, id: uid(), x: el.x + 20, y: el.y + 20 }));
    const next = [...elements, ...dupes];
    commitElements(next);
    setSelectedIds(dupes.map(d => d.id));
  }

  function bringToFront() {
    const rest = elements.filter(el => !selectedIds.includes(el.id));
    commitElements([...rest, ...selEls]);
  }
  function sendToBack() {
    const rest = elements.filter(el => !selectedIds.includes(el.id));
    commitElements([...selEls, ...rest]);
  }

  // ─── Alignment ───
  function alignLeft() { if (!multi) return; const v = Math.min(...selEls.map(e => e.x)); updateSelected({ x: v }); }
  function alignRight() { if (!multi) return; const v = Math.max(...selEls.map(e => e.x + e.w)); commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, x: v - el.w } : el)); }
  function alignCenterH() {
    if (!multi) return;
    const minX = Math.min(...selEls.map(e => e.x)), maxR = Math.max(...selEls.map(e => e.x + e.w));
    const c = (minX + maxR) / 2;
    commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, x: Math.round(c - el.w / 2) } : el));
  }
  function alignTop() { if (!multi) return; const v = Math.min(...selEls.map(e => e.y)); updateSelected({ y: v }); }
  function alignBottom() { if (!multi) return; const v = Math.max(...selEls.map(e => e.y + e.h)); commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, y: v - el.h } : el)); }
  function alignCenterV() {
    if (!multi) return;
    const minY = Math.min(...selEls.map(e => e.y)), maxB = Math.max(...selEls.map(e => e.y + e.h));
    const c = (minY + maxB) / 2;
    commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, y: Math.round(c - el.h / 2) } : el));
  }
  function distributeH() {
    if (selEls.length < 3) return;
    const sorted = [...selEls].sort((a, b) => a.x - b.x);
    const totalW = sorted.reduce((s, e) => s + e.w, 0);
    const span = sorted.at(-1).x + sorted.at(-1).w - sorted[0].x;
    const gap = (span - totalW) / (sorted.length - 1);
    let cx = sorted[0].x; const upd = {};
    for (const el of sorted) { upd[el.id] = Math.round(cx); cx += el.w + gap; }
    commitElements(elements.map(el => upd[el.id] != null ? { ...el, x: upd[el.id] } : el));
  }
  function distributeV() {
    if (selEls.length < 3) return;
    const sorted = [...selEls].sort((a, b) => a.y - b.y);
    const totalH = sorted.reduce((s, e) => s + e.h, 0);
    const span = sorted.at(-1).y + sorted.at(-1).h - sorted[0].y;
    const gap = (span - totalH) / (sorted.length - 1);
    let cy = sorted[0].y; const upd = {};
    for (const el of sorted) { upd[el.id] = Math.round(cy); cy += el.h + gap; }
    commitElements(elements.map(el => upd[el.id] != null ? { ...el, y: upd[el.id] } : el));
  }
  function centerCanvasH() {
    if (!selEls.length) return;
    const minX = Math.min(...selEls.map(e => e.x)), maxR = Math.max(...selEls.map(e => e.x + e.w));
    const off = Math.round((canvasW - (maxR - minX)) / 2) - minX;
    commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, x: el.x + off } : el));
  }
  function centerCanvasV() {
    if (!selEls.length) return;
    const minY = Math.min(...selEls.map(e => e.y)), maxB = Math.max(...selEls.map(e => e.y + e.h));
    const off = Math.round(safeTop + ((safeBottom - safeTop) - (maxB - minY)) / 2) - minY;
    commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, y: el.y + off } : el));
  }

  // ─── Canvas interaction ───
  function toCanvas(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  }

  function hitTest(x, y) {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h) return el;
    }
    return null;
  }

  function hitSafeLine(y) {
    if (Math.abs(y - safeTop) < 8) return 'top';
    if (Math.abs(y - safeBottom) < 8) return 'bottom';
    return null;
  }

  const RS = 8;
  function hitResize(el, x, y) {
    return x >= el.x + el.w - RS && x <= el.x + el.w + RS && y >= el.y + el.h - RS && y <= el.y + el.h + RS;
  }

  function onWrapPointerDown(e) {
    if (spaceHeld || e.button === 1) {
      e.preventDefault();
      setPanning({ startX: e.clientX, startY: e.clientY, origPan: { ...pan } });
      return;
    }
  }
  function onWrapPointerMove(e) {
    if (panning) {
      setPan({ x: panning.origPan.x + (e.clientX - panning.startX), y: panning.origPan.y + (e.clientY - panning.startY) });
      return;
    }
  }
  function onWrapPointerUp() { if (panning) setPanning(null); }

  function onPointerDown(e) {
    if (spaceHeld || e.button === 1) return;
    const pt = toCanvas(e);

    if (tool === 'rect' || tool === 'circle' || tool === 'text') {
      setDrawStart({ ...pt, tool });
      return;
    }
    if (tool === 'image') { fileRef.current?.click(); return; }

    const line = hitSafeLine(pt.y);
    if (line) { setDraggingLine(line); return; }

    const el = hitTest(pt.x, pt.y);
    if (el) {
      if (hitResize(el, pt.x, pt.y)) {
        setResizing({ id: el.id, startX: pt.x, startY: pt.y, origW: el.w, origH: el.h });
      } else {
        let newSel;
        if (e.shiftKey) {
          newSel = selectedIds.includes(el.id) ? selectedIds.filter(i => i !== el.id) : [...selectedIds, el.id];
        } else {
          newSel = selectedIds.includes(el.id) ? selectedIds : [el.id];
        }
        setSelectedIds(newSel);
        const targets = elements.filter(x => newSel.includes(x.id));
        setDragging({ startX: pt.x, startY: pt.y, origs: targets.map(x => ({ id: x.id, x: x.x, y: x.y })) });
      }
    } else {
      setSelectedIds([]);
      setMarquee({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
    }
  }

  function onPointerMove(e) {
    if (panning) return;
    const pt = toCanvas(e);

    if (drawStart) {
      setDrawStart(prev => ({ ...prev, x2: pt.x, y2: pt.y }));
      return;
    }

    if (marquee) {
      setMarquee(prev => ({ ...prev, x2: pt.x, y2: pt.y }));
      return;
    }

    if (draggingLine) {
      if (draggingLine === 'top') setSafeTop(clamp(snapV(pt.y, snapOn), 0, safeBottom - 50));
      else setSafeBottom(clamp(snapV(pt.y, snapOn), safeTop + 50, canvasH));
      return;
    }

    if (resizing) {
      const dx = pt.x - resizing.startX, dy = pt.y - resizing.startY;
      setElements(prev => prev.map(el => el.id === resizing.id ? { ...el, w: Math.max(10, snapV(resizing.origW + dx, snapOn)), h: Math.max(10, snapV(resizing.origH + dy, snapOn)) } : el));
      return;
    }

    if (dragging) {
      setElements(prev => prev.map(el => {
        const o = dragging.origs.find(x => x.id === el.id);
        if (!o) return el;
        return { ...el, x: snapV(o.x + (pt.x - dragging.startX), snapOn), y: snapV(o.y + (pt.y - dragging.startY), snapOn) };
      }));
    }
  }

  function onPointerUp(e) {
    if (drawStart) {
      const pt = toCanvas(e);
      const x2 = drawStart.x2 ?? pt.x, y2 = drawStart.y2 ?? pt.y;
      const x1 = Math.min(drawStart.x, x2), y1 = Math.min(drawStart.y, y2);
      const w = Math.abs(x2 - drawStart.x), h = Math.abs(y2 - drawStart.y);
      if (w > 5 || h > 5) {
        const tp = drawStart.tool === 'circle' ? 'circle' : drawStart.tool === 'text' ? 'text' : 'rect';
        const el = {
          id: uid(), type: tp, presetKey: tp, label: tp === 'text' ? '文字' : tp === 'circle' ? '圆形' : '矩形',
          color: tp === 'text' ? '#f59e0b' : tp === 'circle' ? '#3b82f6' : '#6366f1',
          x: snapV(x1, snapOn), y: snapV(y1, snapOn),
          w: Math.max(20, snapV(w, snapOn)), h: Math.max(20, snapV(h, snapOn)),
          opacity: 1, borderRadius: tp === 'circle' ? 999 : 0,
        };
        if (tp === 'text') {
          el.textContent = '文字内容'; el.fontSize = 24; el.textColor = '#333333';
          el.fontFamily = '"PingFang SC", sans-serif'; el.fontWeight = 'normal'; el.textAlign = 'center';
        }
        const next = [...elements, el];
        commitElements(next);
        setSelectedIds([el.id]);
      }
      setDrawStart(null);
      setTool('select');
      return;
    }

    if (marquee) {
      const mx1 = Math.min(marquee.x1, marquee.x2), my1 = Math.min(marquee.y1, marquee.y2);
      const mx2 = Math.max(marquee.x1, marquee.x2), my2 = Math.max(marquee.y1, marquee.y2);
      if (mx2 - mx1 > 5 || my2 - my1 > 5) {
        const hits = elements.filter(el => el.x < mx2 && el.x + el.w > mx1 && el.y < my2 && el.y + el.h > my1);
        setSelectedIds(hits.map(e => e.id));
      }
      setMarquee(null);
      return;
    }

    if (dragging) { pushHistory(elements); }
    if (resizing) { pushHistory(elements); }
    setDragging(null); setResizing(null); setDraggingLine(null);
  }

  // ─── Draw ───
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvasW, canvasH);

    // grid
    ctx.strokeStyle = 'rgba(56,189,248,0.06)'; ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvasW; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasH); ctx.stroke(); }
    for (let y = 0; y <= canvasH; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasW, y); ctx.stroke(); }

    // danger zones
    ctx.fillStyle = 'rgba(0,0,0,0.025)';
    ctx.fillRect(0, 0, canvasW, safeTop);
    ctx.fillRect(0, safeBottom, canvasW, canvasH - safeBottom);

    ctx.fillStyle = 'rgba(56,189,248,0.04)';
    ctx.fillRect(0, safeTop, canvasW, safeBottom - safeTop);

    // elements
    elements.forEach(el => {
      ctx.save();
      ctx.globalAlpha = el.opacity ?? 1;

      if (el.type === 'backBtn') {
        ctx.fillStyle = 'rgba(100,116,139,0.15)';
        roundRect(ctx, el.x - 5, el.y - 5, el.w + 10, el.h + 10, 6); ctx.fill();
        ctx.fillStyle = '#64748b';
        ctx.beginPath(); ctx.moveTo(el.x + 20, el.y + 2); ctx.lineTo(el.x + 4, el.y + el.h / 2); ctx.lineTo(el.x + 20, el.y + el.h - 2); ctx.closePath(); ctx.fill();
        ctx.font = '12px system-ui'; ctx.fillStyle = '#64748b'; ctx.fillText('返回', el.x + 24, el.y + el.h / 2 + 4);
      } else if (el.type === 'progressBar') {
        ctx.fillStyle = '#e5e7eb'; roundRect(ctx, el.x, el.y, el.w, el.h, el.h / 2); ctx.fill();
        ctx.fillStyle = el.color; roundRect(ctx, el.x, el.y, el.w * 0.4, el.h, el.h / 2); ctx.fill();
        ctx.fillStyle = '#64748b'; ctx.font = '11px system-ui'; ctx.fillText('1 / 5', el.x + el.w + 10, el.y + el.h);
      } else if (el.type === 'bottomPill') {
        ctx.fillStyle = el.color; roundRect(ctx, el.x, el.y, el.w, el.h, el.h / 2); ctx.fill();
      } else if (el.type === 'image' && el.src) {
        if (!imgCache.current[el.src]) {
          const img = new Image();
          img.onload = () => { imgCache.current[el.src] = img; draw(); };
          img.src = el.src;
          imgCache.current[el.src] = 'loading';
        }
        const img = imgCache.current[el.src];
        if (img && img !== 'loading') {
          roundRect(ctx, el.x, el.y, el.w, el.h, el.borderRadius || 0); ctx.clip();
          ctx.drawImage(img, el.x, el.y, el.w, el.h);
        } else {
          ctx.fillStyle = '#e5e7eb'; roundRect(ctx, el.x, el.y, el.w, el.h, el.borderRadius || 0); ctx.fill();
          ctx.fillStyle = '#999'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
          ctx.fillText('加载中...', el.x + el.w / 2, el.y + el.h / 2 + 4); ctx.textAlign = 'left';
        }
      } else if (el.type === 'text') {
        ctx.fillStyle = hexToRgba(el.color, 0.08);
        roundRect(ctx, el.x, el.y, el.w, el.h, el.borderRadius || 0); ctx.fill();
        ctx.strokeStyle = hexToRgba(el.color, 0.3); ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
        ctx.strokeRect(el.x, el.y, el.w, el.h); ctx.setLineDash([]);
        ctx.font = `${el.fontWeight || 'normal'} ${el.fontSize || 24}px ${el.fontFamily || 'system-ui'}`;
        ctx.fillStyle = el.textColor || '#333';
        ctx.textBaseline = 'middle';
        const align = el.textAlign || 'center';
        if (align === 'left') { ctx.textAlign = 'left'; ctx.fillText(el.textContent || '', el.x + 8, el.y + el.h / 2, el.w - 16); }
        else if (align === 'right') { ctx.textAlign = 'right'; ctx.fillText(el.textContent || '', el.x + el.w - 8, el.y + el.h / 2, el.w - 16); }
        else { ctx.textAlign = 'center'; ctx.fillText(el.textContent || '', el.x + el.w / 2, el.y + el.h / 2, el.w); }
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      } else if (el.type === 'circle') {
        ctx.fillStyle = hexToRgba(el.color, 0.15);
        ctx.strokeStyle = hexToRgba(el.color, 0.6); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(el.x + el.w / 2, el.y + el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = hexToRgba(el.color, 0.5); ctx.font = '12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(el.label || '', el.x + el.w / 2, el.y + el.h / 2 + 4); ctx.textAlign = 'left';
      } else {
        ctx.fillStyle = hexToRgba(el.color, 0.15);
        ctx.strokeStyle = hexToRgba(el.color, 0.6); ctx.lineWidth = 1.5;
        roundRect(ctx, el.x, el.y, el.w, el.h, el.borderRadius || 0); ctx.fill(); ctx.stroke();
        ctx.fillStyle = hexToRgba(el.color, 0.5); ctx.font = '12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(el.label || '', el.x + el.w / 2, el.y + el.h / 2 + 4); ctx.textAlign = 'left';
      }
      ctx.restore();
    });

    // selection outlines
    selectedIds.forEach(sid => {
      const el = elements.find(e => e.id === sid);
      if (!el) return;
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
      ctx.strokeRect(el.x - 1, el.y - 1, el.w + 2, el.h + 2);
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5;
      ctx.fillRect(el.x + el.w - 4, el.y + el.h - 4, 8, 8);
      ctx.strokeRect(el.x + el.w - 4, el.y + el.h - 4, 8, 8);
    });

    // measurements
    if (measureOn && selectedIds.length === 1) {
      const el = elements.find(e => e.id === selectedIds[0]);
      if (el) {
        ctx.font = '11px system-ui'; ctx.fillStyle = 'rgba(56,189,248,0.85)';
        ctx.fillText(`(${el.x}, ${el.y})`, el.x, el.y - 6);
        ctx.fillText(`${el.w} × ${el.h}`, el.x + el.w + 6, el.y + el.h / 2 + 4);
        const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(56,189,248,0.7)'; ctx.font = '10px system-ui';
        ctx.fillText(`中心 (${Math.round(cx)}, ${Math.round(cy)})`, cx + 6, cy - 6);
      }
    }

    // safe lines
    ctx.strokeStyle = 'rgba(239,68,68,0.65)'; ctx.lineWidth = 2; ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(0, safeTop); ctx.lineTo(canvasW, safeTop);
    ctx.moveTo(0, safeBottom); ctx.lineTo(canvasW, safeBottom);
    ctx.stroke(); ctx.setLineDash([]);

    [safeTop, safeBottom].forEach(ly => {
      ctx.fillStyle = 'rgba(239,68,68,0.8)';
      roundRect(ctx, canvasW / 2 - 30, ly - 4, 60, 8, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 7px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('⋯', canvasW / 2, ly + 3); ctx.textAlign = 'left';
    });

    ctx.font = 'bold 13px system-ui'; ctx.fillStyle = 'rgba(239,68,68,0.75)';
    ctx.fillText(`上界 y = ${safeTop}`, 12, safeTop - 8);
    ctx.fillText(`下界 y = ${safeBottom}`, 12, safeBottom + 18);

    ctx.fillStyle = 'rgba(56,189,248,0.3)'; ctx.font = '14px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(`操作区 ${safeBottom - safeTop}px`, canvasW / 2, (safeTop + safeBottom) / 2 + 5);
    ctx.textAlign = 'left';

    // draw preview
    if (drawStart && drawStart.x2 != null) {
      const x1 = Math.min(drawStart.x, drawStart.x2), y1 = Math.min(drawStart.y, drawStart.y2);
      const w = Math.abs(drawStart.x2 - drawStart.x), h = Math.abs(drawStart.y2 - drawStart.y);
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      if (drawStart.tool === 'circle') {
        ctx.beginPath(); ctx.ellipse(x1 + w / 2, y1 + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.strokeRect(x1, y1, w, h);
      }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(56,189,248,0.7)'; ctx.font = '11px system-ui';
      ctx.fillText(`${Math.round(w)} × ${Math.round(h)}`, x1 + w + 8, y1 + h / 2);
    }

    // marquee
    if (marquee) {
      const x1 = Math.min(marquee.x1, marquee.x2), y1 = Math.min(marquee.y1, marquee.y2);
      const w = Math.abs(marquee.x2 - marquee.x1), h = Math.abs(marquee.y2 - marquee.y1);
      ctx.fillStyle = 'rgba(56,189,248,0.08)'; ctx.fillRect(x1, y1, w, h);
      ctx.strokeStyle = 'rgba(56,189,248,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.strokeRect(x1, y1, w, h); ctx.setLineDash([]);
    }
  }, [elements, selectedIds, safeTop, safeBottom, drawStart, marquee, measureOn, scale]);

  useEffect(() => {
    const raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  // keyboard
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length) { e.preventDefault(); deleteSelected(); }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.key === 'a') { e.preventDefault(); setSelectedIds(elements.map(e => e.id)); }
      if (e.ctrlKey && e.key === '0') { e.preventDefault(); resetView(); }
      const step = e.shiftKey ? 10 : 1;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.length) {
        e.preventDefault();
        const next = elements.map(el => {
          if (!selectedIds.includes(el.id)) return el;
          if (e.key === 'ArrowUp') return { ...el, y: el.y - step };
          if (e.key === 'ArrowDown') return { ...el, y: el.y + step };
          if (e.key === 'ArrowLeft') return { ...el, x: el.x - step };
          if (e.key === 'ArrowRight') return { ...el, x: el.x + step };
          return el;
        });
        setElements(next);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, elements, histIdx, history]);

  const cursor = panning ? 'grabbing' : spaceHeld ? 'grab' : draggingLine ? 'row-resize' : dragging ? 'grabbing' : resizing ? 'nwse-resize'
    : (tool !== 'select' ? 'crosshair' : marquee ? 'crosshair' : 'default');

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-glass btn-sm" onClick={() => navigate('/canvas')}>&larr;</button>
          <ResizableField id="cvs_name" width={180}>
            <input className="glass-input" style={{ width: '100%', fontWeight: 600 }} placeholder="画布名称" value={name} onChange={e => setName(e.target.value)} />
          </ResizableField>
          {isDefault && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(56,189,248,0.1)', color: 'var(--ice-border)' }}>默认</span>}
          <button className={`btn btn-sm ${tool === 'select' ? 'btn-primary' : 'btn-glass'}`} onClick={() => setTool('select')} title="选择工具">⬚ 选择</button>
          <button className={`btn btn-sm ${tool === 'rect' ? 'btn-primary' : 'btn-glass'}`} onClick={() => setTool('rect')} title="矩形工具">▭ 矩形</button>
          <button className={`btn btn-sm ${tool === 'circle' ? 'btn-primary' : 'btn-glass'}`} onClick={() => setTool('circle')} title="圆形工具">○ 圆形</button>
          <button className={`btn btn-sm ${tool === 'text' ? 'btn-primary' : 'btn-glass'}`} onClick={() => setTool('text')} title="文字工具">T 文字</button>
          <button className="btn btn-glass btn-sm" onClick={() => fileRef.current?.click()} title="上传图片">🖼 图片</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label className="snap-toggle" title="吸附网格"><input type="checkbox" checked={snapOn} onChange={e => setSnapOn(e.target.checked)} /><span style={{ fontSize: 12 }}>吸附</span></label>
          <label className="snap-toggle" title="显示标注"><input type="checkbox" checked={measureOn} onChange={e => setMeasureOn(e.target.checked)} /><span style={{ fontSize: 12 }}>标注</span></label>
          <button className="btn btn-glass btn-sm" onClick={undo} title="撤销 Ctrl+Z">↩</button>
          <button className="btn btn-glass btn-sm" onClick={redo} title="重做 Ctrl+Y">↪</button>
          <button className="btn btn-glass btn-sm" onClick={() => navigate('/canvas')}>取消</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!name.trim()}>保存</button>
        </div>
      </div>

      <div className="editor-layout">
        {/* Left Sidebar — add elements & element list */}
        <div className="editor-sidebar">
          <div className="panel-section">
            <div className="panel-section-title">添加元素</div>
            <div className="elem-toolbar">
              {Object.entries(ELEMENT_PRESETS).map(([key, p]) => (
                <button key={key} className="btn btn-glass btn-sm" onClick={() => addElement(key)}
                  style={{ borderLeftColor: p.color, borderLeftWidth: 3 }}>{p.label}</button>
              ))}
              <button className="btn btn-glass btn-sm" onClick={() => fileRef.current?.click()}
                style={{ borderLeftColor: '#94a3b8', borderLeftWidth: 3 }}>上传图片</button>
            </div>
          </div>

          <div className="panel-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="panel-section-title">元素列表 ({elements.length})</div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {elements.map(el => (
                <div key={el.id}
                  onClick={() => setSelectedIds([el.id])}
                  style={{
                    padding: '4px 8px', borderRadius: 5, fontSize: 11.5, cursor: 'pointer',
                    background: selectedIds.includes(el.id) ? 'var(--ice-light)' : 'transparent',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                  <span>
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: el.type === 'circle' ? '50%' : 2, background: el.color, marginRight: 5 }} />
                    {el.label}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{el.x},{el.y} {el.w}×{el.h}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Center — Canvas */}
        <div className="editor-canvas-wrap" ref={wrapRef} style={{ overflow: 'hidden', position: 'relative' }}
          onPointerDown={onWrapPointerDown} onPointerMove={onWrapPointerMove}
          onPointerUp={onWrapPointerUp} onPointerLeave={onWrapPointerUp}>
          <div style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: '0 0',
            position: 'absolute', left: 0, top: 0,
            width: canvasW * scale, height: canvasH * scale,
          }}>
            <canvas ref={canvasRef} width={canvasW} height={canvasH}
              style={{ width: canvasW * scale, height: canvasH * scale, borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.1)', cursor }}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
            />
          </div>
          {/* Zoom indicator */}
          <div style={{
            position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(15,23,42,0.75)', borderRadius: 6, padding: '3px 8px', backdropFilter: 'blur(8px)',
            fontSize: 11, color: '#94a3b8', userSelect: 'none', zIndex: 10,
          }}>
            <button onClick={() => setScale(s => Math.max(MIN_SCALE, s / 1.2))}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>−</button>
            <span onClick={resetView}
              style={{ cursor: 'pointer', minWidth: 36, textAlign: 'center', fontWeight: 600 }}
              title="点击重置视图">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={() => setScale(s => Math.min(MAX_SCALE, s * 1.2))}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>+</button>
          </div>
        </div>

        {/* Right Panel — properties & alignment */}
        <div className="editor-panel">
          {selectedIds.length > 0 && (
            <div className="panel-section">
              <div className="panel-section-title">对齐 &amp; 排列</div>
              <div className="align-toolbar">
                <AlignIcon title="左对齐" disabled={!multi} onClick={alignLeft} d="M2 1v14h1V1H2zm4 2h7v4H6V3zm0 6h5v4H6V9z" />
                <AlignIcon title="水平居中" disabled={!multi} onClick={alignCenterH} d="M7.5 1v3H4v4h3.5v2H5v4h2.5v2h1v-2H11V10H8.5V8H12V4H8.5V1h-1z" />
                <AlignIcon title="右对齐" disabled={!multi} onClick={alignRight} d="M13 1v14h1V1h-1zM3 3h7v4H3V3zm2 6h5v4H5V9z" />
                <span className="align-sep" />
                <AlignIcon title="上对齐" disabled={!multi} onClick={alignTop} d="M1 2h14V3H1V2zm2 4v7h4V6H3zm6 0v5h4V6H9z" />
                <AlignIcon title="垂直居中" disabled={!multi} onClick={alignCenterV} d="M1 7.5h3V4v0h4v3.5h2V5h4v2.5h2v1h-2V11H10V8.5H8V12H4V8.5H1v-1z" />
                <AlignIcon title="下对齐" disabled={!multi} onClick={alignBottom} d="M1 13h14v1H1v-1zM3 3v7h4V3H3zm6 2v5h4V5H9z" />
                <span className="align-sep" />
                <AlignIcon title="水平分布" disabled={selEls.length < 3} onClick={distributeH} d="M1 2h2v12H1V2zm6 3h2v6H7V5zm6 0h2v12h-2V2z" />
                <AlignIcon title="垂直分布" disabled={selEls.length < 3} onClick={distributeV} d="M2 1v2h12V1H2zm3 6v2h6V7H5zm-3 6v2h12v-2H2z" />
                <span className="align-sep" />
                <AlignIcon title="画布水平居中" onClick={centerCanvasH} d="M7 1h2v2h4v4h-4v2h3v4H9v2H7v-2H4v-4h3V7H3V3h4V1z" />
                <AlignIcon title="操作区垂直居中" onClick={centerCanvasV} d="M1 7v2h2v4h4v-4h2v3h4V9h2V7h-2H4V4h4V1h2v2h4v4h-4z" />
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                <button className="btn btn-glass btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={bringToFront}>置顶</button>
                <button className="btn btn-glass btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={sendToBack}>置底</button>
                <button className="btn btn-glass btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={duplicateSelected}>复制</button>
                <button className="btn btn-danger btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={deleteSelected}>删除</button>
              </div>
            </div>
          )}

          {selected && (
            <div className="panel-section">
              <div className="panel-section-title">{selected.label} 属性</div>
              <div className="prop-grid">
                <div className="prop-cell"><label>X</label><NumInput className="glass-input" value={selected.x} onChange={v => updateSelected({ x: v })} /></div>
                <div className="prop-cell"><label>Y</label><NumInput className="glass-input" value={selected.y} onChange={v => updateSelected({ y: v })} /></div>
                <div className="prop-cell"><label>W</label><NumInput className="glass-input" value={selected.w} min={10} onChange={v => updateSelected({ w: v })} /></div>
                <div className="prop-cell"><label>H</label><NumInput className="glass-input" value={selected.h} min={10} onChange={v => updateSelected({ h: v })} /></div>
              </div>

              <div className="prop-grid" style={{ marginTop: 6 }}>
                <div className="prop-cell"><label>透明度</label><NumInput className="glass-input" min={0} max={1} step={0.1} value={selected.opacity ?? 1} onChange={v => updateSelected({ opacity: v })} /></div>
                <div className="prop-cell"><label>颜色</label><input type="color" value={selected.color || '#64748b'} onChange={e => updateSelected({ color: e.target.value })} style={{ width: '100%', height: 28, border: 'none', cursor: 'pointer', borderRadius: 4, boxSizing: 'border-box' }} /></div>
              </div>

              <div className="prop-grid" style={{ marginTop: 6 }}>
                <div className="prop-cell"><label>圆角</label><NumInput className="glass-input" min={0} value={selected.borderRadius ?? 0} onChange={v => updateSelected({ borderRadius: v })} /></div>
                <div className="prop-cell">
                  <label>标签</label>
                  <input className="glass-input" value={selected.label || ''} onChange={e => updateSelected({ label: e.target.value })} />
                </div>
              </div>

              {selected.type === 'text' && (
                <div style={{ marginTop: 8, borderTop: '1px solid rgba(56,189,248,0.08)', paddingTop: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>文字属性</div>
                  <div className="prop-cell" style={{ marginBottom: 6 }}>
                    <label>内容</label>
                    <input className="glass-input" value={selected.textContent || ''} onChange={e => updateSelected({ textContent: e.target.value })} />
                  </div>
                  <div className="prop-grid">
                    <div className="prop-cell"><label>字号</label><NumInput className="glass-input" min={8} value={selected.fontSize || 24} onChange={v => updateSelected({ fontSize: v })} /></div>
                    <div className="prop-cell"><label>字色</label><input type="color" value={selected.textColor || '#333'} onChange={e => updateSelected({ textColor: e.target.value })} style={{ width: '100%', height: 28, border: 'none', cursor: 'pointer', borderRadius: 4, boxSizing: 'border-box' }} /></div>
                  </div>
                  <div className="prop-grid" style={{ marginTop: 6 }}>
                    <div className="prop-cell">
                      <label>字体</label>
                      <select className="glass-input" value={selected.fontFamily || '"PingFang SC", sans-serif'} onChange={e => updateSelected({ fontFamily: e.target.value })}>
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div className="prop-cell">
                      <label>字重</label>
                      <select className="glass-input" value={selected.fontWeight || 'normal'} onChange={e => updateSelected({ fontWeight: e.target.value })}>
                        <option value="normal">常规</option>
                        <option value="bold">粗体</option>
                        <option value="300">细体</option>
                      </select>
                    </div>
                  </div>
                  <div className="prop-grid" style={{ marginTop: 6 }}>
                    <div className="prop-cell">
                      <label>对齐</label>
                      <select className="glass-input" value={selected.textAlign || 'center'} onChange={e => updateSelected({ textAlign: e.target.value })}>
                        <option value="left">左对齐</option>
                        <option value="center">居中</option>
                        <option value="right">右对齐</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {multi && (
            <div className="panel-section">
              <div className="panel-section-title">批量操作 ({selEls.length})</div>
              <div className="prop-grid">
                <div className="prop-cell"><label>统一 W</label><NumInput className="glass-input" placeholder="宽" value="" onChange={v => updateSelected({ w: v })} /></div>
                <div className="prop-cell"><label>统一 H</label><NumInput className="glass-input" placeholder="高" value="" onChange={v => updateSelected({ h: v })} /></div>
              </div>
            </div>
          )}

          {!selected && !multi && (
            <div className="panel-section">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                选择画布上的元素<br />查看和编辑属性
              </div>
            </div>
          )}

          <div className="panel-section">
            <div className="panel-section-title">安全线</div>
            <div className="prop-grid">
              <div className="prop-cell"><label>上界 Y</label><NumInput className="glass-input" min={0} max={safeBottom - 50} value={safeTop} onChange={v => setSafeTop(v)} /></div>
              <div className="prop-cell"><label>下界 Y</label><NumInput className="glass-input" min={safeTop + 50} max={canvasH} value={safeBottom} onChange={v => setSafeBottom(v)} /></div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              操作区 {safeBottom - safeTop}px · 可拖拽红线调整
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-section-title">画布尺寸</div>
            <div className="prop-grid">
              <div className="prop-cell"><label>宽</label><NumInput className="glass-input" min={100} max={4096} value={canvasW} onChange={v => setCanvasW(v)} /></div>
              <div className="prop-cell"><label>高</label><NumInput className="glass-input" min={100} max={4096} value={canvasH} onChange={v => setCanvasH(v)} /></div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              缩放 {(scale * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
