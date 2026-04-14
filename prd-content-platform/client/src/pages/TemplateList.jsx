import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const CARD_W = 280;
const STEM_LABELS = { audio: '语音题干', text: '文字题干', image: '图片题干' };
const STYLE_LABELS = { image: '图片', text: '文字', imageText: '图文' };
const STEM_FILTERS = [
  { key: '', label: '全部' },
  { key: 'audio', label: '语音题干' },
  { key: 'text', label: '文字题干' },
  { key: 'image', label: '图片题干' },
];

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawThumb(canvas, tpl) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cw = tpl.canvasWidth || 1624, ch = tpl.canvasHeight || 1050;
  const s = CARD_W / cw;
  const th = Math.round(ch * s);
  canvas.width = CARD_W; canvas.height = th;

  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, CARD_W, th);

  if (tpl.safeTop != null || tpl.safeBottom != null) {
    const st = (tpl.safeTop || 150) * s, sb = (tpl.safeBottom || 900) * s;
    ctx.fillStyle = 'rgba(0,0,0,0.02)'; ctx.fillRect(0, 0, CARD_W, st); ctx.fillRect(0, sb, CARD_W, th - sb);
    ctx.fillStyle = 'rgba(56,189,248,0.04)'; ctx.fillRect(0, st, CARD_W, sb - st);
    ctx.strokeStyle = 'rgba(239,68,68,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(0, st); ctx.lineTo(CARD_W, st); ctx.moveTo(0, sb); ctx.lineTo(CARD_W, sb); ctx.stroke(); ctx.setLineDash([]);
  }

  (tpl.elements || []).forEach(el => {
    ctx.save();
    ctx.globalAlpha = (el.opacity ?? 0.3) * 0.7;
    const ex = el.x * s, ey = el.y * s, ew = el.w * s, eh = el.h * s;
    const c = el.color || '#64748b';
    const br = typeof el.borderRadius === 'object'
      ? Math.max(el.borderRadius.tl || 0, el.borderRadius.tr || 0, el.borderRadius.br || 0, el.borderRadius.bl || 0)
      : (el.borderRadius || 0);
    if (el.type === 'circle') {
      ctx.fillStyle = c; ctx.beginPath();
      ctx.ellipse(ex + ew / 2, ey + eh / 2, ew / 2, eh / 2, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = c; roundRect(ctx, ex, ey, ew, eh, br * s); ctx.fill();
    }
    ctx.restore();
  });
}

function Thumb({ template }) {
  const ref = useRef(null);
  useEffect(() => { drawThumb(ref.current, template); }, [template]);
  return <canvas ref={ref} style={{ width: '100%', height: 'auto', borderRadius: 8 }} />;
}

export default function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', stemType: 'audio', optionStyle: 'imageText', optionCount: 3 });
  const navigate = useNavigate();

  const load = useCallback(() => {
    fetch('/api/templates').then(r => r.json()).then(d => { if (d.success) setTemplates(d.data); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = templates.filter(t => {
    if (filter && t.stemType !== filter) return false;
    if (search && !(t.name || '').includes(search) && !(t.description || '').includes(search)) return false;
    return true;
  });

  async function handleDelete(e, id) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('确定删除此模板？')) return;
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) load(); else alert(json.error || '删除失败');
  }

  async function handleCreate() {
    if (!form.name.trim()) return alert('请输入模板名称');
    const variant = `${form.stemType}_${form.optionStyle}_${form.optionCount}`;
    const body = {
      name: form.name.trim(),
      questionType: 'choice',
      stemType: form.stemType,
      optionStyle: form.optionStyle,
      variant,
      optionCount: form.optionCount,
      description: `${STEM_LABELS[form.stemType]}，${form.optionCount}个${STYLE_LABELS[form.optionStyle]}选项`,
      elements: [],
      canvasWidth: 1624,
      canvasHeight: 1050,
    };
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.success) {
      setShowCreate(false);
      setForm({ name: '', stemType: 'audio', optionStyle: 'imageText', optionCount: 3 });
      load();
      if (json.data?.id) navigate(`/templates/${json.data.id}`);
    } else {
      alert(json.error || '创建失败');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">题型模板</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            管理题板布局模板，支持多种题干类型和选项样式
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ 新建模板</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        {STEM_FILTERS.map(f => (
          <button
            key={f.key}
            className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <input
          className="glass-input"
          style={{ width: 200 }}
          placeholder="搜索模板..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="template-grid">
        {filtered.map(t => (
          <div
            key={t.id}
            className="template-card"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/templates/${t.id}`)}
          >
            <div className="template-card-thumb">
              <Thumb template={t} />
            </div>
            <div className="template-card-body">
              <div className="template-card-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {t.name}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 4,
                  background: 'rgba(99,102,241,0.08)', color: '#6366f1', fontWeight: 500,
                }}>{STEM_LABELS[t.stemType] || t.stemType}</span>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 4,
                  background: 'rgba(56,189,248,0.08)', color: 'var(--ice-border)', fontWeight: 500,
                }}>{STYLE_LABELS[t.optionStyle] || t.optionStyle}</span>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 4,
                  background: 'rgba(16,185,129,0.08)', color: '#10b981', fontWeight: 500,
                }}>{t.optionCount}选项</span>
              </div>
              {t.description && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                  {t.description}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <span style={{ flex: 1 }} />
                <button className="btn btn-glass btn-sm" onClick={e => { e.stopPropagation(); navigate(`/templates/${t.id}`); }}>
                  编辑
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)', fontSize: 11, borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                  onClick={e => handleDelete(e, t.id)}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && templates.length > 0 && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ color: 'var(--text-secondary)' }}>没有匹配的模板</p>
        </div>
      )}

      {templates.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>暂无模板</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ 新建模板</button>
        </div>
      )}

      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowCreate(false)}
        >
          <div className="glass-card" style={{ width: 400, padding: 28 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>新建题型模板</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>模板名称</label>
                <input className="glass-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="如：语音题干-图文3选项" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>题干类型</label>
                <select className="glass-input" value={form.stemType} onChange={e => setForm(p => ({ ...p, stemType: e.target.value }))}>
                  <option value="audio">语音题干</option>
                  <option value="text">文字题干</option>
                  <option value="image">图片题干</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>选项样式</label>
                <select className="glass-input" value={form.optionStyle} onChange={e => setForm(p => ({ ...p, optionStyle: e.target.value }))}>
                  <option value="imageText">图文</option>
                  <option value="image">图片</option>
                  <option value="text">文字</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>选项数量</label>
                <select className="glass-input" value={form.optionCount} onChange={e => setForm(p => ({ ...p, optionCount: parseInt(e.target.value) }))}>
                  {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn btn-glass btn-sm" onClick={() => setShowCreate(false)}>取消</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreate}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
