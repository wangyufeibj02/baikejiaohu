import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

const CARD_W = 320;

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawThumb(canvas, p) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cw = p.canvasWidth || 1624, ch = p.canvasHeight || 1050;
  const s = CARD_W / cw; const th = Math.round(ch * s);
  canvas.width = CARD_W; canvas.height = th;

  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, CARD_W, th);

  const st = (p.safeTop || 150) * s, sb = (p.safeBottom || 900) * s;
  ctx.fillStyle = 'rgba(0,0,0,0.025)'; ctx.fillRect(0, 0, CARD_W, st); ctx.fillRect(0, sb, CARD_W, th - sb);
  ctx.fillStyle = 'rgba(56,189,248,0.05)'; ctx.fillRect(0, st, CARD_W, sb - st);

  ctx.strokeStyle = 'rgba(239,68,68,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(0, st); ctx.lineTo(CARD_W, st); ctx.moveTo(0, sb); ctx.lineTo(CARD_W, sb); ctx.stroke(); ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(239,68,68,0.6)'; ctx.font = '10px system-ui';
  ctx.fillText(`y=${p.safeTop || 150}`, 4, st - 3);
  ctx.fillText(`y=${p.safeBottom || 900}`, 4, sb + 12);

  if (p.showBackBtn !== false) {
    const bx = (p.backBtnX || 58) * s, by = (p.backBtnY || 80) * s;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.moveTo(bx + 10 * s, by); ctx.lineTo(bx, by + 7 * s); ctx.lineTo(bx + 10 * s, by + 14 * s); ctx.closePath(); ctx.fill();
  }
  if (p.showProgressBar !== false) {
    const px = (p.progressBarX || 440) * s, py = (p.progressBarY || 78) * s, pw = (p.progressBarW || 240) * s;
    ctx.fillStyle = '#e5e7eb'; roundRect(ctx, px, py, pw, 5 * s, 3 * s); ctx.fill();
    ctx.fillStyle = '#38bdf8'; roundRect(ctx, px, py, pw * 0.35, 5 * s, 3 * s); ctx.fill();
  }
  if (p.showBottomPill !== false) {
    const pw = 120 * s, ph = 4 * s; const px = CARD_W / 2 - pw / 2;
    ctx.fillStyle = '#1e293b'; roundRect(ctx, px, (p.bottomPillY || 960) * s, pw, ph, 2 * s); ctx.fill();
  }

  (p.elements || []).forEach(el => {
    ctx.save(); ctx.globalAlpha = (el.opacity ?? 0.3) * 0.7;
    const ex = el.x * s, ey = el.y * s, ew = el.w * s, eh = el.h * s;
    const c = el.color || '#64748b';
    if (el.type === 'circle') {
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(ex + ew / 2, ey + eh / 2, ew / 2, eh / 2, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = c; roundRect(ctx, ex, ey, ew, eh, (el.borderRadius || 0) * s); ctx.fill();
    }
    ctx.restore();
  });
}

function Thumb({ preset }) {
  const ref = useRef(null);
  useEffect(() => { drawThumb(ref.current, preset); }, [preset]);
  return <canvas ref={ref} style={{ width: '100%', height: 'auto', borderRadius: 8 }} />;
}

export default function CanvasPresets() {
  const [presets, setPresets] = useState([]);

  const load = useCallback(() => {
    fetch('/api/canvas-presets').then(r => r.json()).then(d => { if (d.success) setPresets(d.data); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    if (!confirm('确定删除此画布？')) return;
    const res = await fetch(`/api/canvas-presets/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) load(); else alert(json.error || '删除失败');
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">画布管理</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            设计画布基准与操作区范围，模板加载画布即可统一规格
          </p>
        </div>
        <Link to="/canvas/new"><button className="btn btn-primary">+ 新建画布</button></Link>
      </div>

      <div className="template-grid">
        {presets.map(p => (
          <Link to={`/canvas/${p.id}`} key={p.id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="template-card" style={{ cursor: 'pointer' }}>
              <div className="template-card-thumb">
                <Thumb preset={p} />
              </div>
              <div className="template-card-body">
                <div className="template-card-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.name}
                  {p.isDefault && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(56,189,248,0.1)', color: 'var(--ice-border)', fontWeight: 500 }}>默认</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  {p.canvasWidth || 1624}×{p.canvasHeight || 1050} | 操作区 {p.safeTop ?? 150}~{p.safeBottom ?? 900} ({(p.safeBottom || 900) - (p.safeTop || 150)}px)
                  {p.elements?.length > 0 && ` | ${p.elements.length} 个元素`}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <span style={{ flex: 1 }} />
                  <button className="btn btn-glass btn-sm" onClick={e => e.stopPropagation()}>编辑</button>
                  {!p.isDefault && (
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)', fontSize: 11, borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); handleDelete(p.id); }}>删除</button>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {presets.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>暂无画布预设</p>
          <Link to="/canvas/new"><button className="btn btn-primary">+ 新建画布</button></Link>
        </div>
      )}
    </div>
  );
}
