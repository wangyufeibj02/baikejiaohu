import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

const STATUS_MAP = {
  draft:     { label: '草稿',   color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
  producing: { label: '生产中', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  completed: { label: '已完成', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  error:     { label: '出错',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};
const OPT_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function SectionHeader({ sKey, collapsed, toggle, label }) {
  return (
    <div
      className="panel-section-title"
      onClick={() => toggle(sKey)}
      style={{ marginBottom: collapsed[sKey] ? 0 : 8, marginTop: 2 }}
    >
      <span style={{ fontSize: 10, transition: 'transform 0.15s', display: 'inline-block', transform: collapsed[sKey] ? 'rotate(-90deg)' : 'rotate(0)' }}>▼</span>
      {label}
    </div>
  );
}

function Row({ label, children, fullWidth }) {
  return (
    <div style={{ display: 'flex', alignItems: fullWidth ? 'flex-start' : 'center', gap: 8, marginBottom: 8 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', width: 72, flexShrink: 0, textAlign: 'right' }}>{label}</label>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function QuestionEditor({ question, templates, collapsed, toggleSection, onChange, onUpdate }) {
  const q = question;

  function addOption() {
    onUpdate(q => {
      const idx = q.options.length;
      q.options.push({ label: OPT_LABELS[idx] || `${idx + 1}`, text: '', mediaType: '实拍图+文字', imageDesc: '' });
    });
  }

  function removeOption(oi) {
    if (q.options.length <= 2) return;
    onUpdate(q => {
      q.options.splice(oi, 1);
      q.options.forEach((o, i) => { o.label = OPT_LABELS[i] || `${i + 1}`; });
    });
  }

  function addVoiceLine() {
    onUpdate(q => { q.voiceLines = q.voiceLines || []; q.voiceLines.push(''); });
  }

  function removeVoiceLine(vi) {
    onUpdate(q => { q.voiceLines.splice(vi, 1); });
  }

  const effectTargets = useMemo(() => [
    { value: '', label: '空' },
    { value: '题干图', label: '题干图' },
    { value: '动效区', label: '动效区' },
    ...(q.options || []).map(o => ({ value: `选项${o.label}`, label: `选项${o.label}` })),
  ], [q.options]);

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        题目 {q.id}
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.08)', color: '#6366f1', fontWeight: 500 }}>
          {q.type || '单选题'}
        </span>
      </div>

      {/* 基本信息 */}
      <div className="glass-card" style={{ marginBottom: 12, padding: 16 }}>
        <SectionHeader sKey="basic" collapsed={collapsed} toggle={toggleSection} label="基本信息" />
        {!collapsed.basic && (
          <div>
            <Row label="题型">
              <select className="glass-input" defaultValue={q.type || '单选题'} onChange={e => onChange('type', e.target.value)}>
                <option>单选题</option><option>多选题</option><option>拖拽题</option>
              </select>
            </Row>
            <Row label="题目编号">
              <input className="glass-input" defaultValue={q.id || ''} onBlur={e => onChange('id', e.target.value)} />
            </Row>
            <Row label="题板模板">
              <select className="glass-input" defaultValue={q.templateId || ''} onChange={e => onChange('templateId', e.target.value)}>
                <option value="">请选择模板</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Row>
            <Row label="正确答案">
              <input className="glass-input" defaultValue={q.correctAnswer || ''} onBlur={e => onChange('correctAnswer', e.target.value)} />
            </Row>
            <Row label="美术风格">
              <input className="glass-input" defaultValue={q.artStyle || ''} onBlur={e => onChange('artStyle', e.target.value)} />
            </Row>
          </div>
        )}
      </div>

      {/* 题干 */}
      <div className="glass-card" style={{ marginBottom: 12, padding: 16 }}>
        <SectionHeader sKey="stem" collapsed={collapsed} toggle={toggleSection} label="题干" />
        {!collapsed.stem && (
          <div>
            <Row label="题干文字" fullWidth>
              <textarea className="glass-input" style={{ minHeight: 60, resize: 'vertical' }} defaultValue={q.stem || ''} onBlur={e => onChange('stem', e.target.value)} />
            </Row>
            <Row label="题干图片">
              <select className="glass-input" defaultValue={q.stemImage || '无'} onChange={e => onChange('stemImage', e.target.value)}>
                <option>无</option><option>实拍图</option><option>AI生成</option><option>上传</option>
              </select>
            </Row>
            {q.stemImage && q.stemImage !== '无' && (
              <Row label="图片描述" fullWidth>
                <textarea className="glass-input" style={{ minHeight: 40, resize: 'vertical' }} defaultValue={q.stemImageDesc || ''} onBlur={e => onChange('stemImageDesc', e.target.value)} />
              </Row>
            )}
          </div>
        )}
      </div>

      {/* 选项 */}
      <div className="glass-card" style={{ marginBottom: 12, padding: 16 }}>
        <SectionHeader sKey="options" collapsed={collapsed} toggle={toggleSection} label={`选项 (${(q.options || []).length})`} />
        {!collapsed.options && (
          <div>
            {(q.options || []).map((opt, oi) => (
              <div key={oi} style={{ padding: '8px 10px', marginBottom: 6, borderRadius: 8, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', width: 20 }}>{opt.label}</span>
                  <input className="glass-input" style={{ flex: 1 }} defaultValue={opt.text || ''} placeholder="选项文字"
                    onBlur={e => onUpdate(q => { q.options[oi].text = e.target.value; })} />
                  <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                    onClick={() => removeOption(oi)} title="删除选项">×</button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 26 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>媒体类型</label>
                    <select className="glass-input" defaultValue={opt.mediaType || '实拍图+文字'}
                      onChange={e => onUpdate(q => { q.options[oi].mediaType = e.target.value; })}>
                      <option>实拍图+文字</option><option>文字</option><option>纯图片</option><option>AI生成</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>图片描述</label>
                    <input className="glass-input" defaultValue={opt.imageDesc || ''} placeholder="图片描述"
                      onBlur={e => onUpdate(q => { q.options[oi].imageDesc = e.target.value; })} />
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-glass btn-sm" onClick={addOption} style={{ marginTop: 4 }}>+ 添加选项</button>
          </div>
        )}
      </div>

      {/* 动效 */}
      <div className="glass-card" style={{ marginBottom: 12, padding: 16 }}>
        <SectionHeader sKey="effects" collapsed={collapsed} toggle={toggleSection} label="动效" />
        {!collapsed.effects && (
          <div>
            {['opening', 'correct', 'wrong'].map(ek => {
              const eff = q.effects?.[ek] || { target: '', description: '', duration: 4 };
              const labels = { opening: '开场', correct: '答对', wrong: '答错' };
              return (
                <div key={ek} style={{ padding: '8px 10px', marginBottom: 6, borderRadius: 8, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.4)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{labels[ek]}</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>目标</label>
                      <select className="glass-input" defaultValue={eff.target}
                        onChange={e => onUpdate(q => { q.effects = q.effects || {}; q.effects[ek] = q.effects[ek] || {}; q.effects[ek].target = e.target.value; })}>
                        {effectTargets.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div style={{ width: 80 }}>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>时长(秒)</label>
                      <input className="glass-input" type="number" defaultValue={eff.duration ?? 4}
                        onBlur={e => onUpdate(q => { q.effects = q.effects || {}; q.effects[ek] = q.effects[ek] || {}; q.effects[ek].duration = parseFloat(e.target.value) || 4; })} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>描述</label>
                    <textarea className="glass-input" style={{ minHeight: 36, resize: 'vertical' }} defaultValue={eff.description || ''}
                      onBlur={e => onUpdate(q => { q.effects = q.effects || {}; q.effects[ek] = q.effects[ek] || {}; q.effects[ek].description = e.target.value; })} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 语音 */}
      <div className="glass-card" style={{ marginBottom: 12, padding: 16 }}>
        <SectionHeader sKey="voice" collapsed={collapsed} toggle={toggleSection} label={`语音 (${(q.voiceLines || []).length})`} />
        {!collapsed.voice && (
          <div>
            {(q.voiceLines || []).map((vl, vi) => (
              <div key={vi} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 20, textAlign: 'right' }}>{vi + 1}</span>
                <input className="glass-input" style={{ flex: 1 }} defaultValue={vl}
                  onBlur={e => onUpdate(q => { q.voiceLines[vi] = e.target.value; })} />
                <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                  onClick={() => removeVoiceLine(vi)} title="删除">×</button>
              </div>
            ))}
            <button className="btn btn-glass btn-sm" onClick={addVoiceLine} style={{ marginTop: 4 }}>+ 添加语音</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PrdEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prd, setPrd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [sidebarW, setSidebarW] = useState(() => {
    const v = parseInt(localStorage.getItem('prd-sidebar-w'));
    return isNaN(v) ? 260 : v;
  });
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('prd-collapse')) || {}; } catch { return {}; }
  });
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);
  const dragging = useRef(false);

  useEffect(() => {
    fetch(`/api/prd/${id}`).then(r => r.json()).then(d => {
      if (d.success) setPrd(d.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(d => { if (d.success) setTemplates(d.data); }).catch(() => {});
  }, []);

  const autoSave = useCallback((data) => {
    clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/prd/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch { /* silent */ }
      setSaving(false);
    }, 1000);
  }, [id]);

  function updatePrd(fn) {
    setPrd(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      autoSave(next);
      return next;
    });
  }

  const question = useMemo(() => {
    if (!prd || !sel) return null;
    return prd.epics?.[sel.ei]?.questions?.[sel.qi] || null;
  }, [prd, sel]);

  function updateQ(field, value) {
    updatePrd(d => {
      if (d.epics?.[sel.ei]?.questions?.[sel.qi]) {
        d.epics[sel.ei].questions[sel.qi][field] = value;
      }
    });
  }

  function toggleSection(key) {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('prd-collapse', JSON.stringify(next));
      return next;
    });
  }

  // Sidebar drag resize
  useEffect(() => {
    function onMouseMove(e) {
      if (!dragging.current) return;
      const w = Math.max(200, Math.min(500, e.clientX));
      setSidebarW(w);
      localStorage.setItem('prd-sidebar-w', String(w));
    }
    function onMouseUp() {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  function addEpic() {
    updatePrd(d => {
      d.epics = d.epics || [];
      d.epics.push({ id: `ep_${Date.now().toString(36)}`, title: `Epic${d.epics.length + 1}`, questions: [] });
    });
  }

  function deleteEpic(ei) {
    if (!confirm('确定删除此 Epic 及其所有题目？')) return;
    updatePrd(d => { d.epics.splice(ei, 1); });
    if (sel?.ei === ei) setSel(null);
    else if (sel && sel.ei > ei) setSel({ ei: sel.ei - 1, qi: sel.qi });
  }

  function addQuestion(ei) {
    updatePrd(d => {
      const epic = d.epics[ei];
      const qNum = epic.questions.length + 1;
      epic.questions.push({
        id: `E${ei + 1}-${qNum}`,
        type: '单选题',
        stem: '',
        stemImage: '无',
        stemImageDesc: '',
        correctAnswer: '',
        templateId: '',
        artStyle: '',
        options: [
          { label: 'A', text: '', mediaType: '实拍图+文字', imageDesc: '' },
          { label: 'B', text: '', mediaType: '实拍图+文字', imageDesc: '' },
          { label: 'C', text: '', mediaType: '实拍图+文字', imageDesc: '' },
        ],
        effects: {
          opening: { target: '', description: '', duration: 4 },
          correct: { target: '', description: '', duration: 4 },
          wrong:   { target: '', description: '', duration: 4 },
        },
        voiceLines: [],
      });
    });
  }

  function deleteQuestion(ei, qi) {
    if (!confirm('确定删除此题目？')) return;
    updatePrd(d => { d.epics[ei].questions.splice(qi, 1); });
    if (sel?.ei === ei && sel?.qi === qi) setSel(null);
    else if (sel?.ei === ei && sel.qi > qi) setSel({ ei, qi: sel.qi - 1 });
  }

  async function handleProduce() {
    if (!confirm('确定要一键生产此 PRD 的所有题目？')) return;
    try {
      const res = await fetch(`/api/prd/${id}/produce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prd),
      });
      const json = await res.json();
      if (json.success) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json.data),
        });
        alert('生产任务已提交');
        navigate('/tasks');
      } else {
        alert(json.error || '生产失败');
      }
    } catch (e) {
      alert('生产请求失败: ' + e.message);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontSize: 14 }}>
        <div className="spinner" style={{ marginRight: 10 }} />加载中...
      </div>
    );
  }
  if (!prd) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontSize: 14, flexDirection: 'column', gap: 12 }}>
        <span>PRD 项目不存在</span>
        <Link to="/" className="btn btn-glass btn-sm">返回工作台</Link>
      </div>
    );
  }

  const st = STATUS_MAP[prd.status] || STATUS_MAP.draft;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecf4 50%, #f5f3ff 100%)' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
        background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--glass-border)', zIndex: 10, flexShrink: 0,
      }}>
        <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← 返回
        </Link>
        <span style={{ width: 1, height: 20, background: 'var(--glass-border)' }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{prd.name || '未命名 PRD'}</span>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color, fontWeight: 500 }}>
          {st.label}
        </span>
        {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>保存中...</span>}
        <span style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={handleProduce}>一键生产</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <div style={{
          width: sidebarW, minWidth: 200, overflow: 'hidden',
          background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
          borderRight: '1px solid var(--glass-border)',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          {/* Theme info */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              项目信息
            </div>
            {[
              ['主题', prd.theme || prd.themeId || '-'],
              ['集数', prd.episode || '-'],
              ['产品线', prd.productLine || '-'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>{k}</span>
                <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Epic list */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
            {(prd.epics || []).map((epic, ei) => (
              <div key={epic.id || ei}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '6px 14px', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {epic.title || `Epic ${ei + 1}`}
                  </span>
                  <button
                    style={{ padding: '1px 6px', fontSize: 13, background: 'transparent', color: 'var(--ice-border)', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                    title="添加题目" onClick={() => addQuestion(ei)}
                  >+</button>
                  <button
                    style={{ padding: '1px 6px', fontSize: 13, background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                    title="删除 Epic" onClick={() => deleteEpic(ei)}
                  >×</button>
                </div>
                {(epic.questions || []).map((q, qi) => {
                  const active = sel?.ei === ei && sel?.qi === qi;
                  return (
                    <div
                      key={q.id || qi}
                      onClick={() => setSel({ ei, qi })}
                      style={{
                        padding: '5px 14px 5px 24px', cursor: 'pointer', fontSize: 12,
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: active ? 'rgba(79,70,229,0.08)' : 'transparent',
                        color: active ? 'var(--primary)' : 'var(--text-secondary)',
                        borderLeft: active ? '2px solid var(--primary)' : '2px solid transparent',
                        transition: 'all 0.1s',
                      }}
                    >
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.id}</span>
                      <span style={{ fontSize: 10, padding: '0 4px', borderRadius: 3, background: 'rgba(99,102,241,0.08)', color: '#6366f1', flexShrink: 0 }}>
                        {q.type || '单选题'}
                      </span>
                      <span style={{ flex: 1 }} />
                      <button
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: '0 2px', flexShrink: 0 }}
                        onClick={e => { e.stopPropagation(); deleteQuestion(ei, qi); }}
                      >×</button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--glass-border)' }}>
            <button className="btn btn-glass btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={addEpic}>
              + 添加 Epic
            </button>
          </div>
        </div>

        {/* Drag handle */}
        <div
          style={{ width: 4, cursor: 'col-resize', background: 'transparent', transition: 'background 0.15s', flexShrink: 0 }}
          onMouseDown={() => { dragging.current = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--ice-border)'; }}
          onMouseLeave={e => { if (!dragging.current) e.currentTarget.style.background = 'transparent'; }}
        />

        {/* Right panel */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {question ? (
            <QuestionEditor
              key={`${sel.ei}-${sel.qi}`}
              question={question}
              templates={templates}
              collapsed={collapsed}
              toggleSection={toggleSection}
              onChange={(field, value) => updateQ(field, value)}
              onUpdate={(fn) => updatePrd(d => { fn(d.epics[sel.ei].questions[sel.qi]); })}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
              ← 请从左侧选择一个题目进行编辑
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
