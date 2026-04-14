import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';

const ELEMENT_PRESETS = {
  bg_area: { label: '背景', w: 1624, h: 1050, color: '#94a3b8', type: 'rect' },
  stem_image: { label: '题干图', w: 400, h: 300, color: '#0ea5e9', type: 'rect' },
  option_image: { label: '选项图', w: 230, h: 230, color: '#6366f1', type: 'rect' },
  text_label: { label: '文字标签', w: 230, h: 70, color: '#f59e0b', type: 'text' },
  audio_btn: { label: '配音按钮', w: 66, h: 66, color: '#22c55e', type: 'circle' },
  collide_zone: { label: '碰撞区', w: 230, h: 230, color: '#84cc16', type: 'rect' },
  animation_area: { label: '动效区', w: 1004, h: 554, color: '#a855f7', type: 'rect' },
  anim_cover: { label: '白边覆盖区', w: 1200, h: 554, color: '#ff0088', type: 'rect' },
};

const DEFAULT_BORDER_RADIUS = { tl: 0, tr: 0, br: 0, bl: 0 };

const DEFAULT_OPTION_STATE = {
  borderWidth: 6, borderColor: '#ffc933', borderOpacity: 1,
  borderStyle: 'solid', lineCap: 'round',
  dashLength: 12, dashGap: 6,
  borderGap: 24, borderRadius: 30,
  fillColor: '#ffc933', fillOpacity: 0,
};

const DEFAULT_CORRECT_STATE = {
  ...DEFAULT_OPTION_STATE,
  borderColor: '#00cc66', fillColor: '#00cc66', fillOpacity: 0.2,
};

const DEFAULT_TEXT_STYLE = {
  fontFamily: '方正粗圆斑马英语', fontSize: 36, fontColor: '#2f4d90',
  bgColor: '#ffffff', align: 'center', letterSpacing: 7.5,
};

const DEFAULT_ANIM_SETTINGS = {
  fps: 10, usePalette: true, maxColors: 256, dither: 'floyd_steinberg',
};

const HANDLE_SIZE = 8;
const HANDLE_POSITIONS = ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l'];

function uid() {
  return 'el_' + Math.random().toString(36).slice(2, 9);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getHandleCursors() {
  return {
    tl: 'nwse-resize', t: 'ns-resize', tr: 'nesw-resize', r: 'ew-resize',
    br: 'nwse-resize', b: 'ns-resize', bl: 'nesw-resize', l: 'ew-resize',
  };
}

function getHandleRects(el, scale) {
  const hs = HANDLE_SIZE;
  const x = el.x * scale, y = el.y * scale;
  const w = el.w * scale, h = el.h * scale;
  return {
    tl: { x: x - hs / 2, y: y - hs / 2, w: hs, h: hs },
    t:  { x: x + w / 2 - hs / 2, y: y - hs / 2, w: hs, h: hs },
    tr: { x: x + w - hs / 2, y: y - hs / 2, w: hs, h: hs },
    r:  { x: x + w - hs / 2, y: y + h / 2 - hs / 2, w: hs, h: hs },
    br: { x: x + w - hs / 2, y: y + h - hs / 2, w: hs, h: hs },
    b:  { x: x + w / 2 - hs / 2, y: y + h - hs / 2, w: hs, h: hs },
    bl: { x: x - hs / 2, y: y + h - hs / 2, w: hs, h: hs },
    l:  { x: x - hs / 2, y: y + h / 2 - hs / 2, w: hs, h: hs },
  };
}

function hitTest(px, py, rects) {
  for (const key of HANDLE_POSITIONS) {
    const r = rects[key];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return key;
  }
  return null;
}

function useSectionCollapse(key, defaultOpen = true) {
  const storageKey = `tpl-sec-${key}`;
  const [open, setOpen] = useState(() => {
    try { const v = localStorage.getItem(storageKey); return v !== null ? v === '1' : defaultOpen; }
    catch { return defaultOpen; }
  });
  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch {}
      return next;
    });
  }, [storageKey]);
  return [open, toggle];
}

function NumberInput({ value, onChange, min, max, step = 1, style }) {
  const [local, setLocal] = useState(String(value ?? ''));
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      setLocal(String(value ?? ''));
      prevValue.current = value;
    }
  }, [value]);

  const commit = useCallback(() => {
    let n = parseFloat(local);
    if (isNaN(n)) n = value ?? 0;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    const rounded = step >= 1 ? Math.round(n) : Math.round(n * 100) / 100;
    setLocal(String(rounded));
    if (rounded !== value) onChange(rounded);
  }, [local, value, onChange, min, max, step]);

  return (
    <input
      className="glass-input"
      type="text"
      value={local}
      style={style}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); }}
    />
  );
}

function ColorInput({ value, onChange }) {
  return (
    <input
      type="color"
      value={value || '#000000'}
      onChange={e => onChange(e.target.value)}
      style={{ width: 28, height: 22, padding: 0, border: '1px solid var(--glass-border)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
    />
  );
}

function SectionHeader({ title, open, onToggle }) {
  return (
    <div className="panel-section-title" onClick={onToggle}>
      <span style={{ fontSize: 10, transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
      {title}
    </div>
  );
}

function OptionStatePreview({ state, width = 120, height = 80 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    cvs.width = width * dpr;
    cvs.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const gap = state.borderGap || 0;
    const bw = state.borderWidth || 4;
    const br = state.borderRadius || 0;
    const rx = gap + bw / 2;
    const ry = gap + bw / 2;
    const rw = width - 2 * (gap + bw / 2);
    const rh = height - 2 * (gap + bw / 2);
    const r = Math.min(br, rw / 2, rh / 2);

    if (state.fillOpacity > 0) {
      ctx.globalAlpha = state.fillOpacity;
      ctx.fillStyle = state.fillColor || '#ffc933';
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, r);
      ctx.fill();
    }

    ctx.globalAlpha = state.borderOpacity ?? 1;
    ctx.strokeStyle = state.borderColor || '#ffc933';
    ctx.lineWidth = bw;
    ctx.lineCap = state.lineCap || 'round';
    if (state.borderStyle === 'dashed') {
      ctx.setLineDash([state.dashLength || 12, state.dashGap || 6]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, r);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }, [state, width, height]);

  return <canvas ref={canvasRef} style={{ width, height, borderRadius: 6, background: '#f8fafc', border: '1px solid var(--glass-border)' }} />;
}

export default function TemplateEditor() {
  const { id } = useParams();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [stateTab, setStateTab] = useState('selected');

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasDisplayW, setCanvasDisplayW] = useState(800);
  const saveTimerRef = useRef(null);
  const dragRef = useRef(null);

  const [rightPanelW, setRightPanelW] = useState(() => {
    try { return parseInt(localStorage.getItem('tpl-right-w')) || 280; } catch { return 280; }
  });
  const resizingRef = useRef(false);

  const [secElements, toggleSecElements] = useSectionCollapse('elements', true);
  const [secProps, toggleSecProps] = useSectionCollapse('props', true);
  const [secTextStyle, toggleSecTextStyle] = useSectionCollapse('textStyle', true);
  const [secOptionStates, toggleSecOptionStates] = useSectionCollapse('optionStates', true);
  const [secAnim, toggleSecAnim] = useSectionCollapse('anim', true);
  const [secCanvas, toggleSecCanvas] = useSectionCollapse('canvas', true);

  const [uniformRadius, setUniformRadius] = useState(true);

  useEffect(() => {
    fetch(`/api/templates/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setTemplate(res.data);
        else setTemplate({ id, name: '新模板', canvasWidth: 1624, canvasHeight: 1050, safeTop: 240, safeBottom: 856, elements: [], textStyle: { ...DEFAULT_TEXT_STYLE }, optionStates: { selected: { ...DEFAULT_OPTION_STATE }, correct: { ...DEFAULT_CORRECT_STATE } }, animationSettings: { ...DEFAULT_ANIM_SETTINGS } });
      })
      .catch(() => setTemplate({ id, name: '新模板', canvasWidth: 1624, canvasHeight: 1050, safeTop: 240, safeBottom: 856, elements: [], textStyle: { ...DEFAULT_TEXT_STYLE }, optionStates: { selected: { ...DEFAULT_OPTION_STATE }, correct: { ...DEFAULT_CORRECT_STATE } }, animationSettings: { ...DEFAULT_ANIM_SETTINGS } }))
      .finally(() => setLoading(false));
  }, [id]);

  const cw = template?.canvasWidth || 1624;
  const ch = template?.canvasHeight || 1050;
  const scale = canvasDisplayW / cw;
  const canvasDisplayH = ch * scale;

  const elements = template?.elements || [];
  const selectedEl = useMemo(() => elements.find(e => e.id === selectedId), [elements, selectedId]);

  const updateTemplate = useCallback((patch) => {
    setTemplate(prev => {
      if (!prev) return prev;
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setSaving(true);
        fetch(`/api/templates/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        }).finally(() => setSaving(false));
      }, 1200);
      return next;
    });
  }, [id]);

  const updateElement = useCallback((elId, patch) => {
    updateTemplate(prev => ({
      ...prev,
      elements: prev.elements.map(e => e.id === elId ? { ...e, ...patch } : e),
    }));
  }, [updateTemplate]);

  const updateGroupElements = useCallback((groupId, dx, dy, excludeId) => {
    if (!groupId) return;
    updateTemplate(prev => ({
      ...prev,
      elements: prev.elements.map(e =>
        e.groupId === groupId && e.id !== excludeId
          ? { ...e, x: e.x + dx, y: e.y + dy }
          : e
      ),
    }));
  }, [updateTemplate]);

  const addElement = useCallback((presetKey) => {
    const preset = ELEMENT_PRESETS[presetKey];
    if (!preset) return;
    const newEl = {
      id: uid(),
      presetKey,
      label: preset.label,
      type: preset.type,
      color: preset.color,
      x: Math.round((cw - preset.w) / 2),
      y: Math.round((ch - preset.h) / 2),
      w: preset.w,
      h: preset.h,
      borderRadius: { ...DEFAULT_BORDER_RADIUS },
      opacity: 1,
    };
    if (preset.type === 'text') {
      newEl.textContent = preset.label;
      newEl.fontSize = 32;
      newEl.textColor = '#2f4d90';
      newEl.fontFamily = '方正粗圆斑马英语';
    }
    updateTemplate(prev => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedId(newEl.id);
  }, [cw, ch, updateTemplate]);

  const deleteElement = useCallback((elId) => {
    updateTemplate(prev => ({
      ...prev,
      elements: prev.elements.filter(e => e.id !== elId),
    }));
    if (selectedId === elId) setSelectedId(null);
  }, [selectedId, updateTemplate]);

  const saveNow = useCallback(() => {
    if (!template) return;
    clearTimeout(saveTimerRef.current);
    setSaving(true);
    fetch(`/api/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    }).finally(() => setSaving(false));
  }, [template, id]);

  // Measure canvas container width
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const leftPanel = 200;
        const gap = 0;
        const avail = window.innerWidth - leftPanel - rightPanelW - gap - 2;
        setCanvasDisplayW(Math.max(400, avail));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [rightPanelW]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Delete' && selectedId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        deleteElement(selectedId);
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, deleteElement, saveNow]);

  // Canvas rendering
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !template) return;
    const dpr = window.devicePixelRatio || 1;
    cvs.width = canvasDisplayW * dpr;
    cvs.height = canvasDisplayH * dpr;
    const ctx = cvs.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasDisplayW, canvasDisplayH);

    // Background
    ctx.fillStyle = '#e8ecf4';
    ctx.fillRect(0, 0, canvasDisplayW, canvasDisplayH);

    // Draw elements
    for (const el of elements) {
      const sx = el.x * scale, sy = el.y * scale;
      const sw = el.w * scale, sh = el.h * scale;
      ctx.save();
      ctx.globalAlpha = el.opacity ?? 1;

      const br = el.borderRadius || DEFAULT_BORDER_RADIUS;
      const radii = [
        Math.min((br.tl || 0) * scale, sw / 2, sh / 2),
        Math.min((br.tr || 0) * scale, sw / 2, sh / 2),
        Math.min((br.br || 0) * scale, sw / 2, sh / 2),
        Math.min((br.bl || 0) * scale, sw / 2, sh / 2),
      ];

      if (el.type === 'circle') {
        const r = Math.min(sw, sh) / 2;
        ctx.fillStyle = el.color || '#ccc';
        ctx.beginPath();
        ctx.arc(sx + sw / 2, sy + sh / 2, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = el.color || '#ccc';
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, radii);
        ctx.fill();
      }

      // Label
      ctx.globalAlpha = 1;
      const labelFontSize = Math.max(9, Math.min(14, sw / 8));
      ctx.font = `600 ${labelFontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (el.type === 'text' && el.textContent) {
        ctx.fillStyle = el.textColor || '#333';
        const tfs = (el.fontSize || 32) * scale;
        ctx.font = `${el.fontWeight || 'normal'} ${Math.max(8, tfs)}px ${el.fontFamily || 'sans-serif'}`;
        ctx.fillText(el.textContent, sx + sw / 2, sy + sh / 2, sw - 4);
      } else {
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;
        ctx.fillText(el.label || el.presetKey, sx + sw / 2, sy + sh / 2, sw - 4);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // Safe zone lines
    if (template.safeTop != null) {
      const y = template.safeTop * scale;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasDisplayW, y);
      ctx.stroke();
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'left';
      ctx.fillText(`safeTop: ${template.safeTop}`, 4, y - 4);
    }
    if (template.safeBottom != null) {
      const y = template.safeBottom * scale;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasDisplayW, y);
      ctx.stroke();
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'left';
      ctx.fillText(`safeBottom: ${template.safeBottom}`, 4, y - 4);
    }
    ctx.setLineDash([]);

    // Selected element highlight
    if (selectedEl) {
      const sx = selectedEl.x * scale, sy = selectedEl.y * scale;
      const sw = selectedEl.w * scale, sh = selectedEl.h * scale;
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);

      // Resize handles
      const handles = getHandleRects(selectedEl, scale);
      for (const key of HANDLE_POSITIONS) {
        const hr = handles[key];
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.fillRect(hr.x, hr.y, hr.w, hr.h);
        ctx.strokeRect(hr.x, hr.y, hr.w, hr.h);
      }
    }
  }, [template, elements, selectedEl, scale, canvasDisplayW, canvasDisplayH]);

  // Mouse interaction on canvas
  const getCanvasPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onCanvasMouseDown = useCallback((e) => {
    const pos = getCanvasPos(e);

    // Check resize handles first
    if (selectedEl) {
      const handles = getHandleRects(selectedEl, scale);
      const handle = hitTest(pos.x, pos.y, handles);
      if (handle) {
        dragRef.current = {
          type: 'resize',
          handle,
          elId: selectedEl.id,
          startX: pos.x, startY: pos.y,
          origX: selectedEl.x, origY: selectedEl.y,
          origW: selectedEl.w, origH: selectedEl.h,
        };
        return;
      }
    }

    // Hit test elements (reverse order for top-most first)
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      const sx = el.x * scale, sy = el.y * scale;
      const sw = el.w * scale, sh = el.h * scale;
      if (pos.x >= sx && pos.x <= sx + sw && pos.y >= sy && pos.y <= sy + sh) {
        setSelectedId(el.id);
        dragRef.current = {
          type: 'move',
          elId: el.id,
          groupId: el.groupId,
          startX: pos.x, startY: pos.y,
          origX: el.x, origY: el.y,
          groupOrigPositions: el.groupId
            ? elements.filter(ge => ge.groupId === el.groupId && ge.id !== el.id).map(ge => ({ id: ge.id, x: ge.x, y: ge.y }))
            : [],
        };
        return;
      }
    }

    setSelectedId(null);
  }, [elements, selectedEl, scale, getCanvasPos]);

  const onCanvasMouseMove = useCallback((e) => {
    if (!dragRef.current) {
      // Update cursor for resize handles
      if (selectedEl && canvasRef.current) {
        const pos = getCanvasPos(e);
        const handles = getHandleRects(selectedEl, scale);
        const handle = hitTest(pos.x, pos.y, handles);
        canvasRef.current.style.cursor = handle ? getHandleCursors()[handle] : 'default';
      }
      return;
    }

    const pos = getCanvasPos(e);
    const dx = pos.x - dragRef.current.startX;
    const dy = pos.y - dragRef.current.startY;

    if (dragRef.current.type === 'move') {
      const newX = Math.round(dragRef.current.origX + dx / scale);
      const newY = Math.round(dragRef.current.origY + dy / scale);
      const elDx = newX - dragRef.current.origX;
      const elDy = newY - dragRef.current.origY;

      setTemplate(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          elements: prev.elements.map(e => {
            if (e.id === dragRef.current.elId) {
              return { ...e, x: newX, y: newY };
            }
            if (dragRef.current.groupId && e.groupId === dragRef.current.groupId && e.id !== dragRef.current.elId) {
              const orig = dragRef.current.groupOrigPositions.find(g => g.id === e.id);
              if (orig) return { ...e, x: orig.x + elDx, y: orig.y + elDy };
            }
            return e;
          }),
        };
      });
    } else if (dragRef.current.type === 'resize') {
      const { handle, origX, origY, origW, origH } = dragRef.current;
      let nx = origX, ny = origY, nw = origW, nh = origH;
      const ddx = dx / scale, ddy = dy / scale;

      if (handle.includes('l')) { nx = origX + ddx; nw = origW - ddx; }
      if (handle.includes('r')) { nw = origW + ddx; }
      if (handle.includes('t') && handle !== 'tr' && handle !== 'tl' || handle === 't') { ny = origY + ddy; nh = origH - ddy; }
      if (handle === 'tl') { nx = origX + ddx; nw = origW - ddx; ny = origY + ddy; nh = origH - ddy; }
      if (handle === 'tr') { nw = origW + ddx; ny = origY + ddy; nh = origH - ddy; }
      if (handle.includes('b') && handle !== 'bl' && handle !== 'br' || handle === 'b') { nh = origH + ddy; }
      if (handle === 'bl') { nx = origX + ddx; nw = origW - ddx; nh = origH + ddy; }
      if (handle === 'br') { nw = origW + ddx; nh = origH + ddy; }

      nw = Math.max(10, nw);
      nh = Math.max(10, nh);

      updateElement(dragRef.current.elId, {
        x: Math.round(nx), y: Math.round(ny),
        w: Math.round(nw), h: Math.round(nh),
      });
    }
  }, [selectedEl, scale, getCanvasPos, updateElement]);

  const onCanvasMouseUp = useCallback(() => {
    if (dragRef.current?.type === 'move') {
      // Trigger debounced save
      updateTemplate(prev => prev);
    }
    dragRef.current = null;
  }, [updateTemplate]);

  // Right panel resize
  const onRightResizeDown = useCallback((e) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startW = rightPanelW;

    const onMove = (me) => {
      const newW = clamp(startW - (me.clientX - startX), 220, 500);
      setRightPanelW(newW);
    };
    const onUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setRightPanelW(w => {
        try { localStorage.setItem('tpl-right-w', String(w)); } catch {}
        return w;
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [rightPanelW]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="loading-text"><div className="spinner" /> 加载模板中...</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>模板不存在</p>
        <Link to="/templates" className="btn btn-outline" style={{ marginTop: 16 }}>返回模板列表</Link>
      </div>
    );
  }

  const renderLeftPanel = () => (
    <div style={{ width: 200, minWidth: 200, height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', borderRight: '1px solid var(--glass-border)', overflow: 'hidden' }}>
      {/* Preset chips */}
      <div className="panel-section">
        <div className="panel-section-title" style={{ cursor: 'default' }}>元素预设</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Object.entries(ELEMENT_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              className="btn btn-glass btn-sm"
              onClick={() => addElement(key)}
              style={{ fontSize: 11, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: preset.color, flexShrink: 0 }} />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Element list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div className="panel-section" style={{ borderBottom: 'none' }}>
          <SectionHeader title={`元素列表 (${elements.length})`} open={secElements} onToggle={toggleSecElements} />
          {secElements && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
              {elements.map((el, idx) => (
                <div
                  key={el.id}
                  onClick={() => setSelectedId(el.id)}
                  style={{
                    padding: '4px 8px',
                    fontSize: 12,
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: selectedId === el.id ? 'rgba(79,70,229,0.1)' : 'transparent',
                    border: selectedId === el.id ? '1px solid rgba(79,70,229,0.3)' : '1px solid transparent',
                    transition: 'all 0.1s',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: el.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                    {el.label || el.presetKey}
                  </span>
                  {el.groupId && (
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.05)', padding: '0 4px', borderRadius: 3 }}>
                      {el.groupName || '组'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderElementProps = () => {
    if (!selectedEl) return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        点击画布元素进行编辑
      </div>
    );

    const br = selectedEl.borderRadius || { ...DEFAULT_BORDER_RADIUS };

    const updateBorderRadius = (corner, val) => {
      if (uniformRadius) {
        updateElement(selectedEl.id, { borderRadius: { tl: val, tr: val, br: val, bl: val } });
      } else {
        updateElement(selectedEl.id, { borderRadius: { ...br, [corner]: val } });
      }
    };

    return (
      <>
        <div className="prop-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="prop-cell">
            <label>标签</label>
            <input
              className="glass-input"
              value={selectedEl.label || ''}
              onChange={e => updateElement(selectedEl.id, { label: e.target.value })}
            />
          </div>
          <div className="prop-cell">
            <label>预设</label>
            <input className="glass-input" value={selectedEl.presetKey || ''} readOnly style={{ opacity: 0.6 }} />
          </div>
        </div>

        <div className="prop-grid" style={{ marginTop: 6 }}>
          <div className="prop-cell"><label>X</label><NumberInput value={selectedEl.x} onChange={v => updateElement(selectedEl.id, { x: v })} /></div>
          <div className="prop-cell"><label>Y</label><NumberInput value={selectedEl.y} onChange={v => updateElement(selectedEl.id, { y: v })} /></div>
          <div className="prop-cell"><label>W</label><NumberInput value={selectedEl.w} onChange={v => updateElement(selectedEl.id, { w: v })} min={1} /></div>
          <div className="prop-cell"><label>H</label><NumberInput value={selectedEl.h} onChange={v => updateElement(selectedEl.id, { h: v })} min={1} /></div>
        </div>

        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>圆角</span>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto', cursor: 'pointer' }}>
              <input type="checkbox" checked={uniformRadius} onChange={e => setUniformRadius(e.target.checked)} style={{ width: 12, height: 12 }} />
              统一
            </label>
          </div>
          {uniformRadius ? (
            <div className="prop-cell">
              <label>全</label>
              <NumberInput value={br.tl} onChange={v => updateBorderRadius('tl', v)} min={0} />
            </div>
          ) : (
            <div className="prop-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="prop-cell"><label>↖</label><NumberInput value={br.tl} onChange={v => updateBorderRadius('tl', v)} min={0} /></div>
              <div className="prop-cell"><label>↗</label><NumberInput value={br.tr} onChange={v => updateBorderRadius('tr', v)} min={0} /></div>
              <div className="prop-cell"><label>↙</label><NumberInput value={br.bl} onChange={v => updateBorderRadius('bl', v)} min={0} /></div>
              <div className="prop-cell"><label>↘</label><NumberInput value={br.br} onChange={v => updateBorderRadius('br', v)} min={0} /></div>
            </div>
          )}
        </div>

        <div className="prop-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 6 }}>
          <div className="prop-cell">
            <label>颜色</label>
            <ColorInput value={selectedEl.color} onChange={v => updateElement(selectedEl.id, { color: v })} />
          </div>
          <div className="prop-cell">
            <label>透明度</label>
            <NumberInput value={selectedEl.opacity ?? 1} onChange={v => updateElement(selectedEl.id, { opacity: v })} min={0} max={1} step={0.1} />
          </div>
        </div>

        {selectedEl.type === 'text' && (
          <div style={{ marginTop: 6 }}>
            <div className="prop-cell" style={{ marginBottom: 4 }}>
              <label>文本</label>
              <input className="glass-input" value={selectedEl.textContent || ''} onChange={e => updateElement(selectedEl.id, { textContent: e.target.value })} />
            </div>
            <div className="prop-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="prop-cell"><label>字号</label><NumberInput value={selectedEl.fontSize || 32} onChange={v => updateElement(selectedEl.id, { fontSize: v })} min={8} /></div>
              <div className="prop-cell"><label>字色</label><ColorInput value={selectedEl.textColor || '#333'} onChange={v => updateElement(selectedEl.id, { textColor: v })} /></div>
            </div>
            <div className="prop-cell" style={{ marginTop: 4 }}>
              <label>字体</label>
              <input className="glass-input" value={selectedEl.fontFamily || ''} onChange={e => updateElement(selectedEl.id, { fontFamily: e.target.value })} />
            </div>
          </div>
        )}

        {selectedEl.groupId && (
          <div className="prop-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 6 }}>
            <div className="prop-cell">
              <label>组ID</label>
              <input className="glass-input" value={selectedEl.groupId} readOnly style={{ opacity: 0.6 }} />
            </div>
            <div className="prop-cell">
              <label>组名</label>
              <input className="glass-input" value={selectedEl.groupName || ''} onChange={e => updateElement(selectedEl.id, { groupName: e.target.value })} />
            </div>
          </div>
        )}

        <button
          className="btn btn-sm"
          onClick={() => deleteElement(selectedEl.id)}
          style={{ marginTop: 8, background: 'var(--danger)', color: '#fff', width: '100%', justifyContent: 'center', fontSize: 11 }}
        >
          删除元素
        </button>
      </>
    );
  };

  const renderTextStyleSection = () => {
    const ts = template.textStyle || { ...DEFAULT_TEXT_STYLE };
    const update = (patch) => updateTemplate({ textStyle: { ...ts, ...patch } });

    return (
      <>
        <div className="prop-cell" style={{ marginBottom: 4 }}>
          <label>字体</label>
          <input className="glass-input" value={ts.fontFamily || ''} onChange={e => update({ fontFamily: e.target.value })} />
        </div>
        <div className="prop-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="prop-cell"><label>字号</label><NumberInput value={ts.fontSize || 36} onChange={v => update({ fontSize: v })} min={8} /></div>
          <div className="prop-cell"><label>字色</label><ColorInput value={ts.fontColor || '#333'} onChange={v => update({ fontColor: v })} /></div>
        </div>
        <div className="prop-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 4 }}>
          <div className="prop-cell"><label>背景色</label><ColorInput value={ts.bgColor || '#fff'} onChange={v => update({ bgColor: v })} /></div>
          <div className="prop-cell">
            <label>对齐</label>
            <select className="glass-input" value={ts.align || 'center'} onChange={e => update({ align: e.target.value })}>
              <option value="left">左</option>
              <option value="center">中</option>
              <option value="right">右</option>
            </select>
          </div>
        </div>
        <div className="prop-cell" style={{ marginTop: 4 }}>
          <label>字距</label>
          <NumberInput value={ts.letterSpacing ?? 0} onChange={v => update({ letterSpacing: v })} step={0.5} />
        </div>
      </>
    );
  };

  const renderOptionStatesSection = () => {
    const states = template.optionStates || { selected: { ...DEFAULT_OPTION_STATE }, correct: { ...DEFAULT_CORRECT_STATE } };
    const current = states[stateTab] || (stateTab === 'selected' ? { ...DEFAULT_OPTION_STATE } : { ...DEFAULT_CORRECT_STATE });

    const updateState = (patch) => {
      updateTemplate({
        optionStates: { ...states, [stateTab]: { ...current, ...patch } },
      });
    };

    return (
      <>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[['selected', '选中态'], ['correct', '正确态']].map(([key, label]) => (
            <button
              key={key}
              className={`btn btn-sm ${stateTab === key ? 'btn-primary' : 'btn-glass'}`}
              onClick={() => setStateTab(key)}
              style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
            >
              {label}
            </button>
          ))}
        </div>

        <OptionStatePreview state={current} />

        <div className="prop-grid" style={{ marginTop: 8 }}>
          <div className="prop-cell"><label>线宽</label><NumberInput value={current.borderWidth || 4} onChange={v => updateState({ borderWidth: v })} min={0} /></div>
          <div className="prop-cell"><label>线色</label><ColorInput value={current.borderColor || '#ffc933'} onChange={v => updateState({ borderColor: v })} /></div>
          <div className="prop-cell"><label>线透</label><NumberInput value={current.borderOpacity ?? 1} onChange={v => updateState({ borderOpacity: v })} min={0} max={1} step={0.1} /></div>
        </div>
        <div className="prop-grid" style={{ marginTop: 4 }}>
          <div className="prop-cell">
            <label>样式</label>
            <select className="glass-input" value={current.borderStyle || 'solid'} onChange={e => updateState({ borderStyle: e.target.value })}>
              <option value="solid">实线</option>
              <option value="dashed">虚线</option>
            </select>
          </div>
          <div className="prop-cell">
            <label>端点</label>
            <select className="glass-input" value={current.lineCap || 'round'} onChange={e => updateState({ lineCap: e.target.value })}>
              <option value="butt">平</option>
              <option value="round">圆</option>
              <option value="square">方</option>
            </select>
          </div>
          <div className="prop-cell"><label>圆角</label><NumberInput value={current.borderRadius || 0} onChange={v => updateState({ borderRadius: v })} min={0} /></div>
        </div>
        {current.borderStyle === 'dashed' && (
          <div className="prop-grid" style={{ marginTop: 4 }}>
            <div className="prop-cell"><label>线长</label><NumberInput value={current.dashLength || 12} onChange={v => updateState({ dashLength: v })} min={1} /></div>
            <div className="prop-cell"><label>间隔</label><NumberInput value={current.dashGap || 6} onChange={v => updateState({ dashGap: v })} min={1} /></div>
          </div>
        )}
        <div className="prop-grid" style={{ marginTop: 4 }}>
          <div className="prop-cell"><label>边距</label><NumberInput value={current.borderGap || 0} onChange={v => updateState({ borderGap: v })} min={0} /></div>
          <div className="prop-cell"><label>填色</label><ColorInput value={current.fillColor || '#ffc933'} onChange={v => updateState({ fillColor: v })} /></div>
          <div className="prop-cell"><label>填透</label><NumberInput value={current.fillOpacity ?? 0} onChange={v => updateState({ fillOpacity: v })} min={0} max={1} step={0.1} /></div>
        </div>
      </>
    );
  };

  const renderAnimSection = () => {
    const as = template.animationSettings || { ...DEFAULT_ANIM_SETTINGS };
    const update = (patch) => updateTemplate({ animationSettings: { ...as, ...patch } });

    return (
      <div className="prop-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="prop-cell"><label>FPS</label><NumberInput value={as.fps || 10} onChange={v => update({ fps: v })} min={5} max={30} /></div>
        <div className="prop-cell">
          <label>调色板</label>
          <select className="glass-input" value={as.usePalette ? '1' : '0'} onChange={e => update({ usePalette: e.target.value === '1' })}>
            <option value="1">开启</option>
            <option value="0">关闭</option>
          </select>
        </div>
        <div className="prop-cell"><label>色数</label><NumberInput value={as.maxColors || 256} onChange={v => update({ maxColors: v })} min={64} max={256} /></div>
        <div className="prop-cell">
          <label>抖动</label>
          <select className="glass-input" value={as.dither || 'floyd_steinberg'} onChange={e => update({ dither: e.target.value })}>
            <option value="floyd_steinberg">Floyd-Steinberg</option>
            <option value="bayer">Bayer</option>
            <option value="none">无</option>
          </select>
        </div>
      </div>
    );
  };

  const renderCanvasSection = () => (
    <div className="prop-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className="prop-cell"><label>宽</label><NumberInput value={template.canvasWidth || 1624} onChange={v => updateTemplate({ canvasWidth: v })} min={100} /></div>
      <div className="prop-cell"><label>高</label><NumberInput value={template.canvasHeight || 1050} onChange={v => updateTemplate({ canvasHeight: v })} min={100} /></div>
      <div className="prop-cell"><label>安全上</label><NumberInput value={template.safeTop ?? 240} onChange={v => updateTemplate({ safeTop: v })} min={0} /></div>
      <div className="prop-cell"><label>安全下</label><NumberInput value={template.safeBottom ?? 856} onChange={v => updateTemplate({ safeBottom: v })} min={0} /></div>
    </div>
  );

  const renderRightPanel = () => (
    <div style={{ width: rightPanelW, minWidth: rightPanelW, height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', borderLeft: '1px solid var(--glass-border)', overflow: 'hidden', position: 'relative' }}>
      {/* Resize handle */}
      <div
        onMouseDown={onRightResizeDown}
        style={{ position: 'absolute', left: -3, top: 0, width: 6, height: '100%', cursor: 'ew-resize', zIndex: 10 }}
      />

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Element properties */}
        <div className="panel-section">
          <SectionHeader title="元素属性" open={secProps} onToggle={toggleSecProps} />
          {secProps && renderElementProps()}
        </div>

        {/* Canvas settings */}
        <div className="panel-section">
          <SectionHeader title="画布设置" open={secCanvas} onToggle={toggleSecCanvas} />
          {secCanvas && renderCanvasSection()}
        </div>

        {/* Text style */}
        <div className="panel-section">
          <SectionHeader title="生产文字样式" open={secTextStyle} onToggle={toggleSecTextStyle} />
          {secTextStyle && renderTextStyleSection()}
        </div>

        {/* Option states */}
        <div className="panel-section">
          <SectionHeader title="选项状态边框" open={secOptionStates} onToggle={toggleSecOptionStates} />
          {secOptionStates && renderOptionStatesSection()}
        </div>

        {/* Animation settings */}
        <div className="panel-section">
          <SectionHeader title="动效输出设置" open={secAnim} onToggle={toggleSecAnim} />
          {secAnim && renderAnimSection()}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
        background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--glass-border)', flexShrink: 0, zIndex: 50,
      }}>
        <Link to="/templates" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: 13, whiteSpace: 'nowrap' }}>
          ← 返回模板列表
        </Link>
        <span style={{ width: 1, height: 20, background: 'var(--glass-border)' }} />
        <input
          className="glass-input"
          value={template.name || ''}
          onChange={e => updateTemplate({ name: e.target.value })}
          style={{ maxWidth: 240, fontWeight: 600, fontSize: 14 }}
          placeholder="模板名称"
        />
        <span style={{ flex: 1 }} />
        {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>保存中...</span>}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cw}×{ch} | 缩放 {(scale * 100).toFixed(0)}%</span>
        <button className="btn btn-primary btn-sm" onClick={saveNow}>保存</button>
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {renderLeftPanel()}

        {/* Canvas center */}
        <div
          ref={containerRef}
          style={{
            flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start',
            justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.03)',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: canvasDisplayW, height: canvasDisplayH,
              borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
              cursor: 'default',
            }}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
          />
        </div>

        {renderRightPanel()}
      </div>
    </div>
  );
}
