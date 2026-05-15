import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const STATUS_MAP = { draft: '编辑中', ready: '待生产', producing: '生产中', done: '已完成' };
const STATUS_COLOR = { draft: '#a16207', ready: '#2563eb', producing: '#9333ea', done: '#16a34a' };
const THEME_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];
const THEME_STATUS = {
  active:  { label: '生产中', color: '#2563eb', icon: '🟢' },
  paused:  { label: '已暂停', color: '#a16207', icon: '⏸' },
  done:    { label: '已完成', color: '#16a34a', icon: '✅' },
};

function countQuestions(prd) {
  return (prd.epics || []).reduce((sum, e) => sum + (e.questions?.length || 0), 0);
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function NewThemeDialog({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(THEME_COLORS[Math.floor(Math.random() * THEME_COLORS.length)]);
  const [productLine, setProductLine] = useState('');
  const [bgStyle, setBgStyle] = useState('自然纪录片实拍风格');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), color, productLine, backgroundStyle: bgStyle });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={handleSubmit}
        style={{ background: '#1e293b', borderRadius: 12, padding: 24, width: 400, border: '1px solid rgba(56,189,248,0.15)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>新建主题</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>主题名称 *</label>
          <input className="glass-input" style={{ width: '100%', boxSizing: 'border-box' }}
            value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="如：昆虫世界" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>色标</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {THEME_COLORS.map(c => (
              <div key={c} onClick={() => setColor(c)}
                style={{
                  width: 24, height: 24, borderRadius: 6, background: c, cursor: 'pointer',
                  border: color === c ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: color === c ? `0 0 0 1px ${c}` : 'none',
                }} />
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>产品线</label>
          <input className="glass-input" style={{ width: '100%', boxSizing: 'border-box' }}
            value={productLine} onChange={e => setProductLine(e.target.value)} placeholder="可选" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>背景风格</label>
          <select className="glass-input" style={{ width: '100%', boxSizing: 'border-box' }}
            value={bgStyle} onChange={e => setBgStyle(e.target.value)}>
            {['自然纪录片实拍风格', '卡通2D插画', '低幼可爱插画', '写实3D渲染'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-glass" onClick={onClose}>取消</button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>创建主题</button>
        </div>
      </form>
    </div>
  );
}

function ThemeHeader({ theme, onEdit, onDelete, onStatusChange, prdCount, questionCount }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(theme.name);
  const st = THEME_STATUS[theme.status] || THEME_STATUS.active;

  function handleSave() {
    if (name.trim() && name !== theme.name) onEdit({ name: name.trim() });
    setEditing(false);
  }

  const statusKeys = Object.keys(THEME_STATUS);
  function cycleStatus() {
    const cur = statusKeys.indexOf(theme.status || 'active');
    const next = statusKeys[(cur + 1) % statusKeys.length];
    onStatusChange(next);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', marginBottom: 4 }}>
      <div style={{ width: 6, height: 28, borderRadius: 3, background: theme.color, flexShrink: 0 }} />
      {editing ? (
        <input className="glass-input" value={name} onChange={e => setName(e.target.value)}
          onBlur={handleSave} onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setName(theme.name); setEditing(false); } }}
          autoFocus style={{ fontSize: 15, fontWeight: 700, width: 200 }} />
      ) : (
        <span onDoubleClick={() => setEditing(true)}
          style={{ fontSize: 15, fontWeight: 700, cursor: 'default' }} title="双击重命名">
          {theme.name}
        </span>
      )}
      <span onClick={cycleStatus} title="点击切换状态"
        style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 10, cursor: 'pointer', fontWeight: 600,
          background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}30`,
          userSelect: 'none', transition: 'all .15s',
        }}>
        {st.icon} {st.label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {prdCount} 集 · {questionCount} 题
      </span>
      {theme.productLine && <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4 }}>{theme.productLine}</span>}
      <span style={{ flex: 1 }} />
      <button className="btn btn-glass btn-sm" style={{ fontSize: 10 }}
        onClick={() => onDelete(theme.id)}>删除主题</button>
    </div>
  );
}

function EpisodeCard({ prd, onDelete }) {
  const st = STATUS_MAP[prd.status] || prd.status;
  const stColor = STATUS_COLOR[prd.status] || '#999';
  const qCount = countQuestions(prd);
  const [hover, setHover] = useState(false);

  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Link to={`/prd/${prd.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{
          width: 150, background: 'var(--glass-bg)', borderRadius: 10,
          border: '1px solid var(--glass-border)', cursor: 'pointer',
          transition: 'transform .15s, box-shadow .15s', overflow: 'hidden',
          transform: hover ? 'translateY(-2px)' : '', boxShadow: hover ? '0 6px 20px rgba(0,0,0,0.2)' : '',
        }}>
          <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
              {prd.episode || '?'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', minHeight: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(() => { const n = parseInt(String(prd.episode || '').replace(/\D/g, '')); return n ? `第${n}集` : ''; })()}{prd.episodeTitle ? ` · ${prd.episodeTitle}` : ''}
            </div>
          </div>
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {(prd.epics || []).length} Epic · {qCount} 题
            </span>
            <span style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
              background: `${stColor}18`, color: stColor, border: `1px solid ${stColor}30`,
            }}>{st}</span>
          </div>
        </div>
      </Link>
      {hover && (
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(prd.id); }}
          style={{
            position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 4,
            background: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 12, lineHeight: '20px', textAlign: 'center', padding: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }} title="删除此集">×</button>
      )}
    </div>
  );
}

function AddEpisodeCard({ onClick }) {
  return (
    <div onClick={onClick} style={{
      width: 150, background: 'transparent', borderRadius: 10,
      border: '1px dashed rgba(56,189,248,0.2)', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 100, transition: 'border-color .15s, background .15s', color: 'var(--text-muted)',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.5)'; e.currentTarget.style.background = 'rgba(56,189,248,0.03)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.2)'; e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ fontSize: 22, marginBottom: 4 }}>+</span>
      <span style={{ fontSize: 11 }}>添加一集</span>
    </div>
  );
}

function TrashItem({ item, onRestore, onPermanent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px',
      background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 4, fontSize: 12,
    }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>📄</span>
      <span style={{ flex: 1, color: 'var(--text-secondary)' }}>
        {item.theme ? `${item.theme} · ` : ''}{item.name || item.id}
        {item.episode ? ` (第${parseInt(String(item.episode).replace(/\D/g, '')) || item.episode}集)` : ''}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>删除于 {fmtDate(item.deletedAt)}</span>
      <button className="btn btn-glass btn-sm" style={{ fontSize: 10, padding: '1px 8px' }}
        onClick={() => onRestore(item.id)}>恢复</button>
      <button className="btn btn-sm" style={{ fontSize: 10, padding: '1px 8px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 4, cursor: 'pointer' }}
        onClick={() => onPermanent(item.id)}>永久删除</button>
    </div>
  );
}

export default function PrdList() {
  const [themes, setThemes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [trash, setTrash] = useState([]);
  const [showNewTheme, setShowNewTheme] = useState(false);
  const [search, setSearch] = useState('');
  const [plFilter, setPlFilter] = useState('all');
  const [tsFilter, setTsFilter] = useState('all');
  const [collapsed, setCollapsed] = useState({});
  const [trashOpen, setTrashOpen] = useState(false);
  const navigate = useNavigate();

  const loadAll = useCallback(async () => {
    const [tRes, pRes, trRes] = await Promise.all([
      fetch('/api/themes').then(r => r.json()),
      fetch('/api/prd').then(r => r.json()),
      fetch('/api/prd/trash/list').then(r => r.json()),
    ]);
    if (tRes.success) setThemes(tRes.data);
    if (pRes.success) setProjects(pRes.data);
    if (trRes.success) setTrash(trRes.data);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const productLines = [...new Set(themes.map(t => t.productLine).filter(Boolean))];

  async function handleCreateTheme(data) {
    const res = await fetch('/api/themes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.success) { setShowNewTheme(false); loadAll(); }
  }

  async function handleEditTheme(id, data) {
    await fetch(`/api/themes/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    loadAll();
  }

  async function handleDeleteTheme(id) {
    const prds = projects.filter(p => p.themeId === id);
    const msg = prds.length > 0
      ? `此主题下有 ${prds.length} 集内容，删除主题后这些 PRD 将变为"未分组"。确定删除？`
      : '确定删除此主题？';
    if (!confirm(msg)) return;
    await fetch(`/api/themes/${id}`, { method: 'DELETE' });
    loadAll();
  }

  async function handleAddEpisode(theme) {
    const themePrds = projects.filter(p => p.themeId === theme.id);
    const epNum = ep => parseInt(String(ep || '').replace(/\D/g, '')) || 0;
    const maxEp = themePrds.reduce((m, p) => Math.max(m, epNum(p.episode)), 0);
    const newPrd = {
      name: `${theme.name}-第${maxEp + 1}集`,
      themeId: theme.id, theme: theme.name,
      productLine: theme.productLine || '',
      episode: String(maxEp + 1), episodeTitle: '',
      backgroundStyle: theme.backgroundStyle || '自然纪录片实拍风格',
      voiceStyle: theme.voiceStyle || '儿童科普风格，语速适中，亲切活泼',
    };
    const res = await fetch('/api/prd', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPrd),
    });
    const json = await res.json();
    if (json.success) navigate(`/prd/${json.data.id}`);
  }

  async function handleDeletePrd(id) {
    if (!confirm('确定删除？删除后可在回收站恢复。')) return;
    await fetch(`/api/prd/${id}`, { method: 'DELETE' });
    loadAll();
  }

  async function handleRestore(id) {
    await fetch(`/api/prd/${id}/restore`, { method: 'POST' });
    loadAll();
  }

  async function handlePermanentDelete(id) {
    if (!confirm('永久删除后无法恢复，确定？')) return;
    await fetch(`/api/prd/${id}/permanent`, { method: 'DELETE' });
    loadAll();
  }

  let filteredThemes = themes;
  if (plFilter !== 'all') filteredThemes = filteredThemes.filter(t => t.productLine === plFilter);
  if (tsFilter !== 'all') filteredThemes = filteredThemes.filter(t => (t.status || 'active') === tsFilter);

  const filteredProjects = search
    ? projects.filter(p => (p.name || '').includes(search) || (p.theme || '').includes(search) || (p.episodeTitle || '').includes(search))
    : projects;

  const ungrouped = filteredProjects.filter(p => !p.themeId || !themes.find(t => t.id === p.themeId));

  const statusOrder = { active: 0, paused: 1, done: 2 };
  const sortedThemes = [...filteredThemes].sort((a, b) => (statusOrder[a.status || 'active'] || 0) - (statusOrder[b.status || 'active'] || 0));

  const grouped = {};
  for (const t of sortedThemes) {
    const s = t.status || 'active';
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(t);
  }

  function renderThemeGroup(statusKey) {
    const list = grouped[statusKey];
    if (!list || list.length === 0) return null;
    const si = THEME_STATUS[statusKey] || THEME_STATUS.active;
    const isDone = statusKey === 'done';
    const groupCollapsed = collapsed[`_group_${statusKey}`];

    return (
      <div key={statusKey} style={{ marginBottom: 8 }}>
        {Object.keys(grouped).length > 1 && (
          <div onClick={() => setCollapsed(prev => ({ ...prev, [`_group_${statusKey}`]: !prev[`_group_${statusKey}`] }))}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', transition: 'transform .15s', transform: groupCollapsed ? '' : 'rotate(90deg)', display: 'inline-block' }}>▶</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: si.color }}>{si.icon} {si.label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({list.length})</span>
          </div>
        )}
        {!groupCollapsed && list.map(theme => {
          const themePrds = filteredProjects
            .filter(p => p.themeId === theme.id)
            .sort((a, b) => (parseInt(String(a.episode || '').replace(/\D/g, '')) || 0) - (parseInt(String(b.episode || '').replace(/\D/g, '')) || 0));
          const totalQ = themePrds.reduce((s, p) => s + countQuestions(p), 0);
          const isCollapsed = collapsed[theme.id];

          if (search && themePrds.length === 0) return null;

          return (
            <div key={theme.id} style={{
              marginBottom: 12, background: 'var(--glass-bg)', borderRadius: 12,
              border: '1px solid var(--glass-border)', overflow: 'hidden',
              opacity: isDone ? 0.7 : 1,
            }}>
              <div style={{ padding: '4px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                onClick={() => setCollapsed(prev => ({ ...prev, [theme.id]: !prev[theme.id] }))}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 8, transition: 'transform .15s', transform: isCollapsed ? '' : 'rotate(90deg)', display: 'inline-block' }}>▶</span>
                <div style={{ flex: 1 }} onClick={e => e.stopPropagation()}>
                  <ThemeHeader theme={theme} prdCount={themePrds.length} questionCount={totalQ}
                    onEdit={data => handleEditTheme(theme.id, data)}
                    onDelete={handleDeleteTheme}
                    onStatusChange={status => handleEditTheme(theme.id, { status })} />
                </div>
              </div>

              {!isCollapsed && (
                <div style={{ padding: '4px 16px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
                  {themePrds.map(p => <EpisodeCard key={p.id} prd={p} onDelete={handleDeletePrd} />)}
                  <AddEpisodeCard onClick={() => handleAddEpisode(theme)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">PRD 工作台</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            按主题组织内容，每集独立编辑，关联模板后一键生产
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-glass" onClick={() => setShowNewTheme(true)}>+ 新建主题</button>
          <button className="btn btn-primary" onClick={() => navigate('/prd/new')}>+ 新建 PRD</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="glass-input" style={{ width: 220 }} placeholder="搜索主题、集标题..."
          value={search} onChange={e => setSearch(e.target.value)} />
        {productLines.length > 0 && (
          <select className="glass-input" style={{ width: 'auto', minWidth: 100 }}
            value={plFilter} onChange={e => setPlFilter(e.target.value)}>
            <option value="all">全部产品线</option>
            {productLines.map(pl => <option key={pl} value={pl}>{pl}</option>)}
          </select>
        )}
        <select className="glass-input" style={{ width: 'auto', minWidth: 90 }}
          value={tsFilter} onChange={e => setTsFilter(e.target.value)}>
          <option value="all">全部状态</option>
          {Object.entries(THEME_STATUS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {filteredThemes.length} 个主题 · {projects.length} 个 PRD
        </span>
      </div>

      {/* Theme groups by status */}
      {['active', 'paused', 'done'].map(s => renderThemeGroup(s))}

      {/* Ungrouped PRDs */}
      {ungrouped.length > 0 && (
        <div style={{
          marginBottom: 20, background: 'var(--glass-bg)', borderRadius: 12,
          border: '1px solid var(--glass-border)', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 28, borderRadius: 3, background: '#64748b', flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>未分组</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ungrouped.length} 个</span>
          </div>
          <div style={{ padding: '4px 16px 16px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {ungrouped.map(p => (
              <div key={p.id} style={{ position: 'relative' }}
                onMouseEnter={e => { const btn = e.currentTarget.querySelector('.del-btn'); if (btn) btn.style.opacity = 1; e.currentTarget.querySelector('.card-inner').style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { const btn = e.currentTarget.querySelector('.del-btn'); if (btn) btn.style.opacity = 0; e.currentTarget.querySelector('.card-inner').style.transform = ''; }}>
                <Link to={`/prd/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="card-inner" style={{
                    width: 150, background: 'rgba(255,255,255,0.02)', borderRadius: 10,
                    border: '1px solid var(--glass-border)', cursor: 'pointer', padding: 12,
                    transition: 'transform .15s',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{p.name || '未命名'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {(p.epics || []).length} Epic · {countQuestions(p)} 题
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 4,
                        background: `${STATUS_COLOR[p.status] || '#999'}18`, color: STATUS_COLOR[p.status] || '#999',
                      }}>{STATUS_MAP[p.status] || p.status}</span>
                    </div>
                  </div>
                </Link>
                <button className="del-btn" onClick={e => { e.preventDefault(); e.stopPropagation(); handleDeletePrd(p.id); }}
                  style={{
                    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 4,
                    background: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', cursor: 'pointer',
                    fontSize: 12, lineHeight: '20px', textAlign: 'center', padding: 0, opacity: 0,
                    transition: 'opacity .15s',
                  }}
                  title="删除">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trash */}
      {trash.length > 0 && (
        <div style={{
          marginBottom: 20, background: 'var(--glass-bg)', borderRadius: 12,
          border: '1px solid var(--glass-border)', overflow: 'hidden', opacity: 0.7,
        }}>
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            onClick={() => setTrashOpen(!trashOpen)}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', transition: 'transform .15s', transform: trashOpen ? 'rotate(90deg)' : '', display: 'inline-block' }}>▶</span>
            <span style={{ fontSize: 14 }}>🗑</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>回收站</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{trash.length} 个 · 30天后自动清除</span>
          </div>
          {trashOpen && (
            <div style={{ padding: '0 16px 12px' }}>
              {trash.map(item => (
                <TrashItem key={item.id} item={item}
                  onRestore={handleRestore} onPermanent={handlePermanentDelete} />
              ))}
            </div>
          )}
        </div>
      )}

      {themes.length === 0 && ungrouped.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 14, marginBottom: 6 }}>还没有主题，先创建一个主题吧</div>
          <div style={{ fontSize: 12, marginBottom: 16 }}>主题 = 文件夹，每集内容在主题下独立编辑</div>
          <button className="btn btn-primary" onClick={() => setShowNewTheme(true)}>+ 新建主题</button>
        </div>
      )}

      {showNewTheme && <NewThemeDialog onClose={() => setShowNewTheme(false)} onCreate={handleCreateTheme} />}
    </div>
  );
}
