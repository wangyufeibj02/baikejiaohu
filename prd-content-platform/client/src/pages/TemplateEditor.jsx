import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const CANVAS_W = 1624;
const CANVAS_H = 1050;
const DEFAULT_SAFE_TOP = 150;
const DEFAULT_SAFE_BOTTOM = 900;
const SNAP_SIZE = 10;
const MAX_HISTORY = 60;

const ELEMENT_PRESETS = {
  option_image: { label: '选项图', w: 230, h: 230, color: '#6366f1', type: 'rect' },
  stem_image:   { label: '题干图', w: 400, h: 250, color: '#0ea5e9', type: 'rect' },
  stem_text:    { label: '题干文字', w: 600, h: 80, color: '#0ea5e9', type: 'text' },
  audio_btn:    { label: '配音按钮', w: 66, h: 66, color: '#22c55e', type: 'circle' },
  text_label:   { label: '文字标签', w: 200, h: 60, color: '#f59e0b', type: 'text' },
  free_rect:    { label: '矩形', w: 300, h: 200, color: '#64748b', type: 'rect' },
  bg_area:      { label: '背景区', w: 1624, h: 1050, color: '#94a3b8', type: 'rect' },
  collide_zone: { label: '碰撞区', w: 230, h: 230, color: '#ef4444', type: 'rect' },
  animation_area: { label: '动效区', w: 400, h: 300, color: '#a855f7', type: 'rect' },
  anim_cover:     { label: '白边覆盖区', w: 1200, h: 300, color: '#d946ef', type: 'rect' },
};

const FONT_OPTIONS = [
  { value: '"PingFang SC", sans-serif', label: '苹方' },
  { value: '"Microsoft YaHei", sans-serif', label: '微软雅黑' },
  { value: '"SimHei", sans-serif', label: '黑体' },
  { value: '"SimSun", serif', label: '宋体' },
  { value: '"KaiTi", serif', label: '楷体' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '方正粗圆斑马英语', label: '方正粗圆斑马英语' },
];

const PRODUCTION_FONTS = [
  { value: '方正粗圆斑马英语', label: '方正粗圆斑马英语' },
  { value: '思源黑体', label: '思源黑体' },
  { value: 'Arial', label: 'Arial' },
];

function uid() { return 'el_' + Math.random().toString(36).slice(2, 9); }

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
function gid() { return 'grp_' + Math.random().toString(36).slice(2, 7); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function snap(v, on) { return on ? Math.round(v / SNAP_SIZE) * SNAP_SIZE : Math.round(v); }

function hexToRgba(hex, a) {
  const c = hex.replace('#', '');
  return `rgba(${parseInt(c.substring(0, 2), 16) || 0},${parseInt(c.substring(2, 4), 16) || 0},${parseInt(c.substring(4, 6), 16) || 0},${a})`;
}

function roundRect(ctx, x, y, w, h, r) {
  let tl, tr, br, bl;
  if (typeof r === 'object' && r !== null) {
    const max = Math.min(w / 2, h / 2);
    tl = Math.min(r.tl ?? 0, max);
    tr = Math.min(r.tr ?? 0, max);
    br = Math.min(r.br ?? 0, max);
    bl = Math.min(r.bl ?? 0, max);
  } else {
    tl = tr = br = bl = Math.min(r || 0, w / 2, h / 2);
  }
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y); ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br); ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h); ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl); ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

function getCornerRadii(el) {
  const def = el.type === 'text' ? 6 : el.type === 'circle' ? 0 : 10;
  const br = el.borderRadius;
  if (typeof br === 'object' && br !== null) return br;
  const v = br ?? def;
  return { tl: v, tr: v, br: v, bl: v };
}

const CONFIG_KEY_MAP = {
  option_image: 'options', stem_image: 'guidePictures', audio_btn: 'audioPictures',
  bg_area: 'normalBackgroundPictures', collide_zone: 'collides',
  animation_area: 'startAnimations', text_label: '_textLabels',
};

// ─── Alignment icons (inline SVG paths) ──────────────────
const A = { size: 16, vb: '0 0 16 16' };
const AlignIcon = ({ d, title, onClick, disabled }) => (
  <button className="icon-btn" onClick={onClick} title={title} disabled={disabled}>
    <svg width={A.size} height={A.size} viewBox={A.vb}><path d={d} fill="currentColor" /></svg>
  </button>
);

function StatePreview({ cfg }) {
  const bw = cfg.borderWidth || 4;
  const gap = cfg.borderGap || 0;
  const r = cfg.borderRadius || 0;
  const expand = gap + bw;
  const imgSize = 56;
  const total = imgSize + expand * 2;
  const half = bw / 2;
  const innerR = Math.max(0, r - bw - gap);
  const fc = cfg.fillColor || 'transparent';
  const fo = cfg.fillOpacity ?? 0;
  return (
    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center', padding: 10, background: 'rgba(56,189,248,0.04)', borderRadius: 6 }}>
      <svg width={total} height={total} viewBox={`0 0 ${total} ${total}`}>
        {fo > 0 && <rect x={half} y={half} width={total - bw} height={total - bw} rx={r} ry={r} fill={fc} fillOpacity={fo} />}
        <rect x={expand} y={expand} width={imgSize} height={imgSize} rx={innerR} ry={innerR} fill="rgba(99,102,241,0.2)" />
        {fo > 0 && <rect x={expand} y={expand} width={imgSize} height={imgSize} rx={innerR} ry={innerR} fill={fc} fillOpacity={fo * 0.6} />}
        <rect x={half} y={half} width={total - bw} height={total - bw} rx={r} ry={r}
          fill="none" stroke={cfg.borderColor} strokeWidth={bw} strokeOpacity={cfg.borderOpacity ?? 1}
          strokeLinecap={cfg.borderStyle === 'dashed' ? (cfg.lineCap || 'butt') : undefined}
          strokeDasharray={cfg.borderStyle === 'dashed' ? `${cfg.dashLength || 12} ${cfg.dashGap || 6}` : 'none'} />
        <text x={total / 2} y={total / 2} textAnchor="middle" dominantBaseline="central" fontSize="9" fill="rgba(148,163,184,0.9)">选项图</text>
      </svg>
    </div>
  );
}

function StatePanel({ label, stateKey, cfg, onChange }) {
  const upd = (k, v) => onChange(stateKey, k, v);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      <div className="prop-grid">
        <div className="prop-cell">
          <label>边框色</label>
          <input type="color" value={cfg.borderColor} onChange={e => upd('borderColor', e.target.value)}
            style={{ width: '100%', height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
        </div>
        <div className="prop-cell">
          <label>边框透明</label>
          <input type="number" className="glass-input" min="0" max="100" step="5"
            value={Math.round((cfg.borderOpacity ?? 1) * 100)}
            onChange={e => upd('borderOpacity', Math.min(1, Math.max(0, Number(e.target.value) / 100)))} />
        </div>
        <div className="prop-cell">
          <label>线宽</label>
          <input type="number" className="glass-input" min="1" max="20" value={cfg.borderWidth}
            onChange={e => upd('borderWidth', Number(e.target.value) || 4)} />
        </div>
        <div className="prop-cell">
          <label>线型</label>
          <select className="glass-input" value={cfg.borderStyle} onChange={e => upd('borderStyle', e.target.value)}>
            <option value="dashed">虚线</option>
            <option value="solid">实线</option>
          </select>
        </div>
        <div className="prop-cell">
          <label>间距</label>
          <input type="number" className="glass-input" min="0" max="40" value={cfg.borderGap}
            onChange={e => upd('borderGap', Number(e.target.value) || 0)} />
        </div>
        <div className="prop-cell">
          <label>圆角</label>
          <input type="number" className="glass-input" min="0" max="60" value={cfg.borderRadius}
            onChange={e => upd('borderRadius', Number(e.target.value) || 0)} />
        </div>
        {cfg.borderStyle === 'dashed' && (
          <>
            <div className="prop-cell">
              <label>段长</label>
              <input type="number" className="glass-input" min="2" max="40" value={cfg.dashLength}
                onChange={e => upd('dashLength', Number(e.target.value) || 12)} />
            </div>
            <div className="prop-cell">
              <label>段距</label>
              <input type="number" className="glass-input" min="1" max="30" value={cfg.dashGap}
                onChange={e => upd('dashGap', Number(e.target.value) || 6)} />
            </div>
            <div className="prop-cell">
              <label>段端</label>
              <select className="glass-input" value={cfg.lineCap || 'butt'} onChange={e => upd('lineCap', e.target.value)}>
                <option value="round">圆头</option>
                <option value="butt">平头</option>
                <option value="square">方头</option>
              </select>
            </div>
          </>
        )}
        <div className="prop-cell">
          <label>底色</label>
          <input type="color" value={cfg.fillColor || '#22c55e'} onChange={e => upd('fillColor', e.target.value)}
            style={{ width: '100%', height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
        </div>
        <div className="prop-cell">
          <label>底色透明</label>
          <input type="number" className="glass-input" min="0" max="100" step="5"
            value={Math.round((cfg.fillOpacity ?? 0) * 100)}
            onChange={e => upd('fillOpacity', Math.min(1, Math.max(0, Number(e.target.value) / 100)))} />
        </div>
      </div>
      <StatePreview cfg={cfg} />
    </div>
  );
}

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const containerRef = useRef(null);

  const [name, setName] = useState('');
  const [questionType, setQuestionType] = useState('choice');
  const [stemType, setStemType] = useState('audio');
  const [optionStyle, setOptionStyle] = useState('image');
  const [description, setDescription] = useState('');
  const [optionCount, setOptionCount] = useState(3);
  const [variant, setVariant] = useState('');
  const [textStyle, setTextStyle] = useState({
    fontFamily: '方正粗圆斑马英语',
    fontSize: 36,
    fontColor: '#2f4d90',
    bgColor: '#ffffff',
    align: 'center',
    letterSpacing: 0,
  });

  const DEFAULT_OPTION_STATES = {
    selected: { borderWidth: 4, borderColor: '#3b82f6', borderOpacity: 1, borderStyle: 'dashed', lineCap: 'round', dashLength: 12, dashGap: 6, borderGap: 8, borderRadius: 16, fillColor: '#3b82f6', fillOpacity: 0 },
    correct:  { borderWidth: 4, borderColor: '#22c55e', borderOpacity: 1, borderStyle: 'dashed', lineCap: 'round', dashLength: 12, dashGap: 6, borderGap: 8, borderRadius: 16, fillColor: '#22c55e', fillOpacity: 0.15 },
  };
  const [optionStates, setOptionStates] = useState(DEFAULT_OPTION_STATES);
  const [animSettings, setAnimSettings] = useState({ fps: 10, maxColors: 256, dither: 'floyd_steinberg' });

  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [snapOn, setSnapOn] = useState(true);
  const [measureOn, setMeasureOn] = useState(true);
  const [locked, setLocked] = useState(id && id !== 'new');
  const [status, setStatus] = useState('draft');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [safeTop, setSafeTop] = useState(DEFAULT_SAFE_TOP);
  const [safeBottom, setSafeBottom] = useState(DEFAULT_SAFE_BOTTOM);
  const [draggingLine, setDraggingLine] = useState(null);
  const [showFixedUI, setShowFixedUI] = useState(true);
  const [editingGroupId, setEditingGroupId] = useState(null);

  const [collapsedPanels, setCollapsedPanels] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tpl_panels') || '{}'); } catch { return {}; }
  });
  const togglePanel = useCallback((key) => {
    setCollapsedPanels(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('tpl_panels', JSON.stringify(next));
      return next;
    });
  }, []);

  const MIN_SCALE = 0.15;
  const MAX_SCALE = 2.5;

  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);

  function pushHistory(els) {
    const h = historyRef.current;
    const idx = historyIdxRef.current;
    historyRef.current = [...h.slice(0, idx + 1), JSON.stringify(els)].slice(-MAX_HISTORY);
    historyIdxRef.current = historyRef.current.length - 1;
  }

  function undo() {
    const idx = historyIdxRef.current;
    if (idx <= 0) return;
    historyIdxRef.current = idx - 1;
    setElements(JSON.parse(historyRef.current[idx - 1]));
  }

  function redo() {
    const h = historyRef.current;
    const idx = historyIdxRef.current;
    if (idx >= h.length - 1) return;
    historyIdxRef.current = idx + 1;
    setElements(JSON.parse(h[idx + 1]));
  }

  function commitElements(next) {
    setElements(next);
    pushHistory(next);
  }

  const [canvasPresets, setCanvasPresets] = useState([]);
  const [canvasPresetId, setCanvasPresetId] = useState('');
  const [canvasPresetData, setCanvasPresetData] = useState(null);

  function loadCanvasPresets() {
    return fetch('/api/canvas-presets').then(r => r.json()).then(d => {
      if (d.success) setCanvasPresets(d.data);
      return d.data || [];
    }).catch(() => []);
  }

  function applyCanvasPreset(presetId) {
    if (!presetId) { setCanvasPresetId(''); setCanvasPresetData(null); return; }
    setCanvasPresetId(presetId);
    fetch(`/api/canvas-presets/${presetId}`).then(r => r.json()).then(d => {
      if (d.success) {
        setCanvasPresetData(d.data);
        setSafeTop(d.data.safeTop ?? DEFAULT_SAFE_TOP);
        setSafeBottom(d.data.safeBottom ?? DEFAULT_SAFE_BOTTOM);
      }
    });
  }

  function loadGlobalCanvas() {
    return loadCanvasPresets().then(list => {
      const def = list.find(c => c.isDefault) || list[0];
      if (def) {
        setSafeTop(def.safeTop ?? DEFAULT_SAFE_TOP);
        setSafeBottom(def.safeBottom ?? DEFAULT_SAFE_BOTTOM);
        setCanvasPresetId(def.id);
      }
    });
  }

  useEffect(() => {
    if (id && id !== 'new') {
      fetch(`/api/templates/${id}`).then(r => r.json()).then(d => {
        if (d.success) {
          setName(d.data.name || '');
          setQuestionType(d.data.questionType || 'choice');
          setStemType(d.data.stemType || 'audio');
          setOptionStyle(d.data.optionStyle || 'image');
          setDescription(d.data.description || '');
          setOptionCount(d.data.optionCount || 3);
          setVariant(d.data.variant || '');
          setStatus(d.data.status || 'draft');
          if (d.data.textStyle) setTextStyle(ts => ({ ...ts, ...d.data.textStyle }));
          if (d.data.optionStates) setOptionStates(os => ({ selected: { ...os.selected, ...d.data.optionStates.selected }, correct: { ...os.correct, ...d.data.optionStates.correct } }));
          if (d.data.animationSettings) setAnimSettings(as => ({ ...as, ...d.data.animationSettings }));
          loadCanvasPresets();
          if (d.data.canvasPresetId) {
            setCanvasPresetId(d.data.canvasPresetId);
            fetch(`/api/canvas-presets/${d.data.canvasPresetId}`).then(r => r.json()).then(cp => {
              if (cp.success) { setCanvasPresetData(cp.data); setSafeTop(cp.data.safeTop ?? DEFAULT_SAFE_TOP); setSafeBottom(cp.data.safeBottom ?? DEFAULT_SAFE_BOTTOM); }
            });
          } else if (d.data.safeTop != null) {
            setSafeTop(d.data.safeTop);
            if (d.data.safeBottom != null) setSafeBottom(d.data.safeBottom);
          } else {
            loadGlobalCanvas();
          }
          const els = d.data.elements || [];
          setElements(els);
          pushHistory(els);
        }
      });
    } else {
      loadGlobalCanvas();
      pushHistory([]);
    }
  }, [id]);

  const fitScaleVal = useCallback(() => {
    if (!wrapRef.current) return 0.5;
    const r = wrapRef.current.getBoundingClientRect();
    return Math.min((r.width - 32) / CANVAS_W, (r.height - 32) / CANVAS_H, 1);
  }, []);

  function resetView() {
    const s = fitScaleVal();
    setScale(s);
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    function fitScale() { setScale(fitScaleVal()); setPan({ x: 0, y: 0 }); }
    fitScale();
    window.addEventListener('resize', fitScale);
    return () => window.removeEventListener('resize', fitScale);
  }, [fitScaleVal]);

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

  useEffect(() => { draw(); }, [elements, selectedIds, scale, marquee, measureOn, safeTop, safeBottom, showFixedUI, canvasPresetData]);

  const selEls = elements.filter(e => selectedIds.includes(e.id));
  const selected = selEls.length === 1 ? selEls[0] : null;

  // ─── Space key for pan mode ────────────────────────────
  useEffect(() => {
    function onDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); setSpaceHeld(true); }
    }
    function onUp(e) {
      if (e.code === 'Space') { setSpaceHeld(false); setPanning(null); }
    }
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // ─── Keyboard ──────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (locked) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(elements.map(el => el.id));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); resetView(); return; }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        commitElements(elements.filter(el => !selectedIds.includes(el.id)));
        setSelectedIds([]);
        return;
      }

      const nudge = e.shiftKey ? 10 : 1;
      const arrows = { ArrowLeft: [-nudge, 0], ArrowRight: [nudge, 0], ArrowUp: [0, -nudge], ArrowDown: [0, nudge] };
      if (arrows[e.key] && selectedIds.length > 0) {
        e.preventDefault();
        const [dx, dy] = arrows[e.key];
        commitElements(elements.map(el => {
          if (!selectedIds.includes(el.id)) return el;
          return { ...el, x: clamp(el.x + dx, 0, CANVAS_W - el.w), y: clamp(el.y + dy, 0, CANVAS_H - el.h) };
        }));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [elements, selectedIds, locked]);

  // ─── Drawing ───────────────────────────────────────────
  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (snapOn) {
      ctx.strokeStyle = 'rgba(200,210,225,0.25)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= CANVAS_W; x += SNAP_SIZE * 5) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_H; y += SNAP_SIZE * 5) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
      }
    }

    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, CANVAS_W, safeTop);
    ctx.fillRect(0, safeBottom, CANVAS_W, CANVAS_H - safeBottom);

    ctx.strokeStyle = 'rgba(239,68,68,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, safeTop); ctx.lineTo(CANVAS_W, safeTop);
    ctx.moveTo(0, safeBottom); ctx.lineTo(CANVAS_W, safeBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(239,68,68,0.5)';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('操作区上界 y=' + safeTop, 10, safeTop - 6);
    ctx.fillText('操作区下界 y=' + safeBottom, 10, safeBottom + 18);

    if (showFixedUI) drawFixedElements(ctx);

    for (const el of elements) {
      const isSel = selectedIds.includes(el.id);
      ctx.save();
      ctx.globalAlpha = el.opacity ?? 1;
      const r = getCornerRadii(el);

      if (el.type === 'circle') {
        const cx = el.x + el.w / 2, cy = el.y + el.h / 2, rad = Math.min(el.w, el.h) / 2;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(el.color, 0.2); ctx.fill();
        ctx.strokeStyle = isSel ? '#6366f1' : el.color;
        ctx.lineWidth = isSel ? 3 : 1.5; ctx.stroke();
      } else if (el.type === 'text') {
        ctx.fillStyle = hexToRgba(el.color, 0.12);
        roundRect(ctx, el.x, el.y, el.w, el.h, r); ctx.fill();
        ctx.strokeStyle = isSel ? '#6366f1' : el.color;
        ctx.lineWidth = isSel ? 3 : 1.5;
        roundRect(ctx, el.x, el.y, el.w, el.h, r); ctx.stroke();

        const ff = el.fontFamily || '"PingFang SC", sans-serif';
        const fw = el.fontWeight || 'bold';
        const fs = el.fontSize || 28;
        ctx.fillStyle = el.textColor || '#1e3a8a';
        ctx.font = `${fw} ${fs}px ${ff}`;
        ctx.textBaseline = 'middle';
        const align = el.textAlign || 'center';
        if (align === 'left') { ctx.textAlign = 'left'; ctx.fillText(el.textContent || el.label, el.x + 8, el.y + el.h / 2, el.w - 16); }
        else if (align === 'right') { ctx.textAlign = 'right'; ctx.fillText(el.textContent || el.label, el.x + el.w - 8, el.y + el.h / 2, el.w - 16); }
        else { ctx.textAlign = 'center'; ctx.fillText(el.textContent || el.label, el.x + el.w / 2, el.y + el.h / 2, el.w); }
      } else {
        ctx.fillStyle = hexToRgba(el.color, 0.15);
        roundRect(ctx, el.x, el.y, el.w, el.h, r); ctx.fill();
        ctx.strokeStyle = isSel ? '#6366f1' : el.color;
        ctx.lineWidth = isSel ? 3 : 1.5;
        roundRect(ctx, el.x, el.y, el.w, el.h, r); ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.fillStyle = el.color;
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(el.label, el.x + el.w / 2, el.y + el.h + 4);

      if (isSel) {
        ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
        ctx.strokeRect(el.x - 2, el.y - 2, el.w + 4, el.h + 4);
        ctx.setLineDash([]);
        const hs = 8;
        ctx.fillStyle = '#6366f1';
        [[el.x - hs / 2, el.y - hs / 2], [el.x + el.w - hs / 2, el.y - hs / 2],
         [el.x - hs / 2, el.y + el.h - hs / 2], [el.x + el.w - hs / 2, el.y + el.h - hs / 2]].forEach(([hx, hy]) => {
          ctx.fillRect(hx, hy, hs, hs);
        });
      }
      ctx.restore();
    }

    if (marquee) {
      ctx.save();
      ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.fillStyle = 'rgba(99,102,241,0.08)';
      const mx = Math.min(marquee.x1, marquee.x2), my = Math.min(marquee.y1, marquee.y2);
      const mw = Math.abs(marquee.x2 - marquee.x1), mh = Math.abs(marquee.y2 - marquee.y1);
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeRect(mx, my, mw, mh);
      ctx.restore();
    }

    // ─── Measurement overlays ───────────────────────────
    const sEls = elements.filter(e => selectedIds.includes(e.id));
    if (measureOn && sEls.length > 0) {
      ctx.save();
      const measureColor = '#e11d48';
      const dimColor = '#6366f1';
      const labelFont = 'bold 13px Inter, system-ui, sans-serif';
      const smallFont = '11px Inter, system-ui, sans-serif';

      function drawLabel(text, x, y, color, font) {
        ctx.font = font || labelFont;
        const tw = ctx.measureText(text).width;
        const pad = 4;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        roundRect(ctx, x - tw / 2 - pad, y - 8, tw + pad * 2, 16, 3);
        ctx.fill();
        ctx.fillStyle = color || measureColor;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
      }

      if (sEls.length === 1) {
        const el = sEls[0];
        const cx = el.x + el.w / 2, cy = el.y + el.h / 2;

        // Center point crosshair
        ctx.strokeStyle = measureColor; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy);
        ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = measureColor; ctx.fill();

        // Position label (top-left)
        drawLabel(`(${el.x}, ${el.y})`, el.x + el.w / 2, el.y - 22, dimColor, smallFont);

        // Size label (bottom)
        drawLabel(`${el.w} × ${el.h}`, el.x + el.w / 2, el.y + el.h + 24, dimColor, smallFont);

        // Center label
        drawLabel(`中心 (${Math.round(cx)}, ${Math.round(cy)})`, cx, cy + 18, measureColor, smallFont);

        // Dimension lines
        ctx.strokeStyle = dimColor; ctx.lineWidth = 1; ctx.setLineDash([]);
        // Width line
        const wLineY = el.y + el.h + 12;
        ctx.beginPath();
        ctx.moveTo(el.x, wLineY - 4); ctx.lineTo(el.x, wLineY + 4);
        ctx.moveTo(el.x, wLineY); ctx.lineTo(el.x + el.w, wLineY);
        ctx.moveTo(el.x + el.w, wLineY - 4); ctx.lineTo(el.x + el.w, wLineY + 4);
        ctx.stroke();
        // Height line
        const hLineX = el.x - 12;
        ctx.beginPath();
        ctx.moveTo(hLineX - 4, el.y); ctx.lineTo(hLineX + 4, el.y);
        ctx.moveTo(hLineX, el.y); ctx.lineTo(hLineX, el.y + el.h);
        ctx.moveTo(hLineX - 4, el.y + el.h); ctx.lineTo(hLineX + 4, el.y + el.h);
        ctx.stroke();
        drawLabel(`${el.h}`, hLineX, el.y + el.h / 2, dimColor, smallFont);
      }

      if (sEls.length >= 2) {
        // Show gaps between adjacent elements (horizontal)
        const sortedH = [...sEls].sort((a, b) => a.x - b.x);
        for (let i = 0; i < sortedH.length - 1; i++) {
          const a = sortedH[i], b = sortedH[i + 1];
          const gapX = b.x - (a.x + a.w);
          if (gapX < 0) continue;
          const lineY = Math.max(a.y, b.y) + Math.min(a.h, b.h) / 2;
          const x1 = a.x + a.w, x2 = b.x;
          ctx.strokeStyle = measureColor; ctx.lineWidth = 1.5; ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(x1, lineY - 6); ctx.lineTo(x1, lineY + 6);
          ctx.moveTo(x1, lineY); ctx.lineTo(x2, lineY);
          ctx.moveTo(x2, lineY - 6); ctx.lineTo(x2, lineY + 6);
          ctx.stroke();
          // Arrow heads
          ctx.beginPath();
          ctx.moveTo(x1, lineY); ctx.lineTo(x1 + 5, lineY - 3); ctx.lineTo(x1 + 5, lineY + 3); ctx.closePath();
          ctx.fillStyle = measureColor; ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x2, lineY); ctx.lineTo(x2 - 5, lineY - 3); ctx.lineTo(x2 - 5, lineY + 3); ctx.closePath();
          ctx.fill();
          if (gapX > 20) drawLabel(`${gapX}`, (x1 + x2) / 2, lineY - 14, measureColor, smallFont);
        }

        // Show gaps between adjacent elements (vertical)
        const sortedV = [...sEls].sort((a, b) => a.y - b.y);
        for (let i = 0; i < sortedV.length - 1; i++) {
          const a = sortedV[i], b = sortedV[i + 1];
          const gapY = b.y - (a.y + a.h);
          if (gapY < 0) continue;
          const lineX = Math.max(a.x, b.x) + Math.min(a.w, b.w) / 2;
          const y1 = a.y + a.h, y2 = b.y;
          ctx.strokeStyle = measureColor; ctx.lineWidth = 1.5; ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(lineX - 6, y1); ctx.lineTo(lineX + 6, y1);
          ctx.moveTo(lineX, y1); ctx.lineTo(lineX, y2);
          ctx.moveTo(lineX - 6, y2); ctx.lineTo(lineX + 6, y2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(lineX, y1); ctx.lineTo(lineX - 3, y1 + 5); ctx.lineTo(lineX + 3, y1 + 5); ctx.closePath();
          ctx.fillStyle = measureColor; ctx.fill();
          ctx.beginPath();
          ctx.moveTo(lineX, y2); ctx.lineTo(lineX - 3, y2 - 5); ctx.lineTo(lineX + 3, y2 - 5); ctx.closePath();
          ctx.fill();
          if (gapY > 20) drawLabel(`${gapY}`, lineX + 20, (y1 + y2) / 2, measureColor, smallFont);
        }

        // Show each element's position + size as compact labels
        for (const el of sEls) {
          drawLabel(`(${el.x}, ${el.y}) ${el.w}×${el.h}`, el.x + el.w / 2, el.y - 16, dimColor, smallFont);
        }
      }

      ctx.restore();
    }
  }

  function drawFixedElements(ctx) {
    const cp = canvasPresetData;
    ctx.save();

    if (cp?.elements?.length) {
      for (const el of cp.elements) {
        ctx.save();
        ctx.globalAlpha = el.opacity ?? 1;

        if (el.type === 'backBtn') {
          ctx.fillStyle = 'rgba(100,116,139,0.15)';
          roundRect(ctx, el.x - 5, el.y - 5, el.w + 10, el.h + 10, 6); ctx.fill();
          ctx.fillStyle = '#64748b';
          ctx.beginPath(); ctx.moveTo(el.x + 20, el.y + 2); ctx.lineTo(el.x + 4, el.y + el.h / 2); ctx.lineTo(el.x + 20, el.y + el.h - 2); ctx.closePath(); ctx.fill();
          ctx.font = '12px system-ui'; ctx.fillText('返回', el.x + 24, el.y + el.h / 2 + 4);
        } else if (el.type === 'progressBar') {
          ctx.fillStyle = '#e5e7eb'; roundRect(ctx, el.x, el.y, el.w, el.h, el.h / 2); ctx.fill();
          ctx.fillStyle = el.color || '#22c55e'; roundRect(ctx, el.x, el.y, el.w * 0.4, el.h, el.h / 2); ctx.fill();
          ctx.fillStyle = '#64748b'; ctx.font = '11px system-ui'; ctx.fillText('1 / 5', el.x + el.w + 10, el.y + el.h);
        } else if (el.type === 'bottomPill') {
          ctx.fillStyle = el.color || '#1e293b'; roundRect(ctx, el.x, el.y, el.w, el.h, el.h / 2); ctx.fill();
        } else if (el.type === 'text') {
          ctx.fillStyle = hexToRgba(el.color || '#f59e0b', 0.08);
          roundRect(ctx, el.x, el.y, el.w, el.h, el.borderRadius || 0); ctx.fill();
          ctx.strokeStyle = hexToRgba(el.color || '#f59e0b', 0.3); ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
          ctx.strokeRect(el.x, el.y, el.w, el.h); ctx.setLineDash([]);
          ctx.font = `${el.fontWeight || 'normal'} ${el.fontSize || 24}px ${el.fontFamily || 'system-ui'}`;
          ctx.fillStyle = el.textColor || '#333'; ctx.textBaseline = 'middle'; ctx.textAlign = el.textAlign || 'center';
          const tx = el.textAlign === 'left' ? el.x + 8 : el.textAlign === 'right' ? el.x + el.w - 8 : el.x + el.w / 2;
          ctx.fillText(el.textContent || '', tx, el.y + el.h / 2, el.w - 16);
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        } else if (el.type === 'circle') {
          ctx.fillStyle = hexToRgba(el.color || '#3b82f6', 0.15);
          ctx.strokeStyle = hexToRgba(el.color || '#3b82f6', 0.6); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(el.x + el.w / 2, el.y + el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (el.type === 'rect') {
          ctx.fillStyle = hexToRgba(el.color || '#6366f1', 0.15);
          ctx.strokeStyle = hexToRgba(el.color || '#6366f1', 0.6); ctx.lineWidth = 1.5;
          roundRect(ctx, el.x, el.y, el.w, el.h, el.borderRadius || 0); ctx.fill(); ctx.stroke();
        } else if (el.type === 'image' && el.src) {
          ctx.fillStyle = '#e5e7eb';
          roundRect(ctx, el.x, el.y, el.w, el.h, el.borderRadius || 0); ctx.fill();
        }

        if (el.label && !['backBtn', 'progressBar', 'bottomPill', 'text'].includes(el.type)) {
          ctx.fillStyle = hexToRgba(el.color || '#666', 0.5); ctx.font = '12px system-ui'; ctx.textAlign = 'center';
          ctx.fillText(el.label, el.x + el.w / 2, el.y + el.h / 2 + 4); ctx.textAlign = 'left';
        }

        ctx.restore();
      }
    } else {
      ctx.fillStyle = '#ccc';
      ctx.beginPath(); ctx.moveTo(72, 80); ctx.lineTo(58, 88); ctx.lineTo(72, 96); ctx.closePath(); ctx.fill();
      const barX = 440, barY = 78, barW = 240, barH = 8;
      ctx.fillStyle = '#e5e7eb'; roundRect(ctx, barX, barY, barW, barH, 4); ctx.fill();
      ctx.fillStyle = '#22c55e'; roundRect(ctx, barX, barY, barW * 0.35, barH, 4); ctx.fill();
      const pillW = 160, pillH = 6, pillX = CANVAS_W / 2 - pillW / 2, pillY = safeBottom + 60;
      ctx.fillStyle = '#1e293b'; roundRect(ctx, pillX, pillY, pillW, pillH, 3); ctx.fill();
    }

    ctx.restore();
  }

  // ─── Pointer events ───────────────────────────────────
  function canvasXY(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }

  function hitTest(mx, my) {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (mx >= el.x && mx <= el.x + el.w && my >= el.y && my <= el.y + el.h) return el;
    }
    return null;
  }

  function hitHandle(mx, my) {
    for (const id of selectedIds) {
      const el = elements.find(e => e.id === id);
      if (!el) continue;
      const hs = 12;
      const handles = [
        { pos: 'se', cx: el.x + el.w, cy: el.y + el.h },
        { pos: 'sw', cx: el.x, cy: el.y + el.h },
        { pos: 'ne', cx: el.x + el.w, cy: el.y },
        { pos: 'nw', cx: el.x, cy: el.y },
      ];
      for (const h of handles) {
        if (Math.abs(mx - h.cx) < hs && Math.abs(my - h.cy) < hs)
          return { id: el.id, handle: h.pos, origX: el.x, origY: el.y, origW: el.w, origH: el.h, startX: mx, startY: my };
      }
    }
    return null;
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
    if (locked) return;
    const { x, y } = canvasXY(e);

    const lineThreshold = 8;
    if (Math.abs(y - safeTop) < lineThreshold) { setDraggingLine('top'); return; }
    if (Math.abs(y - safeBottom) < lineThreshold) { setDraggingLine('bottom'); return; }

    const handle = hitHandle(x, y);
    if (handle) { setResizing(handle); return; }

    const hit = hitTest(x, y);

    if (hit) {
      if (e.shiftKey) {
        setSelectedIds(prev => prev.includes(hit.id) ? prev.filter(i => i !== hit.id) : [...prev, hit.id]);
      } else if (!selectedIds.includes(hit.id)) {
        setSelectedIds([hit.id]);
      }
      const dragIds = selectedIds.includes(hit.id) ? selectedIds : [hit.id];
      const offsets = {};
      for (const did of dragIds) {
        const el = elements.find(e => e.id === did);
        if (el) offsets[did] = { dx: x - el.x, dy: y - el.y };
      }
      setDragging({ ids: dragIds, offsets, anchorX: x, anchorY: y });
    } else {
      if (!e.shiftKey) setSelectedIds([]);
      setMarquee({ x1: x, y1: y, x2: x, y2: y });
    }
  }

  function onPointerMove(e) {
    if (panning) return;
    if (locked) return;
    const { x, y } = canvasXY(e);

    if (draggingLine) {
      const snapped = snap(Math.round(y), snapOn);
      if (draggingLine === 'top') setSafeTop(Math.max(0, Math.min(snapped, safeBottom - 50)));
      else setSafeBottom(Math.max(safeTop + 50, Math.min(snapped, CANVAS_H)));
      return;
    }

    if (marquee) {
      setMarquee(prev => ({ ...prev, x2: x, y2: y }));
      return;
    }

    if (resizing) {
      const { handle, origX, origY, origW, origH, startX, startY } = resizing;
      const dx = x - startX, dy = y - startY;
      setElements(prev => prev.map(el => {
        if (el.id !== resizing.id) return el;
        let nx = origX, ny = origY, nw = origW, nh = origH;
        if (handle.includes('e')) nw = Math.max(20, origW + dx);
        if (handle.includes('w')) { nw = Math.max(20, origW - dx); nx = origX + origW - nw; }
        if (handle.includes('s')) nh = Math.max(20, origH + dy);
        if (handle.includes('n')) { nh = Math.max(20, origH - dy); ny = origY + origH - nh; }
        return { ...el, x: snap(nx, snapOn), y: snap(ny, snapOn), w: snap(nw, snapOn), h: snap(nh, snapOn) };
      }));
      return;
    }

    if (dragging) {
      const { ids, offsets, anchorX, anchorY } = dragging;
      const rawDx = x - anchorX, rawDy = y - anchorY;
      setElements(prev => prev.map(el => {
        if (!ids.includes(el.id)) return el;
        const off = offsets[el.id] || { dx: 0, dy: 0 };
        const nx = snap(clamp(x - off.dx, 0, CANVAS_W - el.w), snapOn);
        const ny = snap(clamp(y - off.dy, 0, CANVAS_H - el.h), snapOn);
        return { ...el, x: nx, y: ny };
      }));
    }
  }

  function onPointerUp() {
    if (locked) return;
    if (draggingLine) { setDraggingLine(null); return; }
    if (marquee) {
      const mx1 = Math.min(marquee.x1, marquee.x2), my1 = Math.min(marquee.y1, marquee.y2);
      const mx2 = Math.max(marquee.x1, marquee.x2), my2 = Math.max(marquee.y1, marquee.y2);
      if (mx2 - mx1 > 5 || my2 - my1 > 5) {
        const hit = elements.filter(el =>
          el.x < mx2 && el.x + el.w > mx1 && el.y < my2 && el.y + el.h > my1
        ).map(el => el.id);
        setSelectedIds(hit);
      }
      setMarquee(null);
    }
    if (dragging || resizing) {
      pushHistory(elements);
    }
    setDragging(null);
    setResizing(null);
  }

  // ─── Element operations ────────────────────────────────
  function addElement(presetKey) {
    const p = ELEMENT_PRESETS[presetKey];
    const el = {
      id: uid(), presetKey, label: p.label, type: p.type, color: p.color,
      x: snap(CANVAS_W / 2 - p.w / 2, snapOn), y: snap(safeTop + (safeBottom - safeTop) / 2 - p.h / 2, snapOn),
      w: p.w, h: p.h,
      borderRadius: p.type === 'circle' ? { tl: 0, tr: 0, br: 0, bl: 0 } : p.type === 'text' ? { tl: 6, tr: 6, br: 6, bl: 6 } : { tl: 10, tr: 10, br: 10, bl: 10 },
      opacity: 1,
      ...(p.type === 'text' ? {
        textContent: '示例文字', fontSize: 28, textColor: '#1e3a8a',
        fontFamily: '"PingFang SC", sans-serif', fontWeight: 'bold', textAlign: 'center',
      } : {}),
    };
    const next = [...elements, el];
    commitElements(next);
    setSelectedIds([el.id]);
  }

  function deleteSelected() {
    if (selectedIds.length === 0) return;
    commitElements(elements.filter(el => !selectedIds.includes(el.id)));
    setSelectedIds([]);
  }

  function duplicateSelected() {
    if (selEls.length === 0) return;
    const dups = selEls.map(el => ({ ...el, id: uid(), x: el.x + 20, y: el.y + 20 }));
    const next = [...elements, ...dups];
    commitElements(next);
    setSelectedIds(dups.map(d => d.id));
  }

  function updateSelected(patch) {
    commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, ...patch } : el));
  }

  // ─── Z-order ───────────────────────────────────────────
  function bringToFront() {
    const rest = elements.filter(el => !selectedIds.includes(el.id));
    commitElements([...rest, ...selEls]);
  }
  function sendToBack() {
    const rest = elements.filter(el => !selectedIds.includes(el.id));
    commitElements([...selEls, ...rest]);
  }

  // ─── Grouping ─────────────────────────────────────────
  function groupSelected() {
    if (selEls.length < 2) return;
    const id = gid();
    const groupName = '组 ' + id.slice(4);
    commitElements(elements.map(el =>
      selectedIds.includes(el.id) ? { ...el, groupId: id, groupName } : el
    ));
  }
  function ungroupSelected() {
    commitElements(elements.map(el =>
      selectedIds.includes(el.id) ? { ...el, groupId: undefined, groupName: undefined } : el
    ));
  }
  function selectGroup(groupId) {
    const ids = elements.filter(el => el.groupId === groupId).map(el => el.id);
    setSelectedIds(ids);
  }
  function renameGroup(groupId, newName) {
    commitElements(elements.map(el =>
      el.groupId === groupId ? { ...el, groupName: newName } : el
    ));
  }

  // ─── Alignment ─────────────────────────────────────────
  function alignLeft() {
    if (selEls.length < 2) return;
    const minX = Math.min(...selEls.map(e => e.x));
    updateSelected({ x: minX });
  }
  function alignRight() {
    if (selEls.length < 2) return;
    const maxR = Math.max(...selEls.map(e => e.x + e.w));
    commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, x: maxR - el.w } : el));
  }
  function alignCenterH() {
    if (selEls.length < 2) return;
    const minX = Math.min(...selEls.map(e => e.x));
    const maxR = Math.max(...selEls.map(e => e.x + e.w));
    const center = (minX + maxR) / 2;
    commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, x: Math.round(center - el.w / 2) } : el));
  }
  function alignTop() {
    if (selEls.length < 2) return;
    const minY = Math.min(...selEls.map(e => e.y));
    updateSelected({ y: minY });
  }
  function alignBottom() {
    if (selEls.length < 2) return;
    const maxB = Math.max(...selEls.map(e => e.y + e.h));
    commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, y: maxB - el.h } : el));
  }
  function alignCenterV() {
    if (selEls.length < 2) return;
    const minY = Math.min(...selEls.map(e => e.y));
    const maxB = Math.max(...selEls.map(e => e.y + e.h));
    const center = (minY + maxB) / 2;
    commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, y: Math.round(center - el.h / 2) } : el));
  }
  function distributeH() {
    if (selEls.length < 3) return;
    const sorted = [...selEls].sort((a, b) => a.x - b.x);
    const totalW = sorted.reduce((s, e) => s + e.w, 0);
    const span = sorted[sorted.length - 1].x + sorted[sorted.length - 1].w - sorted[0].x;
    const gap = (span - totalW) / (sorted.length - 1);
    let cx = sorted[0].x;
    const updates = {};
    for (const el of sorted) { updates[el.id] = Math.round(cx); cx += el.w + gap; }
    commitElements(elements.map(el => updates[el.id] != null ? { ...el, x: updates[el.id] } : el));
  }
  function distributeV() {
    if (selEls.length < 3) return;
    const sorted = [...selEls].sort((a, b) => a.y - b.y);
    const totalH = sorted.reduce((s, e) => s + e.h, 0);
    const span = sorted[sorted.length - 1].y + sorted[sorted.length - 1].h - sorted[0].y;
    const gap = (span - totalH) / (sorted.length - 1);
    let cy = sorted[0].y;
    const updates = {};
    for (const el of sorted) { updates[el.id] = Math.round(cy); cy += el.h + gap; }
    commitElements(elements.map(el => updates[el.id] != null ? { ...el, y: updates[el.id] } : el));
  }
  function centerCanvasH() {
    if (selEls.length === 0) return;
    const minX = Math.min(...selEls.map(e => e.x));
    const maxR = Math.max(...selEls.map(e => e.x + e.w));
    const groupW = maxR - minX;
    const offset = Math.round((CANVAS_W - groupW) / 2) - minX;
    commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, x: el.x + offset } : el));
  }
  function centerCanvasV() {
    if (selEls.length === 0) return;
    const minY = Math.min(...selEls.map(e => e.y));
    const maxB = Math.max(...selEls.map(e => e.y + e.h));
    const groupH = maxB - minY;
    const offset = Math.round((safeTop + ((safeBottom - safeTop) - groupH) / 2)) - minY;
    commitElements(elements.map(el => selectedIds.includes(el.id) ? { ...el, y: el.y + offset } : el));
  }

  // ─── Export ────────────────────────────────────────────
  function exportConfigJson() {
    const config = {
      finals: [], options: [], curtains: [], collides: [],
      normalBackgroundPictures: [], startBackgroundPictures: [], endBackgroundPictures: [],
      audioPictures: [], guidePictures: [], freeBgs: [], freeOptions: [],
      freeCollides: [], freeFinals: [], selectedImages: [], rightImages: [],
      startAnimations: [], endAnimations: [], wrongAnimations: [],
    };
    const counters = {};
    for (const el of elements) {
      const ck = CONFIG_KEY_MAP[el.presetKey];
      if (!ck || ck.startsWith('_') || !config[ck]) continue;
      const pfx = el.presetKey === 'bg_area' ? 'bg' : el.presetKey === 'audio_btn' ? 'audio' :
                  el.presetKey === 'option_image' ? 'option' : el.presetKey === 'stem_image' ? 'guide' : el.presetKey;
      counters[pfx] = (counters[pfx] || 0) + 1;
      config[ck].push({ name: `${pfx}${counters[pfx]}`, x: el.x, y: el.y, width: el.w, height: el.h });
    }
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `config_${name || 'template'}.json`; a.click();
  }

  async function handleSave() {
    const payload = { name, questionType, stemType, optionStyle, description, optionCount, variant, status, elements, canvasWidth: CANVAS_W, canvasHeight: CANVAS_H, safeTop, safeBottom, canvasPresetId, textStyle, optionStates, animationSettings: animSettings };
    const url = id && id !== 'new' ? `/api/templates/${id}` : '/api/templates';
    const method = id && id !== 'new' ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.success) navigate('/templates');
  }

  // ─── Render ────────────────────────────────────────────
  const multi = selEls.length >= 2;
  const singleTextSelected = selected?.type === 'text';

  return (
    <div ref={containerRef} tabIndex={-1} style={{ outline: 'none' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-glass btn-sm" onClick={() => navigate('/templates')}>&larr;</button>
          <ResizableField id="tpl_name" width={180}>
            <input className="glass-input" style={{ width: '100%', fontWeight: 600 }} placeholder="模板名称" value={name} onChange={e => setName(e.target.value)} />
          </ResizableField>
          <ResizableField id="tpl_qtype" width={90}>
            <select className="glass-input" style={{ width: '100%' }} value={questionType} onChange={e => setQuestionType(e.target.value)}>
              <option value="choice">选择题</option>
              <option value="connect">连线题</option>
              <option value="drag">拖拽题</option>
              <option value="hotspot">点选题</option>
              <option value="judge">判断题</option>
            </select>
          </ResizableField>
          {questionType === 'choice' && (
            <>
              <ResizableField id="tpl_stem" width={100}>
                <select className="glass-input" style={{ width: '100%' }} value={stemType} onChange={e => setStemType(e.target.value)}>
                  <option value="audio">语音题干</option>
                  <option value="text">文字题干</option>
                  <option value="image">图片题干</option>
                  <option value="free">自由操作区</option>
                </select>
              </ResizableField>
              <ResizableField id="tpl_opt" width={100}>
                <select className="glass-input" style={{ width: '100%' }} value={optionStyle} onChange={e => setOptionStyle(e.target.value)}>
                  <option value="image">图片选项</option>
                  <option value="text">文字选项</option>
                  <option value="imageText">图文选项</option>
                </select>
              </ResizableField>
            </>
          )}
          <ResizableField id="tpl_desc" width={200}>
            <input className="glass-input" style={{ width: '100%' }} placeholder="描述" value={description} onChange={e => setDescription(e.target.value)} />
          </ResizableField>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label className="snap-toggle" title="吸附网格">
            <input type="checkbox" checked={snapOn} onChange={e => setSnapOn(e.target.checked)} />
            <span style={{ fontSize: 12 }}>吸附</span>
          </label>
          <label className="snap-toggle" title="显示标注">
            <input type="checkbox" checked={measureOn} onChange={e => setMeasureOn(e.target.checked)} />
            <span style={{ fontSize: 12 }}>标注</span>
          </label>
          <label className="snap-toggle" title="显示固定UI元素（返回键/进度条等）">
            <input type="checkbox" checked={showFixedUI} onChange={e => setShowFixedUI(e.target.checked)} />
            <span style={{ fontSize: 12 }}>UI</span>
          </label>
          <label className="snap-toggle" title="锁定画布，防止误操作">
            <input type="checkbox" checked={locked} onChange={e => setLocked(e.target.checked)} />
            <span style={{ fontSize: 12, color: locked ? '#e11d48' : undefined, fontWeight: locked ? 600 : undefined }}>{locked ? '已锁定' : '锁定'}</span>
          </label>
          <button className="btn btn-glass btn-sm" onClick={undo} title="撤销 Ctrl+Z">↩</button>
          <button className="btn btn-glass btn-sm" onClick={redo} title="重做 Ctrl+Y">↪</button>
          <button className="btn btn-glass btn-sm" onClick={exportConfigJson}>导出</button>
          <button className="btn btn-glass btn-sm" onClick={() => navigate('/templates')}>取消</button>
          <button
            className="btn btn-sm"
            style={{
              background: status === 'completed' ? 'rgba(34,197,94,0.2)' : 'rgba(250,204,21,0.2)',
              border: `1px solid ${status === 'completed' ? 'rgba(34,197,94,0.4)' : 'rgba(250,204,21,0.4)'}`,
              color: status === 'completed' ? '#16a34a' : '#a16207',
              fontWeight: 600,
            }}
            onClick={() => setStatus(s => s === 'completed' ? 'draft' : 'completed')}
            title="切换模板状态"
          >{status === 'completed' ? '✓ 已完成' : '● 编辑中'}</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!name.trim()}>保存</button>
        </div>
      </div>

      <div className="editor-layout">
        {/* Sidebar */}
        <div className="editor-sidebar">
          <div className="panel-section">
            <div className="panel-section-title" onClick={() => togglePanel('addEl')}>
              <span className={`collapse-arrow ${collapsedPanels.addEl ? '' : 'open'}`}>&#9654;</span>添加元素</div>
            {!collapsedPanels.addEl && <div className="elem-toolbar">
              {Object.entries(ELEMENT_PRESETS).map(([key, p]) => (
                <button key={key} className="btn btn-glass btn-sm" onClick={() => addElement(key)}
                  style={{ borderLeftColor: p.color, borderLeftWidth: 3 }}>{p.label}</button>
              ))}
            </div>}
          </div>
          <div className="panel-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="panel-section-title" onClick={() => togglePanel('elList')}>
              <span className={`collapse-arrow ${collapsedPanels.elList ? '' : 'open'}`}>&#9654;</span>元素列表 ({elements.length})</div>
            {!collapsedPanels.elList && <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, overflowY: 'auto' }}>
              {(() => {
                const groups = {};
                const ungrouped = [];
                for (const el of elements) {
                  if (el.groupId) {
                    if (!groups[el.groupId]) groups[el.groupId] = { name: el.groupName || el.groupId, items: [] };
                    groups[el.groupId].items.push(el);
                  } else {
                    ungrouped.push(el);
                  }
                }
                const rows = [];
                const rendered = new Set();

                for (const el of elements) {
                  if (rendered.has(el.id)) continue;
                  if (el.groupId && groups[el.groupId]) {
                    const g = groups[el.groupId];
                    const gId = el.groupId;
                    if (rendered.has(gId)) continue;
                    rendered.add(gId);
                    const collapsed = collapsedGroups[gId];
                    const groupIds = g.items.map(e => e.id);
                    const allSelected = groupIds.every(i => selectedIds.includes(i));
                    rows.push(
                      <div key={`g-${gId}`}
                        style={{
                          padding: '4px 6px', borderRadius: 5, fontSize: 11.5, cursor: 'pointer',
                          background: allSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(99,102,241,0.15)',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                        onClick={() => selectGroup(gId)}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingGroupId(gId); }}
                      >
                        <span
                          style={{ fontSize: 10, width: 14, textAlign: 'center', userSelect: 'none', flexShrink: 0 }}
                          onClick={(e) => { e.stopPropagation(); setCollapsedGroups(p => ({ ...p, [gId]: !p[gId] })); }}
                        >{collapsed ? '▸' : '▾'}</span>
                        {editingGroupId === gId ? (
                          <input
                            className="glass-input"
                            style={{ flex: 1, padding: '2px 6px', fontSize: 11, fontWeight: 600 }}
                            autoFocus
                            defaultValue={g.name}
                            onClick={e => e.stopPropagation()}
                            onBlur={e => { renameGroup(gId, e.target.value || g.name); setEditingGroupId(null); }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { renameGroup(gId, e.target.value || g.name); setEditingGroupId(null); }
                              if (e.key === 'Escape') setEditingGroupId(null);
                            }}
                          />
                        ) : (
                          <span style={{ fontWeight: 600, fontSize: 11, flex: 1 }}>{g.name}</span>
                        )}
                        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{g.items.length}个</span>
                      </div>
                    );
                    if (!collapsed) {
                      for (const child of g.items) {
                        rendered.add(child.id);
                        rows.push(
                          <div key={child.id}
                            onClick={(e) => {
                              if (e.shiftKey) setSelectedIds(prev => prev.includes(child.id) ? prev.filter(i => i !== child.id) : [...prev, child.id]);
                              else setSelectedIds([child.id]);
                            }}
                            style={{
                              padding: '4px 8px 4px 24px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                              background: selectedIds.includes(child.id) ? 'var(--ice-light)' : 'transparent',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                            <span>
                              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 2, background: child.color, marginRight: 4 }} />
                              {child.label}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 9.5 }}>{child.w}×{child.h}</span>
                          </div>
                        );
                      }
                    }
                    g.items.forEach(e => rendered.add(e.id));
                  } else {
                    rendered.add(el.id);
                    rows.push(
                      <div key={el.id}
                        onClick={(e) => {
                          if (e.shiftKey) setSelectedIds(prev => prev.includes(el.id) ? prev.filter(i => i !== el.id) : [...prev, el.id]);
                          else setSelectedIds([el.id]);
                        }}
                        style={{
                          padding: '4px 8px', borderRadius: 5, fontSize: 11.5, cursor: 'pointer',
                          background: selectedIds.includes(el.id) ? 'var(--ice-light)' : 'transparent',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                        <span>
                          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: el.color, marginRight: 5 }} />
                          {el.label}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{el.x},{el.y} {el.w}×{el.h}</span>
                      </div>
                    );
                  }
                }
                return rows;
              })()}
            </div>}
          </div>
        </div>

        {/* Canvas */}
        <div className="editor-canvas-wrap" ref={wrapRef} style={{ overflow: 'hidden', position: 'relative' }}
          onPointerDown={onWrapPointerDown} onPointerMove={onWrapPointerMove}
          onPointerUp={onWrapPointerUp} onPointerLeave={onWrapPointerUp}>
          <div style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: '0 0',
            position: 'absolute', left: 0, top: 0,
            width: CANVAS_W * scale, height: CANVAS_H * scale,
          }}>
            <canvas
              ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
              style={{
                width: CANVAS_W * scale, height: CANVAS_H * scale, borderRadius: 8,
                boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
                cursor: panning ? 'grabbing' : spaceHeld ? 'grab' : locked ? 'not-allowed' : draggingLine ? 'row-resize' : dragging ? 'grabbing' : resizing ? 'nwse-resize' : marquee ? 'crosshair' : 'default',
              }}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove}
              onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
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
              title="点击重置视图 (Ctrl+0)">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={() => setScale(s => Math.min(MAX_SCALE, s * 1.2))}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>+</button>
          </div>
        </div>

        {/* Panel */}
        <div className="editor-panel">
          {/* Alignment */}
          {selectedIds.length > 0 && (
            <div className="panel-section">
              <div className="panel-section-title" onClick={() => togglePanel('align')}>
                <span className={`collapse-arrow ${collapsedPanels.align ? '' : 'open'}`}>&#9654;</span>对齐 &amp; 排列</div>
              {!collapsedPanels.align && <><div className="align-toolbar">
                <AlignIcon title="左对齐" disabled={!multi} onClick={alignLeft}
                  d="M2 1v14h1V1H2zm4 2h7v4H6V3zm0 6h5v4H6V9z" />
                <AlignIcon title="水平居中" disabled={!multi} onClick={alignCenterH}
                  d="M7.5 1v3H4v4h3.5v2H5v4h2.5v2h1v-2H11V10H8.5V8H12V4H8.5V1h-1z" />
                <AlignIcon title="右对齐" disabled={!multi} onClick={alignRight}
                  d="M13 1v14h1V1h-1zM3 3h7v4H3V3zm2 6h5v4H5V9z" />
                <span className="align-sep" />
                <AlignIcon title="上对齐" disabled={!multi} onClick={alignTop}
                  d="M1 2h14V3H1V2zm2 4v7h4V6H3zm6 0v5h4V6H9z" />
                <AlignIcon title="垂直居中" disabled={!multi} onClick={alignCenterV}
                  d="M1 7.5h3V4v0h4v3.5h2V5h4v2.5h2v1h-2V11H10V8.5H8V12H4V8.5H1v-1z" />
                <AlignIcon title="下对齐" disabled={!multi} onClick={alignBottom}
                  d="M1 13h14v1H1v-1zM3 3v7h4V3H3zm6 2v5h4V5H9z" />
                <span className="align-sep" />
                <AlignIcon title="水平分布" disabled={selEls.length < 3} onClick={distributeH}
                  d="M1 2h2v12H1V2zm6 3h2v6H7V5zm6 0h2v12h-2V2z" />
                <AlignIcon title="垂直分布" disabled={selEls.length < 3} onClick={distributeV}
                  d="M2 1v2h12V1H2zm3 6v2h6V7H5zm-3 6v2h12v-2H2z" />
                <span className="align-sep" />
                <AlignIcon title="画布水平居中" onClick={centerCanvasH}
                  d="M7 1h2v2h4v4h-4v2h3v4H9v2H7v-2H4v-4h3V7H3V3h4V1z" />
                <AlignIcon title="操作区垂直居中" onClick={centerCanvasV}
                  d="M1 7v2h2v4h4v-4h2v3h4V9h2V7h-2H4V4h4V1h2v2h4v4h-4z" />
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                <button className="btn btn-glass btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={bringToFront}>置顶</button>
                <button className="btn btn-glass btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={sendToBack}>置底</button>
                <button className="btn btn-glass btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={duplicateSelected}>复制</button>
                <button className="btn btn-danger btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={deleteSelected}>删除</button>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button className="btn btn-glass btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={groupSelected} disabled={selEls.length < 2}>编组</button>
                <button className="btn btn-glass btn-sm" style={{ flex: 1, fontSize: 11 }} onClick={ungroupSelected} disabled={!selEls.some(e => e.groupId)}>解组</button>
              </div></>}
            </div>
          )}

          {/* Properties */}
          {selected && (
            <div className="panel-section">
              <div className="panel-section-title" onClick={() => togglePanel('props')}>
                <span className={`collapse-arrow ${collapsedPanels.props ? '' : 'open'}`}>&#9654;</span>{selected.label} 属性</div>

              {!collapsedPanels.props && <><div className="prop-grid">
                <div className="prop-cell"><label>X</label><input type="number" className="glass-input" value={selected.x} onChange={e => updateSelected({ x: +e.target.value })} /></div>
                <div className="prop-cell"><label>Y</label><input type="number" className="glass-input" value={selected.y} onChange={e => updateSelected({ y: +e.target.value })} /></div>
                <div className="prop-cell"><label>W</label><input type="number" className="glass-input" value={selected.w} onChange={e => updateSelected({ w: +e.target.value })} /></div>
                <div className="prop-cell"><label>H</label><input type="number" className="glass-input" value={selected.h} onChange={e => updateSelected({ h: +e.target.value })} /></div>
              </div>

              {/* Corner radius control */}
              {(() => {
                const cr = getCornerRadii(selected);
                const allSame = cr.tl === cr.tr && cr.tr === cr.br && cr.br === cr.bl;
                const setCorner = (key, val) => {
                  const cur = getCornerRadii(selected);
                  updateSelected({ borderRadius: { ...cur, [key]: val } });
                };
                const setAllCorners = (val) => {
                  updateSelected({ borderRadius: { tl: val, tr: val, br: val, bl: val } });
                };
                return (
                  <div style={{ marginTop: 6, marginBottom: 6 }}>
                    <div className="prop-cell" style={{ marginBottom: 6 }}>
                      <label>圆角（统一）</label>
                      <input type="number" className="glass-input" min="0"
                        value={allSame ? cr.tl : ''}
                        placeholder="混合"
                        onChange={e => { if (e.target.value !== '') setAllCorners(+e.target.value); }}
                        title="统一设置四角" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px' }}>
                      <div className="prop-cell">
                        <label>↖ 左上</label>
                        <input type="number" className="glass-input" min="0" value={cr.tl} onChange={e => setCorner('tl', +e.target.value)} />
                      </div>
                      <div className="prop-cell">
                        <label>↗ 右上</label>
                        <input type="number" className="glass-input" min="0" value={cr.tr} onChange={e => setCorner('tr', +e.target.value)} />
                      </div>
                      <div className="prop-cell">
                        <label>↙ 左下</label>
                        <input type="number" className="glass-input" min="0" value={cr.bl} onChange={e => setCorner('bl', +e.target.value)} />
                      </div>
                      <div className="prop-cell">
                        <label>↘ 右下</label>
                        <input type="number" className="glass-input" min="0" value={cr.br} onChange={e => setCorner('br', +e.target.value)} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="prop-grid" style={{ marginTop: 6 }}>

                <div className="prop-cell">
                  <label>透明</label>
                  <input type="number" className="glass-input" min="0" max="1" step="0.1" value={selected.opacity ?? 1} onChange={e => updateSelected({ opacity: +e.target.value })} />
                </div>
                <div className="prop-cell">
                  <label>颜色</label>
                  <input type="color" value={selected.color} onChange={e => updateSelected({ color: e.target.value })} style={{ width: '100%', height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                </div>
                <div className="prop-cell">
                  <label>标签</label>
                  <input className="glass-input" value={selected.label} onChange={e => updateSelected({ label: e.target.value })} />
                </div>
              </div>

              {singleTextSelected && (
                <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 10 }}>
                  <div className="panel-section-title" style={{ marginBottom: 8 }}>文字属性</div>
                  <div className="panel-row">
                    <label style={{ width: 'auto' }}>内容</label>
                    <input className="glass-input" style={{ flex: 1 }} value={selected.textContent || ''} onChange={e => updateSelected({ textContent: e.target.value })} />
                  </div>
                  <div className="prop-grid" style={{ marginTop: 6 }}>
                    <div className="prop-cell">
                      <label>字号</label>
                      <input type="number" className="glass-input" min="8" value={selected.fontSize || 28} onChange={e => updateSelected({ fontSize: +e.target.value })} />
                    </div>
                    <div className="prop-cell">
                      <label>粗细</label>
                      <select className="glass-input" value={selected.fontWeight || 'bold'} onChange={e => updateSelected({ fontWeight: e.target.value })}>
                        <option value="normal">常规</option>
                        <option value="500">中等</option>
                        <option value="bold">粗体</option>
                        <option value="900">黑体</option>
                      </select>
                    </div>
                    <div className="prop-cell">
                      <label>对齐</label>
                      <select className="glass-input" value={selected.textAlign || 'center'} onChange={e => updateSelected({ textAlign: e.target.value })}>
                        <option value="left">左</option>
                        <option value="center">中</option>
                        <option value="right">右</option>
                      </select>
                    </div>
                    <div className="prop-cell">
                      <label>文字色</label>
                      <input type="color" value={selected.textColor || '#1e3a8a'} onChange={e => updateSelected({ textColor: e.target.value })}
                        style={{ width: '100%', height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                    </div>
                  </div>
                  <div className="panel-row" style={{ marginTop: 6 }}>
                    <label style={{ width: 'auto' }}>字体</label>
                    <select className="glass-input" style={{ flex: 1 }} value={selected.fontFamily || '"PingFang SC", sans-serif'} onChange={e => updateSelected({ fontFamily: e.target.value })}>
                      {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
              </>}
            </div>
          )}

          {/* Multi-select batch editing */}
          {multi && (
            <div className="panel-section">
              <div className="panel-section-title" onClick={() => togglePanel('batch')}>
                <span className={`collapse-arrow ${collapsedPanels.batch ? '' : 'open'}`}>&#9654;</span>批量操作 ({selEls.length} 个元素)</div>

              {!collapsedPanels.batch && <>{/* Batch size */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>统一尺寸</div>
                <div className="prop-grid">
                  <div className="prop-cell">
                    <label>W</label>
                    <input type="number" className="glass-input" placeholder={selEls[0].w}
                      onKeyDown={e => { if (e.key === 'Enter' && e.target.value !== '') { updateSelected({ w: +e.target.value }); } }}
                      onBlur={e => { if (e.target.value !== '') updateSelected({ w: +e.target.value }); }} />
                  </div>
                  <div className="prop-cell">
                    <label>H</label>
                    <input type="number" className="glass-input" placeholder={selEls[0].h}
                      onKeyDown={e => { if (e.key === 'Enter' && e.target.value !== '') { updateSelected({ h: +e.target.value }); } }}
                      onBlur={e => { if (e.target.value !== '') updateSelected({ h: +e.target.value }); }} />
                  </div>
                </div>
              </div>

              {/* Batch Y position */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>统一位置</div>
                <div className="prop-grid">
                  <div className="prop-cell">
                    <label>X</label>
                    <input type="number" className="glass-input" placeholder="统一"
                      onKeyDown={e => { if (e.key === 'Enter' && e.target.value !== '') { updateSelected({ x: +e.target.value }); } }}
                      onBlur={e => { if (e.target.value !== '') updateSelected({ x: +e.target.value }); }} />
                  </div>
                  <div className="prop-cell">
                    <label>Y</label>
                    <input type="number" className="glass-input" placeholder="统一"
                      onKeyDown={e => { if (e.key === 'Enter' && e.target.value !== '') { updateSelected({ y: +e.target.value }); } }}
                      onBlur={e => { if (e.target.value !== '') updateSelected({ y: +e.target.value }); }} />
                  </div>
                </div>
              </div>

              {/* Spacing / gap control */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>等间距排列</div>
                <div className="prop-grid">
                  <div className="prop-cell">
                    <label>横向间距</label>
                    <input type="number" className="glass-input" placeholder="px"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.target.value !== '') {
                          const gap = +e.target.value;
                          const sorted = [...selEls].sort((a, b) => a.x - b.x);
                          const startX = sorted[0].x;
                          commitElements(elements.map(el => {
                            const idx = sorted.findIndex(s => s.id === el.id);
                            if (idx < 0) return el;
                            let nx = startX;
                            for (let k = 0; k < idx; k++) nx += sorted[k].w + gap;
                            return { ...el, x: Math.round(nx) };
                          }));
                        }
                      }} />
                  </div>
                  <div className="prop-cell">
                    <label>纵向间距</label>
                    <input type="number" className="glass-input" placeholder="px"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.target.value !== '') {
                          const gap = +e.target.value;
                          const sorted = [...selEls].sort((a, b) => a.y - b.y);
                          const startY = sorted[0].y;
                          commitElements(elements.map(el => {
                            const idx = sorted.findIndex(s => s.id === el.id);
                            if (idx < 0) return el;
                            let ny = startY;
                            for (let k = 0; k < idx; k++) ny += sorted[k].h + gap;
                            return { ...el, y: Math.round(ny) };
                          }));
                        }
                      }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button className="btn btn-glass btn-sm" style={{ flex: 1, fontSize: 10.5 }}
                    title="以当前间距为基准，使所有选中元素横向等间距"
                    onClick={() => {
                      if (selEls.length < 2) return;
                      const sorted = [...selEls].sort((a, b) => a.x - b.x);
                      const totalSpace = (sorted[sorted.length - 1].x + sorted[sorted.length - 1].w) - sorted[0].x;
                      const totalElemW = sorted.reduce((s, e) => s + e.w, 0);
                      const gap = Math.round((totalSpace - totalElemW) / (sorted.length - 1));
                      let cx = sorted[0].x;
                      commitElements(elements.map(el => {
                        const idx = sorted.findIndex(s => s.id === el.id);
                        if (idx < 0) return el;
                        let nx = sorted[0].x;
                        for (let k = 0; k < idx; k++) nx += sorted[k].w + gap;
                        return { ...el, x: Math.round(nx) };
                      }));
                    }}>横向均分</button>
                  <button className="btn btn-glass btn-sm" style={{ flex: 1, fontSize: 10.5 }}
                    title="以当前间距为基准，使所有选中元素纵向等间距"
                    onClick={() => {
                      if (selEls.length < 2) return;
                      const sorted = [...selEls].sort((a, b) => a.y - b.y);
                      const totalSpace = (sorted[sorted.length - 1].y + sorted[sorted.length - 1].h) - sorted[0].y;
                      const totalElemH = sorted.reduce((s, e) => s + e.h, 0);
                      const gap = Math.round((totalSpace - totalElemH) / (sorted.length - 1));
                      commitElements(elements.map(el => {
                        const idx = sorted.findIndex(s => s.id === el.id);
                        if (idx < 0) return el;
                        let ny = sorted[0].y;
                        for (let k = 0; k < idx; k++) ny += sorted[k].h + gap;
                        return { ...el, y: Math.round(ny) };
                      }));
                    }}>纵向均分</button>
                </div>
              </div>

              {/* Other batch props */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>其他属性</div>
                <div className="prop-grid">
                  <div className="prop-cell">
                    <label>圆角</label>
                    <input type="number" className="glass-input" min="0" placeholder="批量"
                      onKeyDown={e => { if (e.key === 'Enter' && e.target.value !== '') updateSelected({ borderRadius: +e.target.value }); }}
                      onBlur={e => { if (e.target.value !== '') updateSelected({ borderRadius: +e.target.value }); }} />
                  </div>
                  <div className="prop-cell">
                    <label>透明</label>
                    <input type="number" className="glass-input" min="0" max="1" step="0.1" placeholder="批量"
                      onKeyDown={e => { if (e.key === 'Enter' && e.target.value !== '') updateSelected({ opacity: +e.target.value }); }}
                      onBlur={e => { if (e.target.value !== '') updateSelected({ opacity: +e.target.value }); }} />
                  </div>
                </div>
              </div>
              </>}
            </div>
          )}

          {/* Production text style */}
          <div className="panel-section">
            <div className="panel-section-title" onClick={() => togglePanel('textStyle')}>
              <span className={`collapse-arrow ${collapsedPanels.textStyle ? '' : 'open'}`}>&#9654;</span>生产文字样式</div>
            {!collapsedPanels.textStyle && <><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>选项图+文字合成时使用的字体规范</div>
            <div className="panel-row" style={{ marginBottom: 6 }}>
              <label style={{ width: 'auto', fontSize: 11 }}>字体</label>
              <select className="glass-input" style={{ flex: 1, fontSize: 11 }} value={textStyle.fontFamily}
                onChange={e => setTextStyle(s => ({ ...s, fontFamily: e.target.value }))}>
                {PRODUCTION_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="prop-grid">
              <div className="prop-cell">
                <label>字号</label>
                <input type="number" className="glass-input" min="12" value={textStyle.fontSize}
                  onChange={e => setTextStyle(s => ({ ...s, fontSize: Number(e.target.value) || 36 }))} />
              </div>
              <div className="prop-cell">
                <label>字色</label>
                <input type="color" value={textStyle.fontColor} onChange={e => setTextStyle(s => ({ ...s, fontColor: e.target.value }))}
                  style={{ width: '100%', height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
              </div>
              <div className="prop-cell">
                <label>背景色</label>
                <input type="color" value={textStyle.bgColor} onChange={e => setTextStyle(s => ({ ...s, bgColor: e.target.value }))}
                  style={{ width: '100%', height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
              </div>
              <div className="prop-cell">
                <label>对齐</label>
                <select className="glass-input" value={textStyle.align || 'center'} onChange={e => setTextStyle(s => ({ ...s, align: e.target.value }))}>
                  <option value="left">左</option>
                  <option value="center">居中</option>
                  <option value="right">右</option>
                </select>
              </div>
              <div className="prop-cell">
                <label>字间距</label>
                <input type="number" className="glass-input" min="0" max="50" value={textStyle.letterSpacing || 0}
                  onChange={e => setTextStyle(s => ({ ...s, letterSpacing: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            <div style={{ marginTop: 6, padding: '6px 8px', background: 'rgba(56,189,248,0.06)', borderRadius: 6, border: '1px solid rgba(56,189,248,0.1)' }}>
              <div style={{ fontSize: textStyle.fontSize ? Math.min(textStyle.fontSize, 18) : 14, color: textStyle.fontColor, fontWeight: 600, textAlign: textStyle.align || 'center',
                letterSpacing: `${textStyle.letterSpacing || 0}px`,
                background: textStyle.bgColor, padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)' }}>
                预览文字 ABC
              </div>
            </div></>}
          </div>

          {/* Option state borders — only for choice types */}
          {questionType === 'choice' && (
            <div className="panel-section">
              <div className="panel-section-title" onClick={() => togglePanel('optState')}>
                <span className={`collapse-arrow ${collapsedPanels.optState ? '' : 'open'}`}>&#9654;</span>选项状态边框</div>
              {!collapsedPanels.optState && <><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>单选题生产正确态 · 多选题生产选中态+正确态</div>
              <StatePanel label="选中态 (多选题)" stateKey="selected" cfg={optionStates.selected}
                onChange={(sk, k, v) => setOptionStates(prev => ({ ...prev, [sk]: { ...prev[sk], [k]: v } }))} />
              <StatePanel label="正确态" stateKey="correct" cfg={optionStates.correct}
                onChange={(sk, k, v) => setOptionStates(prev => ({ ...prev, [sk]: { ...prev[sk], [k]: v } }))} /></>}
            </div>
          )}

          {/* Animation output settings */}
          <div className="panel-section">
            <div className="panel-section-title" onClick={() => togglePanel('animOut')}>
              <span className={`collapse-arrow ${collapsedPanels.animOut ? '' : 'open'}`}>&#9654;</span>动效输出设置</div>
            {!collapsedPanels.animOut && <>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>APNG 输出质量与体积控制</div>
              <div className="prop-grid">
                <div className="prop-cell">
                  <label>帧率</label>
                  <input type="number" className="glass-input" min="5" max="30" value={animSettings.fps}
                    onChange={e => setAnimSettings(s => ({ ...s, fps: Math.max(5, Math.min(30, Number(e.target.value) || 10)) }))} />
                </div>
                <div className="prop-cell">
                  <label>颜色数</label>
                  <select className="glass-input" value={animSettings.maxColors || 256}
                    onChange={e => setAnimSettings(s => ({ ...s, maxColors: Number(e.target.value) }))}>
                    <option value="64">64 色</option>
                    <option value="128">128 色</option>
                    <option value="256">256 色</option>
                    <option value="0">不压缩</option>
                  </select>
                </div>
                {animSettings.maxColors !== 0 && (
                  <div className="prop-cell">
                    <label>抖动</label>
                    <select className="glass-input" value={animSettings.dither || 'floyd_steinberg'}
                      onChange={e => setAnimSettings(s => ({ ...s, dither: e.target.value }))}>
                      <option value="none">无</option>
                      <option value="floyd_steinberg">Floyd-Steinberg</option>
                      <option value="bayer">Bayer</option>
                    </select>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                {animSettings.maxColors === 0
                  ? '原始画质，体积较大'
                  : `${animSettings.fps}fps · ${animSettings.maxColors}色 · ${animSettings.dither === 'none' ? '无抖动' : animSettings.dither}`}
              </div>
            </>}
          </div>

          {/* Canvas preset */}
          <div className="panel-section">
            <div className="panel-section-title" onClick={() => togglePanel('canvas')}>
              <span className={`collapse-arrow ${collapsedPanels.canvas ? '' : 'open'}`}>&#9654;</span>画布预设</div>
            {!collapsedPanels.canvas && <><div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
              <select className="glass-input" style={{ flex: 1, fontSize: 11 }}
                value={canvasPresetId}
                onFocus={() => loadCanvasPresets()}
                onChange={e => { applyCanvasPreset(e.target.value); }}>
                <option value="">手动设置</option>
                {canvasPresets.map(cp => (
                  <option key={cp.id} value={cp.id}>{cp.name}{cp.isDefault ? '（默认）' : ''}</option>
                ))}
              </select>
              <button className="btn btn-glass btn-sm" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}
                onClick={() => window.open('/canvas', '_blank')}
                title="前往画布管理页面"
              >管理</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 4 }}>
              {CANVAS_W}×{CANVAS_H} | 缩放 {(scale * 100).toFixed(0)}% | 操作区 {safeBottom - safeTop}px
            </div>
            <div className="prop-grid">
              <div className="prop-cell">
                <label>上界 Y</label>
                <input type="number" className="glass-input" min="0" max={safeBottom - 50} value={safeTop}
                  onChange={e => { setSafeTop(Math.max(0, Math.min(+e.target.value, safeBottom - 50))); setCanvasPresetId(''); }} />
              </div>
              <div className="prop-cell">
                <label>下界 Y</label>
                <input type="number" className="glass-input" min={safeTop + 50} max={CANVAS_H} value={safeBottom}
                  onChange={e => { setSafeBottom(Math.max(safeTop + 50, Math.min(+e.target.value, CANVAS_H))); setCanvasPresetId(''); }} />
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              可拖拽红线调整 · 选择画布预设可自动应用安全线
            </div></>}
          </div>
        </div>
      </div>
    </div>
  );
}
