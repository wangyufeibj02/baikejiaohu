import React, { useState, useEffect, useRef, useCallback } from 'react';

const TABS = [
  { key: 'assets', label: '素材' },
  { key: 'notes', label: '笔记' },
];

const DRAG_DEAD_ZONE = 3;

export default function WorkspacePanel({ workspaceKey, onDetach, isDetached, onClose, onApplyStyle, onFillPrd }) {
  const [tab, setTab] = useState('assets');
  const [ws, setWs] = useState(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef(null);
  const canvasRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const [selectedImgs, setSelectedImgs] = useState(new Set());
  const [hoveredImg, setHoveredImg] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [resizingImg, setResizingImg] = useState(null);
  const [styleGenerating, setStyleGenerating] = useState(false);
  const [styleOpen, setStyleOpen] = useState(true);
  const [docsOpen, setDocsOpen] = useState(true);
  const [docContent, setDocContent] = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [docParsing, setDocParsing] = useState(false);
  const [fillConfirm, setFillConfirm] = useState(null);
  const [notesSplit, setNotesSplit] = useState(0.55);
  const [splitDragging, setSplitDragging] = useState(false);
  const splitContainerRef = useRef(null);
  const [assetsSplit, setAssetsSplit] = useState(0.65);
  const [assetsSplitDragging, setAssetsSplitDragging] = useState(false);
  const assetsContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const memoRef = useRef(null);

  const key = workspaceKey || 'default';

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/workspaces/${encodeURIComponent(key)}`);
      const d = await r.json();
      if (d.success) setWs(d.data);
    } catch (e) { console.error('workspace load error', e); }
    setLoading(false);
  }, [key]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (data) => {
    try {
      await fetch(`/api/workspaces/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (e) { console.error('workspace save error', e); }
  }, [key]);

  const debounceSave = useCallback((data) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(data), 800);
  }, [save]);

  const updateWs = useCallback((fn) => {
    setWs(prev => {
      const next = { ...prev };
      fn(next);
      debounceSave(next);
      return next;
    });
  }, [debounceSave]);

  // --- Paste handler: silent upload, no tab switch ---
  useEffect(() => {
    const onPaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          const fd = new FormData();
          fd.append('file', blob, `paste_${Date.now()}.png`);
          fd.append('name', `粘贴图片_${new Date().toLocaleTimeString()}`);
          try {
            const r = await fetch(`/api/workspaces/${encodeURIComponent(key)}/upload-paste`, { method: 'POST', body: fd });
            const d = await r.json();
            if (d.success) {
              setWs(prev => ({ ...prev, images: [...(prev?.images || []), d.data] }));
              showToast('已添加 1 张图片到素材');
            }
          } catch (err) { console.error('paste upload error', err); }
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [key, showToast]);

  // --- File upload ---
  const handleFileUpload = async (files) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    try {
      const r = await fetch(`/api/workspaces/${encodeURIComponent(key)}/upload`, { method: 'POST', body: fd });
      const d = await r.json();
      if (d.success) {
        setWs(prev => ({ ...prev, images: [...(prev?.images || []), ...d.data] }));
      }
    } catch (err) { console.error('upload error', err); }
  };

  const handleDocUpload = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`/api/workspaces/${encodeURIComponent(key)}/upload-doc`, { method: 'POST', body: fd });
      const d = await r.json();
      if (d.success) {
        setWs(prev => ({ ...prev, documents: [...(prev?.documents || []), d.data] }));
      }
    } catch (err) { console.error('doc upload error', err); }
  };

  const deleteImage = async (imgId) => {
    try {
      await fetch(`/api/workspaces/${encodeURIComponent(key)}/assets/${imgId}`, { method: 'DELETE' });
      setWs(prev => {
        const next = {
          ...prev,
          images: prev.images.filter(i => i.id !== imgId),
          styleImages: (prev.styleImages || []).filter(id => id !== imgId),
        };
        debounceSave(next);
        return next;
      });
      setSelectedImgs(prev => { const n = new Set(prev); n.delete(imgId); return n; });
    } catch (err) { console.error('delete error', err); }
  };

  const deleteDoc = async (docId) => {
    try {
      await fetch(`/api/workspaces/${encodeURIComponent(key)}/docs/${docId}`, { method: 'DELETE' });
      setWs(prev => ({ ...prev, documents: prev.documents.filter(d => d.id !== docId) }));
      if (docContent?.id === docId) setDocContent(null);
    } catch (err) { console.error('delete doc error', err); }
  };

  const parseDoc = async (doc) => {
    setDocLoading(true);
    try {
      const r = await fetch(`/api/workspaces/${encodeURIComponent(key)}/parse-doc/${doc.id}`);
      const d = await r.json();
      if (d.success) setDocContent({ ...d.data, id: doc.id });
      else alert('解析失败: ' + (d.error || '未知错误'));
    } catch (err) { alert('解析失败: ' + err.message); }
    setDocLoading(false);
  };

  // --- HTML5 drag for canvas movement + cross-component transfer ---
  const onImgDragStartCanvas = (e, img) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/workspace-image-url', img.url);
    e.dataTransfer.setData('text/workspace-image-name', img.name);
    e.dataTransfer.setData('text/canvas-drag-id', img.id);
    e.dataTransfer.effectAllowed = 'copyMove';
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 48; thumbCanvas.height = 48;
    const ctx = thumbCanvas.getContext('2d');
    const thumbImg = new Image(); thumbImg.src = img.url;
    ctx.drawImage(thumbImg, 0, 0, 48, 48);
    e.dataTransfer.setDragImage(thumbCanvas, 24, 24);
    setDragState({ id: img.id, ox: img.x, oy: img.y, mx: e.clientX, my: e.clientY });
  };

  const onCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragState) return;
    const dx = e.clientX - dragState.mx;
    const dy = e.clientY - dragState.my;
    setWs(prev => ({
      ...prev,
      images: prev.images.map(img =>
        img.id === dragState.id ? { ...img, x: dragState.ox + dx, y: dragState.oy + dy } : img
      ),
    }));
  };

  const onCanvasDrop = (e) => {
    e.preventDefault();
    if (dragState) {
      debounceSave(ws);
      setDragState(null);
      return;
    }
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) handleFileUpload(files);
  };

  // --- Resize ---
  const onResizeMouseDown = (e, img) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingImg({ id: img.id, mx: e.clientX, my: e.clientY, ow: img.w, oh: img.h });
  };

  useEffect(() => {
    if (!resizingImg) return;
    const onMove = (e) => {
      const dx = e.clientX - resizingImg.mx;
      const aspect = resizingImg.oh / resizingImg.ow;
      const nw = Math.max(40, resizingImg.ow + dx);
      const nh = Math.round(nw * aspect);
      setWs(prev => ({
        ...prev,
        images: prev.images.map(img =>
          img.id === resizingImg.id ? { ...img, w: nw, h: nh } : img
        ),
      }));
    };
    const onUp = () => { debounceSave(ws); setResizingImg(null); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizingImg]);

  // --- Marquee selection ---
  useEffect(() => {
    if (!marquee) return;
    document.body.style.userSelect = 'none';
    const onMove = (e) => {
      setMarquee(prev => prev ? { ...prev, cx: e.clientX, cy: e.clientY } : null);
    };
    const onUp = (e) => {
      setMarquee(prev => {
        if (prev && canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const scrollL = canvasRef.current.scrollLeft;
          const scrollT = canvasRef.current.scrollTop;
          const x1 = Math.min(prev.sx, e.clientX) - rect.left + scrollL;
          const y1 = Math.min(prev.sy, e.clientY) - rect.top + scrollT;
          const x2 = Math.max(prev.sx, e.clientX) - rect.left + scrollL;
          const y2 = Math.max(prev.sy, e.clientY) - rect.top + scrollT;
          const hits = new Set();
          for (const img of (ws?.images || [])) {
            const ix = img.x, iy = img.y, ix2 = img.x + img.w, iy2 = img.y + img.h;
            if (ix2 > x1 && ix < x2 && iy2 > y1 && iy < y2) hits.add(img.id);
          }
          if (e.shiftKey) {
            setSelectedImgs(old => { const n = new Set(old); hits.forEach(id => n.add(id)); return n; });
          } else {
            setSelectedImgs(hits);
          }
        }
        return null;
      });
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [marquee, ws?.images]);

  // --- Notes split drag ---
  useEffect(() => {
    if (!splitDragging) return;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ratio = Math.max(0.2, Math.min(0.8, (e.clientY - rect.top) / rect.height));
      setNotesSplit(ratio);
    };
    const onUp = () => { setSplitDragging(false); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [splitDragging]);

  // --- Assets split drag ---
  useEffect(() => {
    if (!assetsSplitDragging) return;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e) => {
      const container = assetsContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ratio = Math.max(0.25, Math.min(0.85, (e.clientY - rect.top) / rect.height));
      setAssetsSplit(ratio);
    };
    const onUp = () => { setAssetsSplitDragging(false); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [assetsSplitDragging]);

  // --- Style training ---
  const generateStylePrompt = async () => {
    const styleImgs = (ws?.images || []).filter(i => ws.styleImages?.includes(i.id));
    if (styleImgs.length === 0) { alert('请先在素材画布中标记风格参考图片（hover 图片后按 ★）'); return; }
    setStyleGenerating(true);
    const isSingle = styleImgs.length === 1;
    const prompt = isSingle
      ? '请用中文详细描述这张图片的画面内容和美术风格特征（构图、色调、光影、氛围、主体、场景等），100-200字，可直接用作AI绘画的画面描述。'
      : `请分析这${styleImgs.length}张图片的共同视觉风格特征，输出两部分内容，用"---"分隔：

第一行：风格关键词（10字以内的中文短语，准确概括视觉风格类型）。请参考以下分类优先匹配最接近的：
实拍类：自然纪录片实拍、人文纪实摄影、微距特写摄影
2D插画类：扁平矢量插画、水彩手绘插画、低幼可爱卡通、日系动漫插画、写实厚涂插画、线描简笔画
国风类：中国风水墨、国风工笔重彩
3D渲染类：3D写实渲染、3D卡通渲染、3D三渲二、3D低多边形、新国风三维渲染
特殊风格：剪纸拼贴风、像素复古风
如果无法精确匹配上述分类，可自行组合（如"赛博朋克3D渲染"）。
---
第二部分：风格共性描述（50-100字中文，详细分析这些图片共有的色调、光影、渲染方式、材质质感、构图特点等视觉共性，这段描述将直接用于AI生图的风格指导，不要描述具体画面内容）`;
    try {
      const r = await fetch('/api/analyze/analyze-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageUrls: styleImgs.map(i => i.url) }),
      });
      const d = await r.json();
      if (d.success && d.data?.description) {
        const text = d.data.description;
        if (!isSingle && text.includes('---')) {
          const parts = text.split('---').map(s => s.trim());
          updateWs(w => { w.styleKeyword = parts[0]; w.stylePrompt = parts[1] || ''; });
        } else {
          updateWs(w => { w.stylePrompt = text; if (!isSingle) w.styleKeyword = text; });
        }
      } else {
        alert('风格分析失败: ' + (d.error || '无结果'));
      }
    } catch (err) { alert('风格分析失败: ' + err.message); }
    setStyleGenerating(false);
  };

  const toggleStyleImage = (imgId) => {
    updateWs(w => {
      if (!w.styleImages) w.styleImages = [];
      if (w.styleImages.includes(imgId)) {
        w.styleImages = w.styleImages.filter(id => id !== imgId);
      } else {
        w.styleImages.push(imgId);
      }
    });
  };

  // --- Auto arrange (grid layout) ---
  const autoArrange = () => {
    const images = ws?.images;
    if (!images?.length) return;
    const cw = canvasRef.current?.clientWidth || 400;
    const thumbW = 140;
    const gap = 12;
    const pad = 12;
    const cols = Math.max(1, Math.floor((cw - pad) / (thumbW + gap)));
    updateWs(w => {
      w.images = w.images.map((img, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const aspect = (img.h || 140) / (img.w || 140);
        const nh = Math.round(thumbW * aspect);
        return { ...img, x: pad + col * (thumbW + gap), y: pad + row * (thumbW + gap), w: thumbW, h: nh };
      });
    });
  };

  // onImgDragStart merged into onImgDragStartCanvas above

  // --- Memo drop handler ---
  const onMemoDrop = async (e) => {
    e.preventDefault();
    const wsUrl = e.dataTransfer.getData('text/workspace-image-url');
    const wsName = e.dataTransfer.getData('text/workspace-image-name');
    const textarea = memoRef.current;
    if (wsUrl && textarea) {
      const pos = textarea.selectionStart || 0;
      const text = ws?.memo || '';
      const insert = `[图片: ${wsName || '素材'}](${wsUrl})`;
      const newText = text.slice(0, pos) + insert + text.slice(pos);
      updateWs(w => { w.memo = newText; });
      return;
    }
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) {
      await handleFileUpload(files);
      if (textarea) {
        const pos = textarea.selectionStart || 0;
        const text = ws?.memo || '';
        const insert = files.map(f => `[图片: ${f.name}]`).join(' ');
        const newText = text.slice(0, pos) + insert + text.slice(pos);
        updateWs(w => { w.memo = newText; });
      }
      showToast(`已添加 ${files.length} 张图片到素材`);
    }
  };

  if (loading) return <div style={{ padding: 20, color: '#94a3b8', textAlign: 'center' }}>加载中...</div>;

  const imgCount = ws?.images?.length || 0;
  const styleCount = ws?.styleImages?.length || 0;

  const panelStyle = {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: '#f8fafc', borderLeft: isDetached ? 'none' : '1px solid #e2e8f0',
    fontFamily: 'Inter, "PingFang SC", sans-serif', position: 'relative',
  };

  return (
    <div style={panelStyle}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          background: '#065f46', color: '#fff', padding: '6px 16px', borderRadius: 6,
          fontSize: 11, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          animation: 'fadeIn .15s', whiteSpace: 'nowrap',
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 12px',
        borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', flex: 1 }}>工作台</span>
        <span style={{ fontSize: 10, color: '#94a3b8', marginRight: 8 }}>{key}</span>
        {!isDetached && onDetach && (
          <button onClick={onDetach} title="弹出到独立窗口"
            style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, color: '#64748b', marginRight: 4 }}>
            ⇱ 弹出
          </button>
        )}
        {!isDetached && onClose && (
          <button onClick={onClose} title="关闭工作台"
            style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12, color: '#94a3b8' }}>
            ×
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: tab === t.key ? '#eff6ff' : 'transparent',
              color: tab === t.key ? '#2563eb' : '#64748b',
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
            }}>
            {t.label}{t.key === 'assets' && imgCount > 0 ? ` (${imgCount})` : ''}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ═══ Assets Tab: Canvas + Style (split) ═══ */}
        {tab === 'assets' && (
          <div ref={assetsContainerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Canvas area */}
            <div style={{ flex: assetsSplit, display: 'flex', flexDirection: 'column', minHeight: 120 }}>
              {/* Toolbar */}
              <div style={{ display: 'flex', gap: 4, padding: '6px 12px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0, alignItems: 'center' }}>
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#475569' }}>
                  上传
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple hidden
                  onChange={e => { if (e.target.files.length) { handleFileUpload(Array.from(e.target.files)); e.target.value = ''; } }} />
                <button onClick={autoArrange} title="一键整理"
                  style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#475569' }}>
                  整理
                </button>
                {selectedImgs.size > 0 && (
                  <>
                    <button onClick={() => {
                      updateWs(w => { selectedImgs.forEach(id => { if (!w.styleImages) w.styleImages = []; if (!w.styleImages.includes(id)) w.styleImages.push(id); }); });
                    }} title="批量标记风格"
                      style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #f59e0b', borderRadius: 4, background: '#fffbeb', cursor: 'pointer', color: '#b45309' }}>
                      ★ 标记
                    </button>
                    <button onClick={() => {
                      if (!confirm(`确定删除 ${selectedImgs.size} 张图片？`)) return;
                      selectedImgs.forEach(id => deleteImage(id));
                      setSelectedImgs(new Set());
                    }} title="批量删除"
                      style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #fca5a5', borderRadius: 4, background: '#fef2f2', cursor: 'pointer', color: '#dc2626' }}>
                      删除
                    </button>
                  </>
                )}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: '#94a3b8' }}>
                  {selectedImgs.size > 0 ? `选中 ${selectedImgs.size} · ` : ''}{imgCount} 张{styleCount > 0 ? ` · ${styleCount} 风格` : ''} · Shift多选
                </span>
              </div>

              {/* Free canvas */}
              <div ref={canvasRef}
                style={{
                  flex: 1, position: 'relative', overflow: 'auto',
                  background: '#fff',
                  backgroundImage: 'radial-gradient(circle, #e2e8f0 0.5px, transparent 0.5px)',
                  backgroundSize: '16px 16px',
                  cursor: dragState ? 'grabbing' : 'default',
                  minHeight: 80,
                }}
                onMouseDown={e => {
                  if (e.button !== 0 || e.target !== canvasRef.current) return;
                  if (!e.shiftKey) setSelectedImgs(new Set());
                  setMarquee({ sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY });
                }}
                onDragOver={onCanvasDragOver}
                onDrop={onCanvasDrop}
                onDragEnd={() => {
                  if (dragState) {
                    setWs(prev => ({
                      ...prev,
                      images: prev.images.map(img =>
                        img.id === dragState.id ? { ...img, x: dragState.ox, y: dragState.oy } : img
                      ),
                    }));
                    setDragState(null);
                  }
                }}
              >
                {(ws?.images || []).map(img => {
                  const isHov = hoveredImg === img.id;
                  const isStyle = ws?.styleImages?.includes(img.id);
                  const isSel = selectedImgs.has(img.id);
                  return (
                    <div key={img.id}
                      onMouseEnter={() => setHoveredImg(img.id)}
                      onMouseLeave={() => setHoveredImg(null)}
                      draggable
                      onDragStart={e => onImgDragStartCanvas(e, img)}
                      style={{
                        position: 'absolute', left: img.x, top: img.y,
                        width: img.w, height: img.h,
                        border: isSel ? '2px solid #2563eb' : isStyle ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                        borderRadius: 6, overflow: 'visible', cursor: 'grab',
                        boxShadow: isSel ? '0 0 0 2px rgba(37,99,235,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
                        background: '#fff',
                      }}
                      onMouseDown={e => {
                        if (e.button !== 0) return;
                        if (e.shiftKey) {
                          setSelectedImgs(prev => {
                            const next = new Set(prev);
                            if (next.has(img.id)) next.delete(img.id); else next.add(img.id);
                            return next;
                          });
                          return;
                        }
                        if (!selectedImgs.has(img.id)) setSelectedImgs(new Set());
                      }}
                    >
                      <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 5 }}>
                        <img src={img.url} alt={img.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }}
                          draggable={false} />
                      </div>
                      {isStyle && (
                        <div style={{ position: 'absolute', top: 2, left: 2, background: '#f59e0b', color: '#fff', fontSize: 8, padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>风格</div>
                      )}
                      {isSel && (
                        <div style={{ position: 'absolute', top: 3, left: 3, width: 14, height: 14, borderRadius: 3, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>
                        </div>
                      )}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2px 4px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                        color: '#fff', fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        borderRadius: '0 0 5px 5px',
                      }}>{img.name}</div>
                      {isHov && (
                        <div style={{ position: 'absolute', top: -4, right: -4, display: 'flex', gap: 2, zIndex: 5 }}>
                          <button onClick={e => { e.stopPropagation(); e.preventDefault(); toggleStyleImage(img.id); }}
                            onMouseDown={e => e.stopPropagation()}
                            title={isStyle ? '取消风格参考' : '标记为风格参考'}
                            style={{ width: 22, height: 22, border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, cursor: 'pointer', fontSize: 10, background: isStyle ? '#f59e0b' : 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>★</button>
                          <button onClick={e => { e.stopPropagation(); e.preventDefault(); deleteImage(img.id); }}
                            onMouseDown={e => e.stopPropagation()}
                            title="删除"
                            style={{ width: 22, height: 22, border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, cursor: 'pointer', fontSize: 13, background: 'rgba(239,68,68,0.85)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {imgCount === 0 && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#94a3b8', fontSize: 13, flexDirection: 'column', gap: 8, pointerEvents: 'none',
                  }}>
                    <div style={{ fontSize: 32, opacity: 0.3 }}>🖼</div>
                    <div>拖拽图片到此处，或 Ctrl+V 粘贴</div>
                  </div>
                )}
                {marquee && canvasRef.current && (() => {
                  const rect = canvasRef.current.getBoundingClientRect();
                  const x = Math.min(marquee.sx, marquee.cx) - rect.left + canvasRef.current.scrollLeft;
                  const y = Math.min(marquee.sy, marquee.cy) - rect.top + canvasRef.current.scrollTop;
                  const w = Math.abs(marquee.cx - marquee.sx);
                  const h = Math.abs(marquee.cy - marquee.sy);
                  if (w < 3 && h < 3) return null;
                  return <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, border: '1px solid #2563eb', background: 'rgba(37,99,235,0.08)', borderRadius: 2, pointerEvents: 'none', zIndex: 50 }} />;
                })()}
              </div>
            </div>

            {/* Drag split bar between canvas and style */}
            <div
              onMouseDown={e => { e.preventDefault(); setAssetsSplitDragging(true); }}
              style={{
                height: 6, cursor: 'row-resize',
                background: assetsSplitDragging ? '#2563eb' : '#e2e8f0',
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: assetsSplitDragging ? 'none' : 'background .15s',
              }}
              onMouseEnter={e => { if (!assetsSplitDragging) e.currentTarget.style.background = '#94a3b8'; }}
              onMouseLeave={e => { if (!assetsSplitDragging) e.currentTarget.style.background = '#e2e8f0'; }}
            >
              <div style={{ width: 32, height: 2, background: assetsSplitDragging ? '#fff' : '#94a3b8', borderRadius: 1, transition: assetsSplitDragging ? 'none' : 'background .15s' }} />
            </div>

            {/* Style section */}
            <div style={{ flex: 1 - assetsSplit, display: 'flex', flexDirection: 'column', minHeight: 40, overflow: 'hidden', background: '#fafbfc' }}>
              <div onClick={() => setStyleOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
                <span style={{ fontSize: 9, marginRight: 6, transition: 'transform .15s', transform: styleOpen ? 'rotate(90deg)' : '' }}>▶</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', flex: 1 }}>风格训练</span>
                {styleCount > 0 && <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 600 }}>{styleCount} 张参考</span>}
              </div>
              {styleOpen && (
                <div style={{ padding: '4px 12px 10px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(ws?.images || []).filter(i => ws?.styleImages?.includes(i.id)).map(img => (
                      <div key={img.id} style={{ width: 48, height: 48, borderRadius: 4, overflow: 'visible', border: '2px solid #f59e0b', flexShrink: 0, position: 'relative' }}>
                        <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2 }} />
                        <button onClick={() => toggleStyleImage(img.id)} title="取消风格参考"
                          style={{ position: 'absolute', top: -5, right: -5, width: 14, height: 14, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>×</button>
                      </div>
                    ))}
                    {styleCount === 0 && <span style={{ color: '#94a3b8', fontSize: 10 }}>hover 画布图片按 ★ 标记，或框选后批量标记</span>}
                  </div>
                  <button onClick={generateStylePrompt} disabled={styleGenerating}
                    style={{
                      padding: '6px 0', border: 'none', borderRadius: 5, cursor: 'pointer',
                      background: styleGenerating ? '#94a3b8' : '#2563eb', color: '#fff',
                      fontSize: 11, fontWeight: 600, width: '100%',
                    }}>
                    {styleGenerating ? '分析中...' : styleCount === 1 ? '生成画面描述 (1 张)' : `分析风格 (${styleCount} 张)`}
                  </button>

                  {/* Multi-image mode: keyword + apply row */}
                  {styleCount > 1 && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        style={{
                          flex: 1, border: '1px solid #e2e8f0', borderRadius: 5, padding: '5px 8px',
                          fontSize: 12, fontWeight: 600, color: '#1e293b', outline: 'none',
                          fontFamily: '"PingFang SC", sans-serif', background: '#fff', minWidth: 0,
                        }}
                        placeholder="风格关键词（如：新国风三维渲染动画）"
                        value={ws?.styleKeyword || ''}
                        onChange={e => updateWs(w => { w.styleKeyword = e.target.value; })}
                      />
                      {onApplyStyle && (
                        <button onClick={async () => {
                          if (!ws?.styleKeyword) { alert('请先生成或填写风格关键词'); return; }
                          try {
                            await fetch('/api/styles', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name: ws.styleKeyword, description: ws.stylePrompt || '' }),
                            });
                          } catch (_) { /* ignore save error, still apply */ }
                          onApplyStyle(ws.styleKeyword, ws.stylePrompt || '');
                          showToast('已保存并应用到背景风格');
                        }}
                          style={{
                            padding: '5px 12px', border: '1px solid #059669', borderRadius: 5, cursor: 'pointer',
                            background: '#f0fdf4', color: '#059669',
                            fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                          应用 →
                        </button>
                      )}
                    </div>
                  )}

                  {/* Description textarea */}
                  <textarea
                    style={{
                      border: '1px solid #e2e8f0', borderRadius: 6, padding: 8,
                      fontSize: 11, lineHeight: 1.6, resize: 'none', outline: 'none',
                      fontFamily: '"PingFang SC", sans-serif', color: '#334155', background: '#fff',
                      flex: 1, minHeight: 50,
                    }}
                    placeholder={styleCount <= 1 ? 'AI 将生成详细画面描述...也可手动编辑' : 'AI 将生成风格共性描述...也可手动编辑'}
                    value={ws?.stylePrompt || ''}
                    onChange={e => updateWs(w => { w.stylePrompt = e.target.value; })}
                  />

                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ Notes Tab: Memo + Docs (split) ═══ */}
        {tab === 'notes' && (
          <div ref={splitContainerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Memo area */}
            <div style={{ flex: notesSplit, display: 'flex', flexDirection: 'column', padding: '8px 12px 4px', minHeight: 80 }}>
              <textarea
                ref={memoRef}
                style={{
                  flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, padding: 10,
                  fontSize: 13, lineHeight: 1.7, resize: 'none', outline: 'none',
                  fontFamily: '"PingFang SC", sans-serif', color: '#334155',
                  background: '#fff',
                }}
                placeholder="笔记、备忘、想法...  支持 Ctrl+V 粘贴图片 · 可拖入图片"
                value={ws?.memo || ''}
                onChange={e => updateWs(w => { w.memo = e.target.value; })}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={onMemoDrop}
              />
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, textAlign: 'right' }}>
                自动保存 · {ws?.memo?.length || 0} 字
              </div>
            </div>

            {/* Drag split bar */}
            <div
              onMouseDown={e => {
                e.preventDefault();
                setSplitDragging(true);
              }}
              style={{
                height: 6, cursor: 'row-resize', background: '#e2e8f0', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <div style={{ width: 32, height: 2, background: '#94a3b8', borderRadius: 1 }} />
            </div>

            {/* Docs area */}
            <div style={{ flex: 1 - notesSplit, display: 'flex', flexDirection: 'column', minHeight: 60, overflow: 'hidden' }}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                const docExts = ['.docx', '.xlsx', '.xls', '.pdf', '.md', '.txt'];
                const files = Array.from(e.dataTransfer.files);
                for (const f of files) {
                  const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
                  if (docExts.includes(ext)) {
                    handleDocUpload(f);
                  }
                }
                if (!docsOpen) setDocsOpen(true);
              }}
            >
              <div onClick={() => setDocsOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', cursor: 'pointer', userSelect: 'none', background: '#fafbfc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                <span style={{ fontSize: 9, marginRight: 6, transition: 'transform .15s', transform: docsOpen ? 'rotate(90deg)' : '' }}>▶</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', flex: 1 }}>文档</span>
                <button onClick={e => { e.stopPropagation(); docInputRef.current?.click(); }}
                  style={{ fontSize: 10, padding: '1px 6px', border: '1px solid #cbd5e1', borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#64748b' }}>
                  上传
                </button>
                <input ref={docInputRef} type="file" accept=".docx,.xlsx,.xls,.pdf,.md,.txt" hidden
                  onChange={e => { if (e.target.files[0]) { handleDocUpload(e.target.files[0]); e.target.value = ''; } }} />
                <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 6 }}>{ws?.documents?.length || 0}</span>
              </div>
              {docsOpen && (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  {/* Doc list */}
                  <div style={{ width: 130, borderRight: '1px solid #e2e8f0', overflowY: 'auto', background: '#fafbfc', flexShrink: 0 }}>
                    {(ws?.documents || []).map(doc => {
                      const extIcon = { docx: '📄', xlsx: '📊', xls: '📊', pdf: '📕', md: '📝', txt: '📃' }[doc.ext] || '📎';
                      return (
                        <div key={doc.id}
                          onClick={() => parseDoc(doc)}
                          style={{
                            padding: '6px 8px', cursor: 'pointer', fontSize: 10, borderBottom: '1px solid #f1f5f9',
                            background: docContent?.id === doc.id ? '#eff6ff' : 'transparent',
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}>
                          <span>{extIcon}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                          <button onClick={e => { e.stopPropagation(); deleteDoc(doc.id); }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0 }}>×</button>
                        </div>
                      );
                    })}
                    {(ws?.documents || []).length === 0 && (
                      <div style={{ padding: 12, color: '#94a3b8', fontSize: 10, textAlign: 'center' }}>
                        拖拽或点击上传文档
                      </div>
                    )}
                  </div>
                  {/* Doc viewer */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 10, background: '#fff' }}>
                    {docLoading && <div style={{ color: '#94a3b8', textAlign: 'center', padding: 30 }}>解析中...</div>}
                    {!docLoading && !docContent && (
                      <div style={{ color: '#94a3b8', textAlign: 'center', padding: 30, fontSize: 11 }}>
                        点击左侧文档查看
                      </div>
                    )}
                    {!docLoading && docContent && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{docContent.name}</span>
                          {onFillPrd && (
                            <button
                              disabled={docParsing}
                              onClick={async () => {
                                setDocParsing(true);
                                try {
                                  let text = docContent.content || '';
                                  if (docContent.type === 'html') {
                                    const div = document.createElement('div');
                                    div.innerHTML = text;
                                    text = div.textContent || div.innerText || '';
                                  }
                                  if (docContent.type === 'excel') {
                                    try {
                                      const sheets = JSON.parse(text);
                                      const div = document.createElement('div');
                                      div.innerHTML = Object.values(sheets).join('\n');
                                      text = div.textContent || div.innerText || '';
                                    } catch { /* use raw */ }
                                  }
                                  const r = await fetch('/api/prd/parse-doc', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ content: text }),
                                  });
                                  const d = await r.json();
                                  if (d.success && d.data?.epics) {
                                    const qCount = d.data.epics.reduce((s, e) => s + (e.questions?.length || 0), 0);
                                    setFillConfirm({ epics: d.data.epics, epicCount: d.data.epics.length, qCount });
                                  } else {
                                    alert('解析失败: ' + (d.error || '无结果'));
                                  }
                                } catch (err) { alert('解析失败: ' + err.message); }
                                setDocParsing(false);
                              }}
                              style={{
                                padding: '3px 10px', border: '1px solid #2563eb', borderRadius: 4, cursor: docParsing ? 'wait' : 'pointer',
                                background: docParsing ? '#94a3b8' : '#eff6ff', color: docParsing ? '#fff' : '#2563eb',
                                fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                              }}>
                              {docParsing ? '分析中...' : '分析填充到 PRD'}
                            </button>
                          )}
                        </div>
                        {docContent.type === 'html' && (
                          <div style={{ fontSize: 11, lineHeight: 1.8, color: '#334155' }}
                            dangerouslySetInnerHTML={{ __html: docContent.content }} />
                        )}
                        {docContent.type === 'markdown' && (
                          <pre style={{ fontSize: 11, lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap', fontFamily: '"PingFang SC", monospace' }}>
                            {docContent.content}
                          </pre>
                        )}
                        {docContent.type === 'text' && (
                          <pre style={{ fontSize: 11, lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap', fontFamily: '"PingFang SC", sans-serif' }}>
                            {docContent.content}
                          </pre>
                        )}
                        {docContent.type === 'excel' && (() => {
                          try {
                            const sheets = JSON.parse(docContent.content);
                            return Object.entries(sheets).map(([name, html]) => (
                              <div key={name} style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 3 }}>Sheet: {name}</div>
                                <div style={{ fontSize: 10, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: html }} />
                              </div>
                            ));
                          } catch { return <div>解析失败</div>; }
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Fill PRD confirmation dialog */}
      {fillConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setFillConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 12, padding: '24px 28px', width: 360,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>分析完成</div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8, marginBottom: 16 }}>
              已解析出 <b>{fillConfirm.epicCount}</b> 个 Epic，共 <b>{fillConfirm.qCount}</b> 道题目。
              <br />请选择填充方式：
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { onFillPrd(fillConfirm.epics, 'replace'); setFillConfirm(null); showToast('已替换 PRD 内容'); }}
                style={{ flex: 1, padding: '8px 0', border: '1px solid #ef4444', borderRadius: 6, cursor: 'pointer', background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
                替换现有内容
              </button>
              <button onClick={() => { onFillPrd(fillConfirm.epics, 'append'); setFillConfirm(null); showToast('已追加到 PRD'); }}
                style={{ flex: 1, padding: '8px 0', border: '1px solid #2563eb', borderRadius: 6, cursor: 'pointer', background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 600 }}>
                追加到末尾
              </button>
            </div>
            <button onClick={() => setFillConfirm(null)}
              style={{ width: '100%', marginTop: 8, padding: '6px 0', border: 'none', borderRadius: 6, cursor: 'pointer', background: '#f1f5f9', color: '#64748b', fontSize: 11 }}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
