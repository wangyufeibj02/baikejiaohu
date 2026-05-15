import React, { useState, useRef, useEffect, useCallback } from 'react';

const CATEGORIES = [
  {
    name: '动效工具', icon: '✨',
    tools: [
      { id: 'video-edit', name: '视频剪辑', desc: '时间裁剪、画面裁剪、逐帧预览，一站式转APNG或转换视频格式', icon: '🎞️', accept: 'video/*' },
      { id: 'video-to-apng', name: '视频 → 动效', desc: '快速将视频转换为APNG动效图', icon: '🎬', accept: 'video/*' },
      { id: 'gif-to-apng', name: 'GIF → APNG', desc: '将GIF动图转换为APNG格式', icon: '🔄', accept: 'image/gif,.gif' },
      { id: 'apng-compress', name: 'APNG 压缩', desc: '压缩APNG动效、减小文件体积', icon: '📦', accept: 'image/png,image/apng,.png,.apng' },
    ],
  },
  {
    name: '图片处理', icon: '🖼️',
    tools: [
      { id: 'image-process', name: '图片处理', desc: '裁剪、缩放、格式转换、圆角', icon: '✂️', accept: 'image/*' },
      { id: 'image-remove-bg', name: '图片去背景', desc: '去除纯色背景，输出透明PNG', icon: '🪄', accept: 'image/*' },
      { id: 'batch-resize', name: '批量调整尺寸', desc: '批量调整多张图片到统一尺寸', icon: '📐', accept: 'image/*', multiple: true },
    ],
  },
  {
    name: '音频处理', icon: '🎵',
    tools: [
      { id: 'audio-trim', name: '音频裁剪', desc: '可视化裁剪音频片段、淡入淡出', icon: '🎧', accept: 'audio/*' },
      { id: 'audio-convert', name: '格式 + 音量', desc: '转换音频格式、调整音量', icon: '🔊', accept: 'audio/*' },
      { id: 'audio-concat', name: '音频拼接', desc: '将多个音频文件拼接为一个', icon: '🔗', accept: 'audio/*', multiple: true },
    ],
  },
];

const ALL_TOOLS = CATEGORIES.flatMap(c => c.tools);

function fmtSize(n) {
  if (!n) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}
function fmtTime(s) {
  const m = Math.floor(s / 60), sec = (s % 60).toFixed(1);
  return m > 0 ? `${m}:${sec.padStart(4, '0')}` : `${sec}s`;
}

/* ══════════════════════════════════════════
   DropZone — shared file upload component
   ══════════════════════════════════════════ */
function DropZone({ accept, multiple, files, onFiles }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const h = (e) => {
      const pasted = Array.from(e.clipboardData?.files || []);
      if (pasted.length) onFiles(multiple ? pasted : [pasted[0]]);
    };
    window.addEventListener('paste', h);
    return () => window.removeEventListener('paste', h);
  }, [onFiles, multiple]);

  const onDrop = (e) => {
    e.preventDefault(); setOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) onFiles(multiple ? dropped : [dropped[0]]);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${over ? 'var(--ice)' : 'rgba(148,163,184,0.25)'}`,
        borderRadius: 'var(--radius-sm)', padding: '28px 16px', textAlign: 'center',
        cursor: 'pointer', transition: 'all 0.2s',
        background: over ? 'var(--ice-light)' : 'var(--crystal)',
      }}
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple}
        onChange={e => { const f = Array.from(e.target.files); if (f.length) onFiles(multiple ? f : [f[0]]); e.target.value = ''; }}
        style={{ display: 'none' }} />
      {files.length === 0 ? (
        <>
          <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.7 }}>📁</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            点击上传、拖拽文件{multiple ? '（支持多选）' : ''} 或 Ctrl+V 粘贴
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13 }}>
          {files.map((f, i) => (
            <div key={i} style={{ marginBottom: 2 }}>{f.name} <span style={{ color: 'var(--text-muted)' }}>({fmtSize(f.size)})</span></div>
          ))}
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ice)', fontWeight: 500 }}>点击重新选择</div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   Waveform — simple audio waveform display
   ══════════════════════════════════════════ */
function Waveform({ file, start, end, duration, onRange }) {
  const canvasRef = useRef(null);
  const [pcm, setPcm] = useState(null);
  const dragging = useRef(null);

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const buf = await ctx.decodeAudioData(reader.result);
        setPcm(buf);
        if (onRange) onRange(0, buf.duration);
        ctx.close();
      } catch {}
    };
    reader.readAsArrayBuffer(file);
  }, [file]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !pcm) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth, h = cvs.clientHeight;
    cvs.width = w * dpr; cvs.height = h * dpr;
    const ctx = cvs.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const data = pcm.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));
    const mid = h / 2;

    const s0 = (start / pcm.duration) * w;
    const s1 = (end / pcm.duration) * w;
    ctx.fillStyle = 'rgba(74,158,245,0.10)';
    ctx.fillRect(s0, 0, s1 - s0, h);

    ctx.beginPath();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i++) {
      let mn = 1, mx = -1;
      for (let j = 0; j < step; j++) { const v = data[i * step + j] || 0; if (v < mn) mn = v; if (v > mx) mx = v; }
      ctx.moveTo(i, mid + mn * mid * 0.9);
      ctx.lineTo(i, mid + mx * mid * 0.9);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(74,158,245,0.6)';
    ctx.beginPath();
    for (let i = Math.floor(s0); i < Math.ceil(s1) && i < w; i++) {
      let mn = 1, mx = -1;
      for (let j = 0; j < step; j++) { const v = data[i * step + j] || 0; if (v < mn) mn = v; if (v > mx) mx = v; }
      ctx.moveTo(i, mid + mn * mid * 0.9);
      ctx.lineTo(i, mid + mx * mid * 0.9);
    }
    ctx.stroke();

    ctx.fillStyle = '#22c55e'; ctx.fillRect(s0 - 1.5, 0, 3, h);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(s1 - 1.5, 0, 3, h);
  }, [pcm, start, end]);

  const handleMouse = (e) => {
    const cvs = canvasRef.current;
    if (!cvs || !pcm) return;
    const rect = cvs.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = Math.max(0, Math.min(pcm.duration, (x / cvs.clientWidth) * pcm.duration));

    if (e.type === 'mousedown') {
      const midT = (start + end) / 2;
      dragging.current = t < midT ? 'start' : 'end';
    }
    if (dragging.current === 'start' && t < end) onRange(t, end);
    if (dragging.current === 'end' && t > start) onRange(start, t);
  };

  useEffect(() => {
    const up = () => { dragging.current = null; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouse} onMouseMove={e => dragging.current && handleMouse(e)}
      style={{ width: '100%', height: 80, borderRadius: 8, cursor: 'col-resize', background: '#f1f5f9', display: 'block' }}
    />
  );
}

/* ══════════════════════════════════════════
   Option input helpers
   ══════════════════════════════════════════ */
const labelSt = { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3, display: 'block' };
const inputSt = {
  width: '100%', padding: '6px 10px', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-xs)', fontSize: 13, background: 'var(--crystal)',
  outline: 'none',
};
const selectSt = { ...inputSt, cursor: 'pointer' };
const rowSt = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 };

function Opt({ label, children }) {
  return <div style={{ marginBottom: 10 }}><label style={labelSt}>{label}</label>{children}</div>;
}

/* ══════════════════════════════════════════
   Tool-specific option panels
   ══════════════════════════════════════════ */
function VideoToApngOpts({ opts, set }) {
  const u = (k, v) => set({ ...opts, [k]: v });
  return (
    <>
      <div style={rowSt}>
        <Opt label="宽度 (px)"><input style={inputSt} type="number" value={opts.width ?? 360} onChange={e => u('width', e.target.value)} /></Opt>
        <Opt label="高度 (px, 空=自动)"><input style={inputSt} type="number" value={opts.height ?? ''} placeholder="自动" onChange={e => u('height', e.target.value)} /></Opt>
      </div>
      <div style={rowSt}>
        <Opt label="帧率 (FPS)"><input style={inputSt} type="number" min={1} max={30} value={opts.fps ?? 10} onChange={e => u('fps', e.target.value)} /></Opt>
        <Opt label="最大色数"><input style={inputSt} type="number" min={8} max={256} value={opts.maxColors ?? 256} onChange={e => u('maxColors', e.target.value)} /></Opt>
      </div>
      <div style={rowSt}>
        <Opt label="圆角 (px)"><input style={inputSt} type="number" min={0} value={opts.borderRadius ?? 0} onChange={e => u('borderRadius', e.target.value)} /></Opt>
        <Opt label="循环次数 (0=无限)"><input style={inputSt} type="number" min={0} value={opts.plays ?? 0} onChange={e => u('plays', e.target.value)} /></Opt>
      </div>
    </>
  );
}

function GifToApngOpts({ opts, set }) {
  return (
    <Opt label="循环次数 (0=无限)">
      <input style={inputSt} type="number" min={0} value={opts.plays ?? 0} onChange={e => set({ ...opts, plays: e.target.value })} />
    </Opt>
  );
}

function ApngCompressOpts({ opts, set }) {
  return (
    <div style={rowSt}>
      <Opt label="最大色数 (越小越压缩)"><input style={inputSt} type="number" min={8} max={256} value={opts.maxColors ?? 128} onChange={e => set({ ...opts, maxColors: e.target.value })} /></Opt>
      <Opt label="循环次数 (0=无限)"><input style={inputSt} type="number" min={0} value={opts.plays ?? 0} onChange={e => set({ ...opts, plays: e.target.value })} /></Opt>
    </div>
  );
}

function ImageProcessOpts({ opts, set }) {
  const u = (k, v) => set({ ...opts, [k]: v });
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>裁剪 (可选)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <Opt label="X"><input style={inputSt} type="number" value={opts.cropX ?? ''} placeholder="0" onChange={e => u('cropX', e.target.value)} /></Opt>
        <Opt label="Y"><input style={inputSt} type="number" value={opts.cropY ?? ''} placeholder="0" onChange={e => u('cropY', e.target.value)} /></Opt>
        <Opt label="宽"><input style={inputSt} type="number" value={opts.cropW ?? ''} placeholder="" onChange={e => u('cropW', e.target.value)} /></Opt>
        <Opt label="高"><input style={inputSt} type="number" value={opts.cropH ?? ''} placeholder="" onChange={e => u('cropH', e.target.value)} /></Opt>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>缩放 (可选)</div>
      <div style={rowSt}>
        <Opt label="目标宽度"><input style={inputSt} type="number" value={opts.resizeW ?? ''} placeholder="不变" onChange={e => u('resizeW', e.target.value)} /></Opt>
        <Opt label="目标高度"><input style={inputSt} type="number" value={opts.resizeH ?? ''} placeholder="不变" onChange={e => u('resizeH', e.target.value)} /></Opt>
      </div>
      <div style={rowSt}>
        <Opt label="输出格式">
          <select style={selectSt} value={opts.format ?? 'png'} onChange={e => u('format', e.target.value)}>
            <option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option>
          </select>
        </Opt>
        <Opt label="质量"><input style={inputSt} type="number" min={1} max={100} value={opts.quality ?? 90} onChange={e => u('quality', e.target.value)} /></Opt>
      </div>
      <Opt label="圆角 (px)"><input style={inputSt} type="number" min={0} value={opts.borderRadius ?? 0} onChange={e => u('borderRadius', e.target.value)} /></Opt>
    </>
  );
}

function ImageRemoveBgOpts({ opts, set }) {
  return (
    <Opt label="容差 (1-200, 越大去除范围越广)">
      <input style={inputSt} type="number" min={1} max={200} value={opts.tolerance ?? 30} onChange={e => set({ ...opts, tolerance: e.target.value })} />
    </Opt>
  );
}

function BatchResizeOpts({ opts, set }) {
  const u = (k, v) => set({ ...opts, [k]: v });
  return (
    <>
      <div style={rowSt}>
        <Opt label="目标宽度 (px)"><input style={inputSt} type="number" value={opts.width ?? ''} placeholder="必填其一" onChange={e => u('width', e.target.value)} /></Opt>
        <Opt label="目标高度 (px)"><input style={inputSt} type="number" value={opts.height ?? ''} placeholder="必填其一" onChange={e => u('height', e.target.value)} /></Opt>
      </div>
      <div style={rowSt}>
        <Opt label="适应模式">
          <select style={selectSt} value={opts.fit ?? 'cover'} onChange={e => u('fit', e.target.value)}>
            <option value="cover">裁剪填满 (cover)</option>
            <option value="contain">完整包含 (contain)</option>
            <option value="fill">拉伸填满 (fill)</option>
          </select>
        </Opt>
        <Opt label="输出格式">
          <select style={selectSt} value={opts.format ?? 'png'} onChange={e => u('format', e.target.value)}>
            <option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option>
          </select>
        </Opt>
      </div>
    </>
  );
}

function AudioTrimOpts({ opts, set, file }) {
  const u = (k, v) => set({ ...opts, [k]: v });
  const dur = opts._duration || 0;
  return (
    <>
      {file && (
        <div style={{ marginBottom: 10 }}>
          <Waveform
            file={file} start={+(opts.start || 0)} end={+(opts.end || dur)} duration={dur}
            onRange={(s, e) => set({ ...opts, start: s.toFixed(2), end: e.toFixed(2), _duration: e > dur ? e : dur || e })}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            <span>开始: {fmtTime(+(opts.start || 0))}</span>
            <span>时长: {fmtTime(dur)}</span>
            <span>结束: {fmtTime(+(opts.end || dur))}</span>
          </div>
        </div>
      )}
      <div style={rowSt}>
        <Opt label="开始时间 (秒)"><input style={inputSt} type="number" step={0.1} min={0} value={opts.start ?? 0} onChange={e => u('start', e.target.value)} /></Opt>
        <Opt label="结束时间 (秒)"><input style={inputSt} type="number" step={0.1} min={0} value={opts.end ?? ''} placeholder="到末尾" onChange={e => u('end', e.target.value)} /></Opt>
      </div>
      <div style={rowSt}>
        <Opt label="淡入 (秒)"><input style={inputSt} type="number" step={0.1} min={0} value={opts.fadeIn ?? 0} onChange={e => u('fadeIn', e.target.value)} /></Opt>
        <Opt label="淡出 (秒)"><input style={inputSt} type="number" step={0.1} min={0} value={opts.fadeOut ?? 0} onChange={e => u('fadeOut', e.target.value)} /></Opt>
      </div>
      <Opt label="输出格式">
        <select style={selectSt} value={opts.format ?? 'mp3'} onChange={e => u('format', e.target.value)}>
          <option value="mp3">MP3</option><option value="wav">WAV</option><option value="aac">AAC</option><option value="ogg">OGG</option>
        </select>
      </Opt>
    </>
  );
}

function AudioConvertOpts({ opts, set }) {
  const u = (k, v) => set({ ...opts, [k]: v });
  return (
    <>
      <Opt label="输出格式">
        <select style={selectSt} value={opts.format ?? 'mp3'} onChange={e => u('format', e.target.value)}>
          <option value="mp3">MP3</option><option value="wav">WAV</option><option value="aac">AAC</option><option value="ogg">OGG</option>
        </select>
      </Opt>
      <Opt label="音量调整 (dB, 正=增大, 负=减小, 0=不变)">
        <input style={inputSt} type="number" step={1} value={opts.volume ?? 0} onChange={e => u('volume', e.target.value)} />
      </Opt>
      <Opt label="">
        <label style={{ fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={opts.normalize === 'true'} onChange={e => u('normalize', e.target.checked ? 'true' : 'false')} />
          响度标准化 (EBU R128, -16 LUFS)
        </label>
      </Opt>
    </>
  );
}

function AudioConcatOpts({ opts, set, files }) {
  const order = opts._order || files.map((_, i) => i);
  const move = (from, to) => {
    if (to < 0 || to >= order.length) return;
    const a = [...order]; [a[from], a[to]] = [a[to], a[from]];
    set({ ...opts, _order: a });
  };
  return (
    <>
      {files.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label style={labelSt}>文件顺序 (拖动调整)</label>
          {order.map((idx, pos) => {
            const f = files[idx];
            if (!f) return null;
            return (
              <div key={pos} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                background: 'var(--crystal)', borderRadius: 'var(--radius-xs)',
                marginBottom: 4, fontSize: 13,
              }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, width: 18 }}>{pos + 1}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{fmtSize(f.size)}</span>
                <button onClick={() => move(pos, pos - 1)} disabled={pos === 0}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: pos === 0 ? 0.3 : 1 }}>↑</button>
                <button onClick={() => move(pos, pos + 1)} disabled={pos === order.length - 1}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: pos === order.length - 1 ? 0.3 : 1 }}>↓</button>
              </div>
            );
          })}
        </div>
      )}
      <div style={rowSt}>
        <Opt label="间隔 (毫秒)"><input style={inputSt} type="number" min={0} step={100} value={opts.gap ?? 0} onChange={e => set({ ...opts, gap: e.target.value })} /></Opt>
        <Opt label="输出格式">
          <select style={selectSt} value={opts.format ?? 'mp3'} onChange={e => set({ ...opts, format: e.target.value })}>
            <option value="mp3">MP3</option><option value="wav">WAV</option><option value="aac">AAC</option><option value="ogg">OGG</option>
          </select>
        </Opt>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════
   ToolGrid — main dashboard with cards
   ══════════════════════════════════════════ */
function ToolGrid({ onSelect }) {
  return (
    <div>
      <h1 className="page-title">工具箱</h1>
      <p className="page-subtitle">动效 / 图片 / 音频处理工具集</p>
      {CATEGORIES.map(cat => (
        <div key={cat.name} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{cat.icon}</span> {cat.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {cat.tools.map(t => (
              <div key={t.id} className="glass-card" onClick={() => onSelect(t.id)}
                style={{ cursor: 'pointer', transition: 'all 0.2s', padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 26 }}>{t.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   ToolView — individual tool page
   ══════════════════════════════════════════ */
function ToolView({ toolId, onBack }) {
  const tool = ALL_TOOLS.find(t => t.id === toolId);
  const [files, setFiles] = useState([]);
  const [opts, setOpts] = useState({});
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const onFiles = useCallback((newFiles) => {
    setFiles(newFiles);
    setResult(null); setError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (newFiles.length === 1) setPreviewUrl(URL.createObjectURL(newFiles[0]));
    else setPreviewUrl(null);
  }, [previewUrl]);

  const process = async () => {
    if (files.length === 0) return;
    setProcessing(true); setError(''); setResult(null);
    try {
      const fd = new FormData();
      if (tool.multiple) files.forEach(f => fd.append('files', f));
      else fd.append('file', files[0]);

      const skip = new Set(['_duration', '_order', '_vdur']);
      for (const [k, v] of Object.entries(opts)) {
        if (skip.has(k) || v === '' || v === undefined) continue;
        fd.append(k, v);
      }
      if (opts._order) fd.append('order', JSON.stringify(opts._order));

      const res = await fetch(`/api/tools/${toolId}`, { method: 'POST', body: fd });
      const json = await res.json();
      if (json.success) setResult(json.data);
      else setError(json.error || '处理失败');
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const isImg = toolId.startsWith('image') || toolId === 'batch-resize';
  const isAudio = toolId.startsWith('audio');
  const isApng = toolId.includes('apng');

  const renderPreview = () => {
    if (!previewUrl) return null;
    if (isAudio) return <audio controls src={previewUrl} style={{ width: '100%', marginTop: 8 }} />;
    if (toolId.startsWith('video')) return <video controls src={previewUrl} style={{ width: '100%', maxHeight: 240, borderRadius: 8, marginTop: 8, background: '#000' }} />;
    return <img src={previewUrl} alt="" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, marginTop: 8, objectFit: 'contain', background: 'repeating-conic-gradient(#e2e8f0 0% 25%, transparent 0% 50%) 50% / 16px 16px' }} />;
  };

  const renderResult = () => {
    if (!result) return null;
    if (result.results) {
      return (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>处理完成 ({result.results.length} 个文件)</div>
          {result.results.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
              {r.error ? (
                <span style={{ color: 'var(--danger)' }}>{r.originalName}: {r.error}</span>
              ) : (
                <>
                  <img src={r.url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                  <span style={{ flex: 1 }}>{r.originalName}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{fmtSize(r.size)}</span>
                  <a href={r.url} download style={{ color: 'var(--ice)', fontSize: 12, fontWeight: 600 }}>下载</a>
                </>
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--success)' }}>处理完成</div>
        {(isImg || isApng) && (
          <img src={result.url} alt="" style={{
            maxWidth: '100%', maxHeight: 280, borderRadius: 8, objectFit: 'contain', marginBottom: 8,
            background: 'repeating-conic-gradient(#e2e8f0 0% 25%, transparent 0% 50%) 50% / 16px 16px',
          }} />
        )}
        {isAudio && <audio controls src={result.url} style={{ width: '100%', marginBottom: 8 }} />}
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {result.originalSize && <span>原始: {fmtSize(result.originalSize)} → </span>}
          <span>大小: {fmtSize(result.size)}</span>
          {result.compressionRatio && <span> (压缩 {result.compressionRatio})</span>}
          {result.bgColor && <span> | 检测背景色: {result.bgColor}</span>}
        </div>
        <a href={result.url} download className="btn btn-ice btn-sm" style={{ textDecoration: 'none' }}>
          下载文件
        </a>
      </div>
    );
  };

  const renderOpts = () => {
    const p = { opts, set: setOpts };
    switch (toolId) {
      case 'video-to-apng': return <VideoToApngOpts {...p} />;
      case 'gif-to-apng': return <GifToApngOpts {...p} />;
      case 'apng-compress': return <ApngCompressOpts {...p} />;
      case 'image-process': return <ImageProcessOpts {...p} />;
      case 'image-remove-bg': return <ImageRemoveBgOpts {...p} />;
      case 'batch-resize': return <BatchResizeOpts {...p} />;
      case 'audio-trim': return <AudioTrimOpts {...p} file={files[0]} />;
      case 'audio-convert': return <AudioConvertOpts {...p} />;
      case 'audio-concat': return <AudioConcatOpts {...p} files={files} />;
      default: return null;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={onBack} className="btn btn-glass btn-sm" style={{ padding: '6px 14px' }}>← 返回</button>
        <span style={{ fontSize: 22 }}>{tool.icon}</span>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{tool.name}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>上传文件</div>
          <DropZone accept={tool.accept} multiple={tool.multiple} files={files} onFiles={onFiles} />
          {renderPreview()}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>参数设置</div>
            {renderOpts()}
          </div>
          <button
            className="btn btn-ice"
            onClick={process}
            disabled={processing || files.length === 0}
            style={{ width: '100%', marginTop: 14, opacity: processing || files.length === 0 ? 0.5 : 1 }}
          >
            {processing ? '处理中...' : '开始处理'}
          </button>
          {error && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--danger)', background: 'var(--danger-light)', padding: '8px 12px', borderRadius: 'var(--radius-xs)' }}>{error}</div>}
        </div>

        <div className="glass-card" style={{ padding: 20, minHeight: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>处理结果</div>
          {processing && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 8, animation: 'pulse 1.5s infinite' }}>⏳</div>
              <div style={{ fontSize: 13 }}>正在处理，请稍候...</div>
            </div>
          )}
          {!processing && !result && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              上传文件并点击处理后，结果将在此处显示
            </div>
          )}
          {renderResult()}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   VideoEditTool — full video editing workbench
   ══════════════════════════════════════════ */
function fmtTimeMs(s) {
  if (!s && s !== 0) return '00:00.000';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 1000);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function VideoEditTool({ onBack }) {
  const [phase, setPhase] = useState('idle');
  const [file, setFile] = useState(null);
  const [uploadProg, setUploadProg] = useState(0);
  const [serverFile, setServerFile] = useState(null);
  const videoRef = useRef(null);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [nativeW, setNativeW] = useState(0);
  const [nativeH, setNativeH] = useState(0);
  const [duration, setDuration] = useState(0);
  const [curTime, setCurTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [inPt, setInPt] = useState(0);
  const [outPt, setOutPt] = useState(0);
  const [crop, setCrop] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [scrollX, setScrollX] = useState(0);
  const [opts, setOpts] = useState({ width: 360, height: '', fps: 10, maxColors: 256, borderRadius: 0, plays: 0 });
  const [outputMode, setOutputMode] = useState('apng');
  const [convertFormat, setConvertFormat] = useState('mp4');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [hoverTime, setHoverTime] = useState(null);
  const [tlMode, setTlMode] = useState('time');
  const [tlFps, setTlFps] = useState(30);
  const cropCanvasRef = useRef(null);
  const tlCanvasRef = useRef(null);
  const cropInteract = useRef(null);
  const rafRef = useRef(null);

  // ── File selection ──
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const onSelectFile = useCallback((f) => {
    setFile(f); setResult(null); setError(''); setCrop(null);
    setInPt(0); setOutPt(0); setZoom(1); setScrollX(0);
    const url = URL.createObjectURL(f);
    setPreviewSrc(url);
    setPhase('local-check');
  }, []);

  const onVideoLoaded = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setNativeW(v.videoWidth); setNativeH(v.videoHeight);
    setDuration(v.duration); setOutPt(v.duration);
    setPhase('editing');
  }, []);

  const onVideoError = useCallback(() => {
    if (phase !== 'local-check' || !file) return;
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setPreviewSrc(null);
    setPhase('uploading'); setUploadProg(0);
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('file', file);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProg(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.success) {
          const d = json.data;
          setServerFile(d); setNativeW(d.width); setNativeH(d.height);
          setDuration(d.duration); setOutPt(d.duration);
          setPreviewSrc(d.previewUrl); setPhase('editing');
        } else { setError(json.error || '上传失败'); setPhase('idle'); }
      } catch { setError('响应解析失败'); setPhase('idle'); }
    };
    xhr.onerror = () => { setError('上传失败'); setPhase('idle'); };
    xhr.open('POST', '/api/tools/video-preview');
    xhr.send(fd);
  }, [phase, file, previewSrc]);

  // ── Time tracking ──
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onT = () => setCurTime(v.currentTime);
    const onP = () => setPlaying(true);
    const onS = () => setPlaying(false);
    v.addEventListener('timeupdate', onT);
    v.addEventListener('play', onP);
    v.addEventListener('pause', onS);
    return () => { v.removeEventListener('timeupdate', onT); v.removeEventListener('play', onP); v.removeEventListener('pause', onS); };
  }, [previewSrc]);

  useEffect(() => {
    if (!playing) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }
    const tick = () => {
      if (videoRef.current) setCurTime(videoRef.current.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing]);

  // ── Playback controls ──
  const togglePlay = useCallback(() => { const v = videoRef.current; if (v) { if (v.paused) v.play(); else v.pause(); } }, []);
  const stepFrame = useCallback((dir) => { const v = videoRef.current; if (v) { v.pause(); v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + dir / 30)); } }, []);
  const seekTo = useCallback((t) => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, t)); }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (phase !== 'editing') return;
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      switch (e.key) {
        case ' ': e.preventDefault(); togglePlay(); break;
        case 'i': case 'I': if (videoRef.current) setInPt(videoRef.current.currentTime); break;
        case 'o': case 'O': if (videoRef.current) setOutPt(videoRef.current.currentTime); break;
        case 'ArrowLeft': e.preventDefault(); stepFrame(-1); break;
        case 'ArrowRight': e.preventDefault(); stepFrame(1); break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [phase, togglePlay, stepFrame]);

  // ── Crop overlay drawing ──
  function getVideoRect() {
    const v = videoRef.current;
    if (!v || !nativeW || !nativeH) return { x: 0, y: 0, w: 1, h: 1 };
    const cw = v.clientWidth, ch = v.clientHeight;
    const vAR = nativeW / nativeH, cAR = cw / ch;
    let dw, dh, ox, oy;
    if (vAR > cAR) { dw = cw; dh = cw / vAR; ox = 0; oy = (ch - dh) / 2; }
    else { dh = ch; dw = ch * vAR; ox = (cw - dw) / 2; oy = 0; }
    return { x: ox, y: oy, w: dw, h: dh };
  }

  useEffect(() => {
    const cvs = cropCanvasRef.current;
    if (!cvs || phase !== 'editing') return;
    const dpr = window.devicePixelRatio || 1;
    const cw = cvs.clientWidth, ch = cvs.clientHeight;
    cvs.width = cw * dpr; cvs.height = ch * dpr;
    const ctx = cvs.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);

    if (!crop) return;
    const vr = getVideoRect();
    const dx = vr.x + (crop.x / nativeW) * vr.w;
    const dy = vr.y + (crop.y / nativeH) * vr.h;
    const dw = (crop.w / nativeW) * vr.w;
    const dh = (crop.h / nativeH) * vr.h;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.clearRect(dx, dy, dw, dh);
    ctx.strokeStyle = '#4A9EF5'; ctx.lineWidth = 2;
    ctx.strokeRect(dx, dy, dw, dh);

    const hs = 6;
    ctx.fillStyle = '#fff';
    for (const [hx, hy] of [[dx, dy], [dx + dw, dy], [dx, dy + dh], [dx + dw, dy + dh]]) {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }
  }, [crop, nativeW, nativeH, phase]);

  // ── Crop interaction ──
  const onCropMouseDown = (e) => {
    if (phase !== 'editing') return;
    const cvs = cropCanvasRef.current;
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const vr = getVideoRect();

    if (crop) {
      const dx = vr.x + (crop.x / nativeW) * vr.w;
      const dy = vr.y + (crop.y / nativeH) * vr.h;
      const dw = (crop.w / nativeW) * vr.w;
      const dh = (crop.h / nativeH) * vr.h;
      const hs = 10;
      const corners = [
        { cx: dx, cy: dy, anchor: 'tl' }, { cx: dx + dw, cy: dy, anchor: 'tr' },
        { cx: dx, cy: dy + dh, anchor: 'bl' }, { cx: dx + dw, cy: dy + dh, anchor: 'br' },
      ];
      for (const c of corners) {
        if (Math.abs(mx - c.cx) < hs && Math.abs(my - c.cy) < hs) {
          cropInteract.current = { type: 'resize', anchor: c.anchor, startX: mx, startY: my, orig: { ...crop } };
          return;
        }
      }
      if (mx >= dx && mx <= dx + dw && my >= dy && my <= dy + dh) {
        cropInteract.current = { type: 'move', startX: mx, startY: my, orig: { ...crop } };
        return;
      }
    }
    const nx = Math.max(0, ((mx - vr.x) / vr.w) * nativeW);
    const ny = Math.max(0, ((my - vr.y) / vr.h) * nativeH);
    cropInteract.current = { type: 'draw', startNX: nx, startNY: ny };
    setCrop({ x: nx, y: ny, w: 0, h: 0 });
  };

  const onCropMouseMove = (e) => {
    if (!cropInteract.current) return;
    const cvs = cropCanvasRef.current;
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const vr = getVideoRect();
    const ci = cropInteract.current;

    if (ci.type === 'draw') {
      const nx = Math.max(0, Math.min(nativeW, ((mx - vr.x) / vr.w) * nativeW));
      const ny = Math.max(0, Math.min(nativeH, ((my - vr.y) / vr.h) * nativeH));
      setCrop({
        x: Math.min(ci.startNX, nx), y: Math.min(ci.startNY, ny),
        w: Math.abs(nx - ci.startNX), h: Math.abs(ny - ci.startNY),
      });
    } else if (ci.type === 'move') {
      const ddx = ((mx - ci.startX) / vr.w) * nativeW;
      const ddy = ((my - ci.startY) / vr.h) * nativeH;
      setCrop({
        x: Math.max(0, Math.min(nativeW - ci.orig.w, ci.orig.x + ddx)),
        y: Math.max(0, Math.min(nativeH - ci.orig.h, ci.orig.y + ddy)),
        w: ci.orig.w, h: ci.orig.h,
      });
    } else if (ci.type === 'resize') {
      const ddx = ((mx - ci.startX) / vr.w) * nativeW;
      const ddy = ((my - ci.startY) / vr.h) * nativeH;
      const o = ci.orig;
      let nx = o.x, ny = o.y, nw = o.w, nh = o.h;
      if (ci.anchor.includes('l')) { nx = Math.max(0, o.x + ddx); nw = o.w - (nx - o.x); }
      if (ci.anchor.includes('r')) { nw = Math.max(10, o.w + ddx); }
      if (ci.anchor.includes('t')) { ny = Math.max(0, o.y + ddy); nh = o.h - (ny - o.y); }
      if (ci.anchor.includes('b')) { nh = Math.max(10, o.h + ddy); }
      if (nw < 10) nw = 10; if (nh < 10) nh = 10;
      if (nx + nw > nativeW) nw = nativeW - nx;
      if (ny + nh > nativeH) nh = nativeH - ny;
      setCrop({ x: nx, y: ny, w: nw, h: nh });
    }
  };

  useEffect(() => {
    const up = () => { cropInteract.current = null; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // ── Timeline drawing ──
  const tlLabel = useCallback((t) => {
    if (tlMode === 'frame') return `F${Math.round(t * tlFps)}`;
    return fmtTimeMs(t);
  }, [tlMode, tlFps]);

  useEffect(() => {
    const cvs = tlCanvasRef.current;
    if (!cvs || !duration || phase !== 'editing') return;
    const dpr = window.devicePixelRatio || 1;
    const w = cvs.clientWidth, h = cvs.clientHeight;
    cvs.width = w * dpr; cvs.height = h * dpr;
    const ctx = cvs.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const visDur = duration / zoom;
    const t2x = (t) => ((t - scrollX) / visDur) * w;

    ctx.fillStyle = '#e8ecf1'; ctx.fillRect(0, 0, w, h);

    const inX = t2x(inPt), outX = t2x(outPt);
    ctx.fillStyle = 'rgba(74,158,245,0.15)';
    ctx.fillRect(Math.max(0, inX), 0, Math.min(w, outX) - Math.max(0, inX), h);

    ctx.fillStyle = '#94a3b8'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center';
    if (tlMode === 'frame') {
      const visFrames = visDur * tlFps;
      const frameStep = visFrames < 30 ? 1 : visFrames < 150 ? 5 : visFrames < 600 ? 10 : visFrames < 3000 ? 50 : visFrames < 15000 ? 100 : 500;
      const startFrame = Math.floor(scrollX * tlFps / frameStep) * frameStep;
      for (let f = startFrame; f <= (scrollX + visDur) * tlFps; f += frameStep) {
        const x = t2x(f / tlFps);
        if (x < -20 || x > w + 20) continue;
        ctx.strokeStyle = 'rgba(148,163,184,0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, h - 14); ctx.lineTo(x, h); ctx.stroke();
        ctx.fillText(`F${f}`, x, h - 16);
      }
    } else {
      const step = visDur < 2 ? 0.1 : visDur < 10 ? 0.5 : visDur < 30 ? 1 : visDur < 120 ? 5 : visDur < 600 ? 10 : 30;
      const startT = Math.floor(scrollX / step) * step;
      for (let t = startT; t <= scrollX + visDur; t += step) {
        const x = t2x(t);
        if (x < -20 || x > w + 20) continue;
        ctx.strokeStyle = 'rgba(148,163,184,0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, h - 14); ctx.lineTo(x, h); ctx.stroke();
        ctx.fillText(fmtTime(t), x, h - 16);
      }
    }

    ctx.fillStyle = '#22c55e'; ctx.fillRect(inX - 1.5, 0, 3, h);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(outX - 1.5, 0, 3, h);

    const phX = t2x(curTime);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(phX, 0); ctx.lineTo(phX, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(phX - 5, 0); ctx.lineTo(phX + 5, 0); ctx.lineTo(phX, 6); ctx.closePath(); ctx.fill(); ctx.stroke();

    if (hoverTime !== null) {
      const hx = t2x(hoverTime);
      if (hx >= 0 && hx <= w) {
        ctx.strokeStyle = 'rgba(74,158,245,0.85)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, h); ctx.stroke();
        ctx.setLineDash([]);
        const label = tlMode === 'frame' ? `F${Math.round(hoverTime * tlFps)}` : fmtTimeMs(hoverTime);
        ctx.font = '10px monospace';
        const tw = ctx.measureText(label).width + 8;
        const lx = Math.min(w - tw - 2, Math.max(2, hx - tw / 2));
        ctx.fillStyle = 'rgba(30,41,59,0.88)';
        ctx.beginPath(); ctx.roundRect(lx, 2, tw, 16, 3); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
        ctx.fillText(label, lx + 4, 14);
      }
    }
  }, [curTime, inPt, outPt, zoom, scrollX, duration, phase, hoverTime, tlMode, tlFps]);

  // ── Timeline interaction ──
  const onTlWheel = (e) => {
    e.preventDefault();
    const cvs = tlCanvasRef.current;
    if (!cvs || !duration) return;
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const visDur = duration / zoom;
    const tAtCursor = scrollX + (mx / cvs.clientWidth) * visDur;
    const newZoom = Math.max(1, Math.min(duration * 30, zoom * (e.deltaY < 0 ? 1.4 : 1 / 1.4)));
    const newVisDur = duration / newZoom;
    const newScrollX = Math.max(0, Math.min(duration - newVisDur, tAtCursor - (mx / cvs.clientWidth) * newVisDur));
    setZoom(newZoom); setScrollX(newScrollX);
  };

  const tlDragRef = useRef(null);
  const onTlMouseDown = (e) => {
    const cvs = tlCanvasRef.current;
    if (!cvs || !duration) return;
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const visDur = duration / zoom;
    const t = scrollX + (mx / cvs.clientWidth) * visDur;
    seekTo(t);
    tlDragRef.current = { startX: e.clientX, startScroll: scrollX };
  };
  const onTlMouseMove = (e) => {
    const cvs = tlCanvasRef.current;
    if (!cvs || !duration) return;
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const visDur = duration / zoom;
    setHoverTime(Math.max(0, Math.min(duration, scrollX + (mx / cvs.clientWidth) * visDur)));
    if (!tlDragRef.current || zoom <= 1) return;
    const dx = e.clientX - tlDragRef.current.startX;
    const dt = -(dx / cvs.clientWidth) * visDur;
    setScrollX(Math.max(0, Math.min(duration - visDur, tlDragRef.current.startScroll + dt)));
  };
  const onTlMouseLeave = () => setHoverTime(null);
  useEffect(() => {
    const up = () => { tlDragRef.current = null; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // ── Process ──
  const processVideo = async () => {
    setPhase('processing'); setError(''); setResult(null); setUploadProg(0);
    try {
      const fd = new FormData();
      if (serverFile) fd.append('filename', serverFile.filename);
      else fd.append('file', file);
      fd.append('start', String(inPt));
      fd.append('end', String(outPt));
      if (crop && crop.w > 10 && crop.h > 10) {
        fd.append('cropX', String(Math.round(crop.x)));
        fd.append('cropY', String(Math.round(crop.y)));
        fd.append('cropW', String(Math.round(crop.w)));
        fd.append('cropH', String(Math.round(crop.h)));
      }

      let apiUrl;
      if (outputMode === 'convert') {
        fd.append('format', convertFormat);
        apiUrl = '/api/tools/video-convert';
      } else {
        for (const [k, v] of Object.entries(opts)) { if (v !== '' && v !== undefined) fd.append(k, String(v)); }
        apiUrl = '/api/tools/video-edit';
      }

      const json = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        if (!serverFile) xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProg(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('响应解析失败')); } };
        xhr.onerror = () => reject(new Error('请求失败'));
        xhr.open('POST', apiUrl);
        xhr.send(fd);
      });
      if (json.success) { setResult(json.data); setPhase('done'); }
      else { setError(json.error || '处理失败'); setPhase('editing'); }
    } catch (e) { setError(e.message); setPhase('editing'); }
  };

  const u = (k, v) => setOpts(p => ({ ...p, [k]: v }));
  const isEditing = phase === 'editing' || phase === 'done';

  // ── Render ──
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} className="btn btn-glass btn-sm" style={{ padding: '6px 14px' }}>← 返回</button>
        <span style={{ fontSize: 22 }}>🎞️</span>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>视频剪辑</h2>
        {isEditing && (
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
            <span title="播放/暂停">空格:播放</span>
            <span title="设为起点">I:起点</span>
            <span title="设为终点">O:终点</span>
            <span title="前/后一帧">←→:逐帧</span>
          </div>
        )}
      </div>

      {phase === 'idle' && (
        <div className="glass-card"
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) onSelectFile(f); }}
          onClick={() => inputRef.current?.click()}
          style={{ padding: 60, textAlign: 'center', cursor: 'pointer', border: `2px dashed ${dragOver ? 'var(--ice)' : 'rgba(148,163,184,0.25)'}`, borderRadius: 'var(--radius)', background: dragOver ? 'var(--ice-light)' : 'var(--crystal)', transition: 'all 0.2s' }}
        >
          <input ref={inputRef} type="file" accept="video/*" onChange={e => { const f = e.target.files[0]; if (f) onSelectFile(f); e.target.value = ''; }} style={{ display: 'none' }} />
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.6 }}>🎬</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>上传视频文件</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>支持 MP4 / MOV / WebM / AVI，最大 3GB</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>点击选择、拖拽或 Ctrl+V 粘贴</div>
        </div>
      )}

      {phase === 'local-check' && (
        <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
          <video ref={videoRef} src={previewSrc} onLoadedMetadata={onVideoLoaded} onError={onVideoError}
            style={{ display: 'none' }} />
          <div style={{ fontSize: 28, animation: 'pulse 1.5s infinite' }}>⏳</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>正在加载视频...</div>
        </div>
      )}

      {phase === 'uploading' && (
        <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>正在上传并生成预览...</div>
          <div style={{ width: '100%', maxWidth: 400, margin: '0 auto', background: 'var(--border-subtle)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${uploadProg}%`, height: '100%', background: 'var(--ice)', borderRadius: 99, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>{uploadProg}%</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>此格式需要服务端转码预览，请稍候</div>
        </div>
      )}

      {isEditing && (
        <>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
            {/* Video + Crop Overlay */}
            <div style={{ position: 'relative', background: '#000', lineHeight: 0 }}>
              <video ref={videoRef} src={previewSrc} onLoadedMetadata={onVideoLoaded}
                style={{ width: '100%', maxHeight: 400, objectFit: 'contain', display: 'block' }} />
              <canvas ref={cropCanvasRef}
                onMouseDown={onCropMouseDown} onMouseMove={onCropMouseMove}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'crosshair' }} />
            </div>

            {/* Controls Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--crystal)', borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => stepFrame(-1)} className="btn btn-glass btn-sm" style={{ padding: '4px 8px', fontSize: 13 }} title="后退一帧 (←)">◀◀</button>
              <button onClick={togglePlay} className="btn btn-ice btn-sm" style={{ padding: '4px 12px', fontSize: 14, minWidth: 36 }} title="播放/暂停 (空格)">{playing ? '⏸' : '▶'}</button>
              <button onClick={() => stepFrame(1)} className="btn btn-glass btn-sm" style={{ padding: '4px 8px', fontSize: 13 }} title="前进一帧 (→)">▶▶</button>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>
                {tlMode === 'frame' ? <><span style={{ color: 'var(--ice)' }}>F{Math.round(curTime * tlFps)}</span> <span style={{ fontSize: 11, opacity: 0.6 }}>{fmtTimeMs(curTime)}</span></> : fmtTimeMs(curTime)}
              </div>
              <button onClick={() => setInPt(curTime)} className="btn btn-glass btn-sm" style={{ padding: '4px 10px', fontSize: 11, color: '#22c55e' }} title="设为起点 (I)">I 起点</button>
              <button onClick={() => setOutPt(curTime)} className="btn btn-glass btn-sm" style={{ padding: '4px 10px', fontSize: 11, color: '#ef4444' }} title="设为终点 (O)">O 终点</button>
            </div>

            {/* Timeline */}
            <div style={{ padding: '0 14px 10px' }}>
              <canvas ref={tlCanvasRef}
                onWheel={onTlWheel} onMouseDown={onTlMouseDown} onMouseMove={onTlMouseMove} onMouseLeave={onTlMouseLeave}
                style={{ width: '100%', height: 44, borderRadius: 6, cursor: zoom > 1 ? 'grab' : 'pointer', display: 'block' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                <span>起点: {tlLabel(inPt)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setTlMode(m => m === 'time' ? 'frame' : 'time')}
                    style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'var(--crystal)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    {tlMode === 'time' ? '⏱ 时间' : '🎞 帧'}
                  </button>
                  {tlMode === 'frame' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <input type="number" min={1} max={120} value={tlFps}
                        onChange={e => setTlFps(Math.max(1, Math.min(120, +e.target.value || 30)))}
                        style={{ width: 34, fontSize: 10, padding: '1px 3px', borderRadius: 3, border: '1px solid var(--border-subtle)', textAlign: 'center' }} />
                      <span>fps</span>
                    </span>
                  )}
                  <span>缩放: {zoom.toFixed(1)}x</span>
                </span>
                <span>终点: {tlLabel(outPt)}</span>
              </div>
            </div>
          </div>

          {/* Params + Crop + Result */}
          <div style={{ display: 'grid', gridTemplateColumns: crop ? '1fr 1fr 1fr' : '1fr 1fr', gap: 14 }}>
            {crop && (
              <div className="glass-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>画面裁剪</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Opt label="X"><input style={inputSt} type="number" value={Math.round(crop.x)} onChange={e => setCrop(p => ({ ...p, x: +e.target.value }))} /></Opt>
                  <Opt label="Y"><input style={inputSt} type="number" value={Math.round(crop.y)} onChange={e => setCrop(p => ({ ...p, y: +e.target.value }))} /></Opt>
                  <Opt label="宽"><input style={inputSt} type="number" value={Math.round(crop.w)} onChange={e => setCrop(p => ({ ...p, w: +e.target.value }))} /></Opt>
                  <Opt label="高"><input style={inputSt} type="number" value={Math.round(crop.h)} onChange={e => setCrop(p => ({ ...p, h: +e.target.value }))} /></Opt>
                </div>
                <button onClick={() => setCrop(null)} className="btn btn-glass btn-sm" style={{ width: '100%', marginTop: 8, fontSize: 11 }}>重置裁剪</button>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>原始: {nativeW}x{nativeH}</div>
              </div>
            )}

            <div className="glass-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10, borderRadius: 'var(--radius-xs)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                {[['apng', '转 APNG'], ['convert', '格式转换']].map(([k, label]) => (
                  <button key={k} onClick={() => { setOutputMode(k); setResult(null); }}
                    style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: outputMode === k ? 'var(--ice)' : 'var(--crystal)', color: outputMode === k ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s' }}>
                    {label}
                  </button>
                ))}
              </div>
              {outputMode === 'apng' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Opt label="宽度"><input style={inputSt} type="number" value={opts.width} onChange={e => u('width', e.target.value)} /></Opt>
                    <Opt label="高度 (空=自动)"><input style={inputSt} type="number" value={opts.height} placeholder="自动" onChange={e => u('height', e.target.value)} /></Opt>
                    <Opt label="帧率 (FPS)"><input style={inputSt} type="number" min={1} max={30} value={opts.fps} onChange={e => u('fps', e.target.value)} /></Opt>
                    <Opt label="最大色数"><input style={inputSt} type="number" min={8} max={256} value={opts.maxColors} onChange={e => u('maxColors', e.target.value)} /></Opt>
                    <Opt label="圆角"><input style={inputSt} type="number" min={0} value={opts.borderRadius} onChange={e => u('borderRadius', e.target.value)} /></Opt>
                    <Opt label="循环 (0=无限)"><input style={inputSt} type="number" min={0} value={opts.plays} onChange={e => u('plays', e.target.value)} /></Opt>
                  </div>
                </>
              ) : (
                <>
                  <Opt label="输出格式">
                    <select style={selectSt} value={convertFormat} onChange={e => setConvertFormat(e.target.value)}>
                      <option value="mp4">MP4</option>
                      <option value="mov">MOV</option>
                      <option value="webm">WebM</option>
                      <option value="avi">AVI</option>
                      <option value="mkv">MKV</option>
                    </select>
                  </Opt>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, padding: '4px 0' }}>
                    保持原视频的分辨率和帧率，支持时间裁剪和画面裁剪
                  </div>
                </>
              )}
              <button className="btn btn-ice" onClick={processVideo}
                disabled={phase === 'processing'}
                style={{ width: '100%', marginTop: 12, opacity: phase === 'processing' ? 0.5 : 1 }}>
                {phase === 'processing' ? (serverFile ? '处理中...' : `上传并处理... ${uploadProg}%`) : outputMode === 'apng' ? '开始处理 → APNG' : `开始转换 → ${convertFormat.toUpperCase()}`}
              </button>
            </div>

            <div className="glass-card" style={{ padding: 16, minHeight: 160 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>处理结果</div>
              {phase === 'processing' && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 24, animation: 'pulse 1.5s infinite' }}>⏳</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>正在处理...</div>
                </div>
              )}
              {result && (
                <div>
                  {outputMode === 'apng' ? (
                    <img src={result.url} alt="" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, objectFit: 'contain', marginBottom: 8, background: 'repeating-conic-gradient(#e2e8f0 0% 25%, transparent 0% 50%) 50% / 16px 16px' }} />
                  ) : (
                    <video controls src={result.url} style={{ width: '100%', maxHeight: 180, borderRadius: 8, marginBottom: 8, background: '#000' }} />
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {result.originalSize && <span>原始: {fmtSize(result.originalSize)} → </span>}
                    大小: {fmtSize(result.size)}
                  </div>
                  <a href={result.url} download className="btn btn-ice btn-sm" style={{ textDecoration: 'none', width: '100%', display: 'block', textAlign: 'center' }}>
                    {outputMode === 'apng' ? '下载 APNG' : `下载 ${convertFormat.toUpperCase()}`}
                  </a>
                </div>
              )}
              {!result && phase !== 'processing' && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                  设置参数后点击处理
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {error && <div style={{ marginTop: 14, fontSize: 13, color: 'var(--danger)', background: 'var(--danger-light)', padding: '10px 14px', borderRadius: 'var(--radius-xs)' }}>{error}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════
   Toolbox — main component
   ══════════════════════════════════════════ */
export default function Toolbox() {
  const [activeTool, setActiveTool] = useState(null);

  if (!activeTool) return <ToolGrid onSelect={setActiveTool} />;
  if (activeTool === 'video-edit') return <VideoEditTool onBack={() => setActiveTool(null)} />;
  return <ToolView toolId={activeTool} onBack={() => setActiveTool(null)} />;
}
