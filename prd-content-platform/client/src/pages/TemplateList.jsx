import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

const CANVAS_W = 1624;
const CANVAS_H = 1050;
const THUMB_W = 320;
const THUMB_H = Math.round(THUMB_W * CANVAS_H / CANVAS_W);

function hexToRgba(hex, a) {
  const c = hex.replace('#', '');
  return `rgba(${parseInt(c.substring(0, 2), 16) || 0},${parseInt(c.substring(2, 4), 16) || 0},${parseInt(c.substring(4, 6), 16) || 0},${a})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawThumb(canvas, elements) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const s = THUMB_W / CANVAS_W;
  ctx.clearRect(0, 0, THUMB_W, THUMB_H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, THUMB_W, 150 * s);
  ctx.fillRect(0, 900 * s, THUMB_W, (CANVAS_H - 900) * s);
  ctx.strokeStyle = 'rgba(239,68,68,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(0, 150 * s); ctx.lineTo(THUMB_W, 150 * s);
  ctx.moveTo(0, 900 * s); ctx.lineTo(THUMB_W, 900 * s);
  ctx.stroke(); ctx.setLineDash([]);

  for (const el of (elements || [])) {
    if (el.presetKey === 'bg_area') continue;
    const ex = el.x * s, ey = el.y * s, ew = el.w * s, eh = el.h * s;
    ctx.save();
    if (el.type === 'circle') {
      ctx.beginPath(); ctx.arc(ex + ew / 2, ey + eh / 2, Math.min(ew, eh) / 2, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(el.color, 0.3); ctx.fill();
      ctx.strokeStyle = el.color; ctx.lineWidth = 1; ctx.stroke();
    } else if (el.type === 'text') {
      ctx.fillStyle = hexToRgba(el.color, 0.15);
      roundRect(ctx, ex, ey, ew, eh, 3 * s); ctx.fill();
      ctx.strokeStyle = el.color; ctx.lineWidth = 0.8;
      roundRect(ctx, ex, ey, ew, eh, 3 * s); ctx.stroke();
      ctx.fillStyle = el.textColor || '#1e3a8a';
      ctx.font = `bold ${Math.max(8, (el.fontSize || 28) * s)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(el.textContent || el.label, ex + ew / 2, ey + eh / 2, ew);
    } else {
      ctx.fillStyle = hexToRgba(el.color, 0.2);
      roundRect(ctx, ex, ey, ew, eh, 4 * s); ctx.fill();
      ctx.strokeStyle = el.color; ctx.lineWidth = 1;
      roundRect(ctx, ex, ey, ew, eh, 4 * s); ctx.stroke();
    }
    ctx.restore();
  }
}

function ThumbCanvas({ elements }) {
  const ref = useRef(null);
  useEffect(() => { drawThumb(ref.current, elements); }, [elements]);
  return <canvas ref={ref} width={THUMB_W} height={THUMB_H} style={{ width: '100%', height: 'auto', borderRadius: 8 }} />;
}

// ─── Classification helpers ─────────────────────────────

const STEM_LABELS = { audio: '语音题干', text: '文字题干', image: '图片题干', free: '自由操作区' };
const STYLE_LABELS = { image: '图片选项', text: '文字选项', imageText: '图文选项' };

function detectStemType(t) {
  if (t.stemType) return t.stemType;
  const els = t.elements || [];
  if (els.some(e => e.presetKey === 'stem_image')) return 'image';
  if (els.some(e => e.presetKey === 'stem_text')) return 'text';
  return 'audio';
}

function detectOptionStyle(t) {
  if (t.optionStyle) return t.optionStyle;
  const els = t.elements || [];
  const hasImages = els.some(e => e.presetKey === 'option_image');
  const hasTexts = els.some(e => e.presetKey === 'text_label');
  if (hasImages && hasTexts) return 'imageText';
  if (hasImages) return 'image';
  if (hasTexts) return 'text';
  return 'image';
}

function getTags(t) {
  const tags = [];
  const stem = detectStemType(t);
  const style = detectOptionStyle(t);
  tags.push(STEM_LABELS[stem] || stem);
  tags.push(STYLE_LABELS[style] || style);
  const els = t.elements || [];
  if (els.some(e => e.presetKey === 'audio_btn')) tags.push('带配音');
  const optCount = Math.max(
    els.filter(e => e.presetKey === 'option_image').length,
    els.filter(e => e.presetKey === 'text_label').length,
  );
  if (optCount > 0) tags.push(`${optCount}选项`);
  return tags;
}

// ─── Family (top-level type) ────────────────────────────

const QUESTION_FAMILIES = [
  { key: 'all', label: '全部' },
  { key: 'choice', label: '选择题' },
  { key: 'connect', label: '连线题' },
  { key: 'drag', label: '拖拽题' },
  { key: 'hotspot', label: '点选题' },
  { key: 'judge', label: '判断题' },
  { key: 'other', label: '其他' },
];

const FAMILY_MAP = {
  choice: 'choice',
  singleChoice: 'choice',
  multiChoice: 'choice',
  connect: 'connect',
  drag: 'drag',
  hotspot: 'hotspot',
  judge: 'judge',
};

function getFamily(t) {
  return FAMILY_MAP[t.questionType] || 'other';
}

function matchFamily(t, key) {
  if (key === 'all') return true;
  return getFamily(t) === key;
}

// ─── Sub-filter definitions ─────────────────────────────

const STEM_FILTERS = [
  { key: 'all', label: '全部题干' },
  { key: 'audio', label: '语音题干' },
  { key: 'text', label: '文字题干' },
  { key: 'image', label: '图片题干' },
  { key: 'free', label: '自由操作区' },
];

const STYLE_FILTERS = [
  { key: 'all', label: '全部选项' },
  { key: 'image', label: '图片选项' },
  { key: 'text', label: '文字选项' },
  { key: 'imageText', label: '图文选项' },
];

// ─── Component ──────────────────────────────────────────

export default function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [seeding, setSeeding] = useState(false);
  const [activeFamily, setActiveFamily] = useState('all');
  const [stemFilter, setStemFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');

  const loadTemplates = useCallback(() => {
    fetch('/api/templates').then(r => r.json()).then(d => {
      if (d.success) setTemplates(d.data);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const familyCounts = useMemo(() => {
    const counts = {};
    for (const f of QUESTION_FAMILIES) counts[f.key] = templates.filter(t => matchFamily(t, f.key)).length;
    return counts;
  }, [templates]);

  const visibleFamilies = useMemo(() =>
    QUESTION_FAMILIES.filter(f => f.key === 'all' || familyCounts[f.key] > 0),
  [familyCounts]);

  const familyFiltered = useMemo(() =>
    templates.filter(t => matchFamily(t, activeFamily)),
  [templates, activeFamily]);

  const showSubFilters = activeFamily === 'choice';

  const stemCounts = useMemo(() => {
    if (!showSubFilters) return {};
    const counts = {};
    for (const s of STEM_FILTERS) {
      counts[s.key] = s.key === 'all'
        ? familyFiltered.length
        : familyFiltered.filter(t => detectStemType(t) === s.key).length;
    }
    return counts;
  }, [familyFiltered, showSubFilters]);

  const visibleStemFilters = useMemo(() =>
    STEM_FILTERS.filter(s => s.key === 'all' || (stemCounts[s.key] || 0) > 0),
  [stemCounts]);

  const styleCounts = useMemo(() => {
    if (!showSubFilters) return {};
    let base = familyFiltered;
    if (stemFilter !== 'all') base = base.filter(t => detectStemType(t) === stemFilter);
    const counts = {};
    for (const s of STYLE_FILTERS) {
      counts[s.key] = s.key === 'all'
        ? base.length
        : base.filter(t => detectOptionStyle(t) === s.key).length;
    }
    return counts;
  }, [familyFiltered, stemFilter, showSubFilters]);

  const visibleStyleFilters = useMemo(() =>
    STYLE_FILTERS.filter(s => s.key === 'all' || (styleCounts[s.key] || 0) > 0),
  [styleCounts]);

  const statusCounts = useMemo(() => {
    const completed = templates.filter(t => t.status === 'completed').length;
    return { all: templates.length, completed, draft: templates.length - completed };
  }, [templates]);

  const filtered = useMemo(() => {
    let list = familyFiltered;
    if (stemFilter !== 'all') list = list.filter(t => detectStemType(t) === stemFilter);
    if (styleFilter !== 'all') list = list.filter(t => detectOptionStyle(t) === styleFilter);
    if (statusFilter === 'completed') list = list.filter(t => t.status === 'completed');
    else if (statusFilter === 'draft') list = list.filter(t => t.status !== 'completed');
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(t =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [familyFiltered, stemFilter, styleFilter, statusFilter, searchText]);

  function handleDelete(id) {
    if (!confirm('确定删除此模板？')) return;
    fetch(`/api/templates/${id}`, { method: 'DELETE' }).then(r => r.json()).then(d => {
      if (d.success) setTemplates(prev => prev.filter(t => t.id !== id));
    });
  }

  async function handleSeedPresets() {
    setSeeding(true);
    try {
      const res = await fetch('/api/templates/seed', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        loadTemplates();
        if (json.data.added > 0) alert(`已加载 ${json.data.added} 个预设模板`);
        else alert('所有预设模板已存在，无需重复加载');
      }
    } catch (err) { alert('加载预设失败: ' + err.message); }
    finally { setSeeding(false); }
  }

  const familyLabel = (qt) => {
    const fam = FAMILY_MAP[qt] || qt;
    const match = QUESTION_FAMILIES.find(f => f.key === fam);
    return match ? match.label : qt;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 className="page-title">题型模板</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>设计题板布局，定义选项尺寸与文字规范</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/canvas">
            <button className="btn btn-glass">画布</button>
          </Link>
          <button className="btn btn-glass" onClick={handleSeedPresets} disabled={seeding}>
            {seeding ? '加载中...' : '加载预设模板'}
          </button>
          <Link to="/templates/new">
            <button className="btn btn-primary">+ 新建模板</button>
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      {templates.length > 0 && (
        <div className="filter-bar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Level 1: question family */}
            <div className="filter-tabs">
              {visibleFamilies.map(f => (
                <button
                  key={f.key}
                  className={`filter-tab${activeFamily === f.key ? ' active' : ''}`}
                  onClick={() => { setActiveFamily(f.key); setStemFilter('all'); setStyleFilter('all'); }}
                >
                  {f.label}
                  <span className="filter-tab-count">{familyCounts[f.key]}</span>
                </button>
              ))}
            </div>
            {/* Level 2: stem type */}
            {showSubFilters && (
              <div className="filter-tabs sub">
                {visibleStemFilters.map(s => (
                  <button
                    key={s.key}
                    className={`filter-tab sub${stemFilter === s.key ? ' active' : ''}`}
                    onClick={() => { setStemFilter(s.key); setStyleFilter('all'); }}
                  >
                    {s.label}
                    <span className="filter-tab-count">{stemCounts[s.key] || 0}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Level 3: option style */}
            {showSubFilters && (
              <div className="filter-tabs sub">
                {visibleStyleFilters.map(s => (
                  <button
                    key={s.key}
                    className={`filter-tab sub${styleFilter === s.key ? ' active' : ''}`}
                    onClick={() => setStyleFilter(s.key)}
                  >
                    {s.label}
                    <span className="filter-tab-count">{styleCounts[s.key] || 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div className="filter-tabs sub">
              {[
                { key: 'all', label: '全部', count: statusCounts.all },
                { key: 'completed', label: '✓ 已完成', count: statusCounts.completed },
                { key: 'draft', label: '编辑中', count: statusCounts.draft },
              ].map(s => (
                <button key={s.key}
                  className={`filter-tab sub${statusFilter === s.key ? ' active' : ''}`}
                  onClick={() => setStatusFilter(s.key)}
                  style={s.key === 'completed' && statusFilter === s.key ? { borderColor: 'rgba(34,197,94,0.4)', color: '#16a34a', background: 'rgba(34,197,94,0.12)' } : undefined}
                >
                  {s.label}
                  <span className="filter-tab-count">{s.count}</span>
                </button>
              ))}
            </div>
            <input
              className="glass-input"
              style={{ width: 160, fontSize: 13 }}
              placeholder="搜索..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {templates.length === 0 && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>{'\u{1F4CB}'}</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>还没有模板，加载预设或创建新模板</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-glass" onClick={handleSeedPresets} disabled={seeding}>
              {seeding ? '加载中...' : '加载预设模板'}
            </button>
            <Link to="/templates/new"><button className="btn btn-primary">+ 新建模板</button></Link>
          </div>
        </div>
      )}

      {/* Filtered empty */}
      {templates.length > 0 && filtered.length === 0 && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ color: 'var(--text-muted)' }}>没有匹配的模板</p>
        </div>
      )}

      {/* Grid */}
      <div className="template-grid">
        {filtered.map(t => {
          const tags = getTags(t);
          return (
            <Link to={`/templates/${t.id}`} key={t.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="template-card" style={{ cursor: 'pointer', ...(t.status === 'completed' ? { borderColor: 'rgba(34,197,94,0.35)' } : {}) }}>
                <div className="template-card-thumb">
                  <ThumbCanvas elements={t.elements} />
                </div>
                <div className="template-card-body">
                  <div className="template-card-name">
                    {t.name}
                    {t.isPreset && <span className="badge badge-glass" style={{ marginLeft: 6, fontSize: 10 }}>预设</span>}
                    {t.status === 'completed'
                      ? <span className="badge" style={{ marginLeft: 4, fontSize: 10, background: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' }}>✓ 已完成</span>
                      : <span className="badge" style={{ marginLeft: 4, fontSize: 10, background: 'rgba(250,204,21,0.15)', color: '#a16207', border: '1px solid rgba(250,204,21,0.3)' }}>编辑中</span>
                    }
                  </div>
                  {t.description && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {t.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    <span className="badge badge-primary">{familyLabel(t.questionType)}</span>
                    {tags.map(tag => <span className="badge badge-glass" key={tag}>{tag}</span>)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <span style={{ flex: 1 }} />
                    <button className="btn btn-glass btn-sm" onClick={e => e.stopPropagation()}>编辑</button>
                    <button className="btn btn-danger btn-sm" onClick={e => { e.preventDefault(); e.stopPropagation(); handleDelete(t.id); }}>删除</button>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
