import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WorkspacePanel from './WorkspacePanel';

const QUESTION_TYPES = ['单选题', '多选题', '拖拽题', '连线题', '点选题'];
const MEDIA_TYPES = ['文字', '文字+拼音', '图片+文字', '图片'];
const STEM_MEDIA_TYPES = ['无', '有'];
const VOICE_TIMINGS = ['进入时自动播放', '点击播放按钮', '无'];
const EFFECT_TARGETS = ['无', '题干图', '选项A', '选项B', '选项C', '选项D', '背景', '全屏', '动效区'];
const BG_STYLE_GROUPS = [
  { label: '实拍类', styles: [
    { name: '自然纪录片实拍', desc: '自然实拍风格，高清写实，柔和自然光影，真实环境场景，纪录片镜头感，景深虚化背景突出主体' },
    { name: '人文纪实摄影', desc: '人文纪实摄影风格，自然光线，真实生活场景，温暖色调，抓拍质感，画面富有故事性' },
    { name: '微距特写摄影', desc: '微距特写摄影风格，超近距离拍摄，极致细节呈现，浅景深柔和虚化背景，色彩鲜明饱和' },
  ]},
  { label: '2D插画类', styles: [
    { name: '扁平矢量插画', desc: '扁平矢量插画风格，简洁几何造型，纯色色块填充，无渐变无阴影，明快鲜艳配色，现代简约' },
    { name: '水彩手绘插画', desc: '水彩手绘插画风格，透明叠色晕染，柔和过渡边缘，纸张纹理质感，淡雅清新色调，自然笔触' },
    { name: '低幼可爱卡通', desc: '低幼可爱卡通风格，圆润Q版造型，大眼睛大头身比例，糖果色系明亮饱和，简洁干净背景' },
    { name: '日系动漫插画', desc: '日系动漫插画风格，精致线条描边，大眼睛细节丰富，光影层次分明，色彩鲜艳，赛璐璐着色' },
    { name: '写实厚涂插画', desc: '写实厚涂插画风格，油画般笔触肌理，丰富色彩层次，强烈明暗对比，细腻光影过渡，浓郁质感' },
    { name: '线描简笔画', desc: '线描简笔画风格，黑色线条勾勒轮廓，极简造型概括，留白空间大，偶尔点缀少量色彩' },
  ]},
  { label: '国风类', styles: [
    { name: '中国风水墨', desc: '中国传统水墨画风格，墨色浓淡干湿变化丰富，大面积留白意境深远，宣纸纹理质感，写意笔触洒脱' },
    { name: '国风工笔重彩', desc: '国风工笔重彩风格，精细线条勾勒，矿物颜料色彩浓郁沉稳，层层渲染层次丰富，典雅华丽' },
  ]},
  { label: '3D渲染类', styles: [
    { name: '3D写实渲染', desc: '3D写实渲染风格，真实材质贴图，物理光照模拟，精细建模高多边形，照片级渲染质感' },
    { name: '3D卡通渲染', desc: '3D卡通渲染风格，圆润光滑造型，明快色彩饱和度高，柔和漫反射光影，立体可爱质感' },
    { name: '3D三渲二', desc: '3D三渲二风格，三维建模二维渲染效果，扁平化着色描边，保留立体空间感但呈现手绘质感' },
    { name: '3D低多边形', desc: '3D低多边形风格，几何面片构成，棱角分明的造型，每个面单一色块，简约现代艺术感' },
    { name: '新国风三维渲染', desc: '新国风三维渲染风格，东方美学造型与三维技术结合，色彩明亮饱和，柔和自然光影，造型融入国风元素' },
  ]},
  { label: '特殊风格', styles: [
    { name: '剪纸拼贴风', desc: '剪纸拼贴风格，纸张裁切层叠效果，轻微立体阴影，色彩鲜明对比，手工制作质感，边缘锯齿自然' },
    { name: '像素复古风', desc: '像素复古风格，方块像素点阵构成画面，有限调色板，8-bit复古游戏画面感，清晰锐利边缘' },
  ]},
];
const ALL_PRESET_STYLES = BG_STYLE_GROUPS.flatMap(g => g.styles);
function getPresetDesc(name) {
  const found = ALL_PRESET_STYLES.find(s => s.name === name);
  return found ? found.desc : '';
}

const TTS_ENGINES = {
  ttshub: {
    label: '猿辅导TTS',
    voices: [
      { id: 'xiaoyuan', label: '小媛' },
      { id: 'shandian', label: '闪电' },
      { id: 'pipi_v2', label: '皮皮' },
    ],
  },
  doubao: {
    label: '豆包',
    voices: [
      { id: 'zh_female_vv_uranus_bigtts', label: '温柔女声' },
      { id: 'zh_female_shuangkuai_bigtts', label: '爽快女声' },
      { id: 'zh_female_qingche_bigtts', label: '清澈女声' },
      { id: 'zh_female_wanwanxiaohe_bigtts', label: '甜美女声' },
      { id: 'zh_male_chunhou_bigtts', label: '醇厚男声' },
      { id: 'zh_male_jingqiangkanye_bigtts', label: '京腔男声' },
      { id: 'zh_female_tianmeixiaoyuan_bigtts', label: '甜美小媛' },
      { id: 'zh_male_wennuanahu_bigtts', label: '温暖阿虎' },
    ],
  },
  minimax: {
    label: 'Minimax',
    voices: [
      { id: 'male-qn-qingse', label: '青涩男声' },
      { id: 'female-shaonv', label: '少女女声' },
      { id: 'female-yujie', label: '御姐女声' },
      { id: 'male-qn-jingying', label: '精英男声' },
      { id: 'female-chengshu', label: '成熟女声' },
      { id: 'male-qn-badao', label: '霸道男声' },
    ],
  },
  gemini: {
    label: 'Gemini',
    voices: [
      { id: 'Kore', label: 'Kore (女声)' },
      { id: 'Charon', label: 'Charon (男声)' },
      { id: 'Fenrir', label: 'Fenrir (男声)' },
      { id: 'Aoede', label: 'Aoede (女声)' },
      { id: 'Puck', label: 'Puck (男声)' },
    ],
  },
  azure: {
    label: 'Azure',
    voices: [
      { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (女声)' },
      { id: 'zh-CN-YunxiNeural', label: '云希 (男声)' },
      { id: 'zh-CN-XiaoyiNeural', label: '晓伊 (女声)' },
      { id: 'zh-CN-YunjianNeural', label: '云健 (男声)' },
      { id: 'zh-CN-XiaochenNeural', label: '晓辰 (女声)' },
      { id: 'zh-CN-YunfengNeural', label: '云枫 (男声)' },
    ],
  },
};

const TYPE_TO_QT = {
  '单选题': 'choice', '多选题': 'choice',
  '拖拽题': 'drag', '连线题': 'connect', '点选题': 'hotspot',
};
const STEM_TYPE_LABELS = { text: '文字题干', image: '图片题干', audio: '语音题干' };
const OPT_STYLE_LABELS = { text: '文字选项', image: '图片选项', imageText: '图文选项' };

function uid() { return Math.random().toString(36).slice(2, 8); }

function newQuestion(epicIdx, qIdx) {
  return {
    _key: uid(),
    id: `E${epicIdx + 1}-${qIdx + 1}`, type: '单选题', stem: '', stemImage: '无', stemImageDesc: '',
    correctAnswer: '',
    options: [
      { label: 'A', text: '', mediaType: '图片+文字', imageDesc: '' },
      { label: 'B', text: '', mediaType: '图片+文字', imageDesc: '' },
      { label: 'C', text: '', mediaType: '图片+文字', imageDesc: '' },
    ],
    analysis: '', examPoint: '', templateId: '', epicLabel: '',
    effects: { opening: { description: '', duration: 4, target: '' }, correct: { description: '', duration: 4, target: '' }, wrong: { description: '', duration: 4, target: '' } },
    voiceLines: [],
    artStyle: '实拍',
  };
}

function newEpic(idx) { return { id: uid(), title: `E${idx + 1}`, questions: [newQuestion(idx, 0)] }; }

if (!document.getElementById('produce-btn-anim')) {
  const style = document.createElement('style');
  style.id = 'produce-btn-anim';
  style.textContent = `
    @keyframes producePulse { 0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,0.15)} 50%{box-shadow:0 0 0 4px rgba(37,99,235,0.08)} }
    @keyframes produceBounce { 0%{transform:scale(1)} 40%{transform:scale(0.85)} 100%{transform:scale(1)} }
    .produce-btn { animation: producePulse 3s ease-in-out infinite; transition: all .2s; }
    .produce-btn:hover { background: linear-gradient(135deg,#2563eb,#60a5fa) !important; color: #fff !important; box-shadow: 0 0 8px rgba(37,99,235,0.4) !important; transform: scale(1.15); }
    .produce-btn:active { animation: produceBounce .3s; background: #059669 !important; }
  `;
  document.head.appendChild(style);
}

const S = {
  tag: { color: '#dc2626', fontWeight: 700, fontSize: 12, userSelect: 'none', flexShrink: 0 },
  text: { background: 'none', border: 'none', outline: 'none', font: 'inherit', color: '#334155', padding: 0, width: '100%' },
  textFocus: { borderBottom: '1px solid #2563eb', background: '#eff6ff' },
  sel: { background: 'none', border: '1px solid transparent', outline: 'none', font: 'inherit', color: '#334155', cursor: 'pointer', padding: '0 2px', borderRadius: 3 },
  selHover: { border: '1px solid #cbd5e1', background: '#f8fafc' },
};

function InText({ value, onChange, placeholder, multiline, style }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);
  if (!editing) {
    return (
      <span onClick={e => { e.stopPropagation(); setEditing(true); }}
        style={{ ...S.text, cursor: 'text', color: value ? '#334155' : '#94a3b8', minHeight: 18, display: 'inline', ...style }}
        title="点击编辑">{value || placeholder || '点击编辑...'}</span>
    );
  }
  const shared = {
    ref, value: value || '', onChange: e => onChange(e.target.value),
    onBlur: () => setEditing(false), onKeyDown: e => { if (e.key === 'Escape' || (!multiline && e.key === 'Enter')) setEditing(false); },
    onClick: e => e.stopPropagation(), style: { ...S.text, ...S.textFocus, borderRadius: 3, padding: '1px 4px', ...style }, placeholder,
  };
  return multiline
    ? <textarea {...shared} rows={2} style={{ ...shared.style, resize: 'vertical', minHeight: 40, display: 'block', width: '100%' }} />
    : <input type="text" {...shared} />;
}

function InSelect({ value, options, onChange, style }) {
  const [hover, setHover] = useState(false);
  return (
    <select value={value} onChange={e => onChange(e.target.value)} onClick={e => e.stopPropagation()}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...S.sel, ...(hover ? S.selHover : {}), ...style }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ─── Asset Upload Button (supports drop from workspace) ─── */
function AssetUpload({ prdId, label, currentUrl, onUploaded, onClear }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file || !prdId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/prd/${prdId}/upload-asset`, { method: 'POST', body: fd });
      const json = await res.json();
      if (json.success) onUploaded(json.data.url);
    } finally { setUploading(false); if (inputRef.current) inputRef.current.value = ''; }
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDropHover(false);
    const wsUrl = e.dataTransfer.getData('text/workspace-image-url');
    if (wsUrl) { onUploaded(wsUrl); return; }
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const fakeEvt = { target: { files: [file] } };
      handleFile(fakeEvt);
    }
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setDropHover(true); }}
      onDragLeave={() => setDropHover(false)}
      onDrop={handleDrop}>
      {currentUrl ? (
        <>
          <img src={currentUrl} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 3, border: '1px solid #cbd5e1', verticalAlign: 'middle' }} />
          <button onClick={e => { e.stopPropagation(); onClear(); }}
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0 }} title="移除">×</button>
        </>
      ) : (
        <button onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
          style={{
            background: dropHover ? '#dbeafe' : '#f0f9ff',
            border: dropHover ? '2px solid #2563eb' : '1px dashed #93c5fd',
            borderRadius: 3, color: '#2563eb', cursor: 'pointer', fontSize: 10, padding: '1px 6px', whiteSpace: 'nowrap',
            transition: 'all .15s',
          }}
          disabled={uploading}>
          {uploading ? '...' : dropHover ? '放下' : label || '上传'}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </span>
  );
}

const IMG_SOURCES = ['AI 生成', '直接提供'];

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

/* ─── Template Thumbnail (renders elements on a mini canvas) ─── */
const THUMB_W = 230;
const THUMB_H = Math.round(THUMB_W * 1050 / 1624);

function TemplateThumb({ template, width, height }) {
  const canvasRef = useRef(null);
  const w = width || THUMB_W;
  const h = height || THUMB_H;
  const scale = w / 1624;

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, w, h);

    const els = template?.elements || [];
    for (const el of els) {
      const ex = el.x * scale, ey = el.y * scale, ew = el.w * scale, eh = el.h * scale;
      ctx.fillStyle = el.presetKey === 'bg_area' ? '#e2e8f0' : (el.color || '#94a3b8') + '40';
      ctx.strokeStyle = el.presetKey === 'bg_area' ? '#cbd5e1' : (el.color || '#94a3b8');
      ctx.lineWidth = 1;
      const r = typeof el.borderRadius === 'number' ? el.borderRadius * scale : (el.borderRadius?.tl || 0) * scale;
      ctx.beginPath();
      ctx.roundRect(ex, ey, ew, eh, r);
      ctx.fill();
      ctx.stroke();

      if (el.label && el.presetKey !== 'bg_area') {
        ctx.fillStyle = '#475569';
        ctx.font = `${Math.max(8, 10 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.label, ex + ew / 2, ey + eh / 2);
      }
    }

    if (template?.safeTop) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, template.safeTop * scale);
      ctx.lineTo(w, template.safeTop * scale);
      ctx.stroke();
      if (template.safeBottom) {
        ctx.beginPath();
        ctx.moveTo(0, template.safeBottom * scale);
        ctx.lineTo(w, template.safeBottom * scale);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }, [template, w, h, scale]);

  return <canvas ref={canvasRef} width={w} height={h} style={{ width: w, height: h, borderRadius: 4, border: '1px solid #e2e8f0' }} />;
}

/* ─── Template Picker Popup ─── */
function TemplatePicker({ questionType, templates, currentId, onSelect, onClose }) {
  const qt = TYPE_TO_QT[questionType] || 'choice';
  const filtered = templates.filter(t => (t.questionType || 'choice') === qt);

  return (
    <div onClick={e => e.stopPropagation()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 700, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', flex: 1 }}>
            选择模板 — {questionType}
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 12 }}>{filtered.length} 个可用模板</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>暂无 {questionType} 类型的模板</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200, 1fr))', gap: 14 }}>
            {/* 不关联选项 */}
            <div onClick={() => { onSelect(''); onClose(); }}
              style={{
                border: !currentId ? '2px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: 8, padding: 12, cursor: 'pointer', textAlign: 'center',
                background: !currentId ? '#eff6ff' : '#fff',
              }}>
              <div style={{ width: '100%', height: THUMB_H, background: '#f8fafc', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 28, border: '1px dashed #d1d5db', marginBottom: 8 }}>∅</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>不关联模板</div>
            </div>
            {filtered.map(t => (
              <div key={t.id} onClick={() => { onSelect(t.id); onClose(); }}
                style={{
                  border: currentId === t.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  borderRadius: 8, padding: 12, cursor: 'pointer',
                  background: currentId === t.id ? '#eff6ff' : '#fff',
                  transition: 'border-color .15s',
                }}>
                <TemplateThumb template={t} width={176} height={Math.round(176 * 1050 / 1624)} />
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>{t.name || t.id}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    {STEM_TYPE_LABELS[t.stemType] || t.stemType} / {OPT_STYLE_LABELS[t.optionStyle] || t.optionStyle}
                    {t.optionCount ? ` / ${t.optionCount}选项` : ''}
                  </div>
                  {t.status === 'completed' && <span style={{ fontSize: 9, background: '#dcfce7', color: '#16a34a', padding: '1px 6px', borderRadius: 3, marginTop: 3, display: 'inline-block' }}>已完成</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Auto-fill logic ─── */
function isIllustrationStyle(bgStyle) {
  return bgStyle && (bgStyle.includes('插画') || bgStyle.includes('2D') || bgStyle.includes('2d'));
}

function applyTemplateToQuestion(qq, tpl, bgStyle) {
  if (!tpl) { qq.templateId = ''; return; }
  qq.templateId = tpl.id;

  qq.stemImage = tpl.stemType === 'image' ? '有' : '无';

  const mediaMap = { imageText: '图片+文字', image: '图片' };
  const mediaType = mediaMap[tpl.optionStyle] || '文字';
  const optCount = tpl.optionCount || 3;
  const labels = 'ABCDEFGH';

  while (qq.options.length < optCount) {
    qq.options.push({ label: labels[qq.options.length] || 'X', text: '', mediaType, imageDesc: '' });
  }
  while (qq.options.length > optCount) qq.options.pop();
  qq.options.forEach(o => { o.mediaType = mediaType; });
}

/* ─── Inline-Editable Question Card ─── */
function PromptPreview({ prompt, onEdit, onClear, type, backgroundStyle, styleDescription, duration }) {
  const [showModal, setShowModal] = useState(false);
  const [enDraft, setEnDraft] = useState(prompt || '');
  const [zhDraft, setZhDraft] = useState('');
  const [translating, setTranslating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { setEnDraft(prompt || ''); }, [prompt]);
  useEffect(() => { if (!showModal) setZhDraft(''); }, [showModal]);

  async function translateToZh() {
    if (!enDraft || translating) return;
    setTranslating(true);
    try {
      const r = await fetch('/api/prd/translate-prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: enDraft, direction: 'en2zh' }),
      });
      const d = await r.json();
      if (d.success) setZhDraft(d.data.result);
    } catch (e) { console.error('翻译失败:', e); }
    setTranslating(false);
  }

  async function syncToEn() {
    if (!zhDraft || syncing) return;
    setSyncing(true);
    try {
      const r = await fetch('/api/prd/translate-prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: zhDraft, direction: 'zh2en', type, backgroundStyle, styleDescription, duration }),
      });
      const d = await r.json();
      if (d.success) setEnDraft(d.data.result);
    } catch (e) { console.error('同步失败:', e); }
    setSyncing(false);
  }

  if (!prompt) return null;

  const btnBase = { border: 'none', borderRadius: 5, padding: '6px 14px', fontSize: 12, cursor: 'pointer' };

  return (
    <>
      <span onClick={e => { e.stopPropagation(); setShowModal(true); }}
        style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0, cursor: 'pointer', border: '1px solid #fff', boxShadow: '0 0 0 1px #22c55e' }}
        title={'已有AI优化prompt，点击查看/编辑\n' + (prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt)} />
      {showModal && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 20, width: 760, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>AI 优化 Prompt</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>中文翻译</span>
                  <button onClick={translateToZh} disabled={!enDraft || translating}
                    style={{ ...btnBase, background: translating ? '#94a3b8' : '#f0fdf4', color: translating ? '#fff' : '#15803d', padding: '2px 10px', fontSize: 11, opacity: enDraft ? 1 : 0.4 }}>
                    {translating ? '翻译中...' : '翻译中文'}</button>
                </div>
                <textarea value={zhDraft} onChange={e => setZhDraft(e.target.value)} placeholder="点击上方[翻译中文]按钮，或直接编写中文描述..."
                  style={{ flex: 1, minHeight: 160, fontSize: 12, lineHeight: 1.6, border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, resize: 'none', fontFamily: 'inherit', color: '#334155', outline: 'none' }} />
                <button onClick={syncToEn} disabled={!zhDraft || syncing}
                  style={{ ...btnBase, background: syncing ? '#94a3b8' : '#059669', color: '#fff', alignSelf: 'flex-end', opacity: zhDraft ? 1 : 0.4 }}>
                  {syncing ? '同步中...' : '同步英文 →'}</button>
              </div>

              <div style={{ width: 1, background: '#e2e8f0', flexShrink: 0 }} />

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>英文 Prompt（用于生成）</span>
                <textarea value={enDraft} onChange={e => setEnDraft(e.target.value)}
                  style={{ flex: 1, minHeight: 160, fontSize: 12, lineHeight: 1.6, border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, resize: 'none', fontFamily: 'inherit', color: '#334155', outline: 'none' }} />
                <span style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right' }}>{enDraft.length} 字符</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => { onClear(); setShowModal(false); }}
                style={{ ...btnBase, background: '#fee2e2', color: '#dc2626' }}>清除优化</button>
              <span style={{ flex: 1 }} />
              <button onClick={() => setShowModal(false)}
                style={{ ...btnBase, background: '#f1f5f9', color: '#64748b' }}>取消</button>
              <button onClick={() => { onEdit(enDraft); setShowModal(false); }}
                style={{ ...btnBase, background: '#2563eb', color: '#fff' }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function QuestionCard({ q, ei, qi, templates, update, onRemove, onProduce, prdId, backgroundStyle, styleDescription }) {
  const opts = q.options || [];
  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [optimizing, setOptimizing] = useState({});

  function uq(fn) { update(p => { const qq = p.epics?.[ei]?.questions?.[qi]; if (qq) fn(qq); }); }

  async function optimizePrompt(type, key, currentDesc, duration) {
    if (!currentDesc || optimizing[key]) return;
    setOptimizing(prev => ({ ...prev, [key]: true }));
    try {
      const r = await fetch('/api/prd/optimize-prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: currentDesc, type, backgroundStyle, styleDescription, duration }),
      });
      const d = await r.json();
      if (d.success) {
        uq(qq => {
          if (type === 'animation' && qq.effects?.[key]) {
            qq.effects[key].optimizedPrompt = d.data.optimized;
          } else if (type === 'image') {
            if (key === 'stemImageDesc') qq.stemOptimizedPrompt = d.data.optimized;
            else {
              const idx = parseInt(key.replace('opt_', ''));
              if (qq.options[idx]) qq.options[idx].optimizedImagePrompt = d.data.optimized;
            }
          }
        });
      }
    } catch (err) { console.error('优化失败:', err); }
    setOptimizing(prev => ({ ...prev, [key]: false }));
  }

  const tpl = q.templateId ? templates.find(t => t.id === q.templateId) : null;

  function handleTemplateSelect(tplId) {
    update(p => {
      const qq = p.epics?.[ei]?.questions?.[qi];
      if (!qq) return;
      const selected = templates.find(t => t.id === tplId);
      applyTemplateToQuestion(qq, selected, p.backgroundStyle);
    });
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 5, border: '1px solid #d1d5db',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20, width: 860,
      color: '#1e293b', fontSize: 12, lineHeight: 1.7,
    }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #f1f5f9', gap: 12 }}>
        <span style={S.tag}>题号：</span>
        <InText value={q.id} onChange={v => uq(qq => { qq.id = v; })} style={{ width: 80, fontWeight: 600 }} />
        <span style={{ width: 1, height: 14, background: '#e2e8f0' }} />
        <span style={S.tag}>题型：</span>
        <InSelect value={q.type} options={QUESTION_TYPES} onChange={v => uq(qq => { qq.type = v; })} />
        <span style={{ width: 1, height: 14, background: '#e2e8f0' }} />
        <span style={S.tag}>答案：</span>
        <InText value={q.correctAnswer} onChange={v => uq(qq => { qq.correctAnswer = v; })} placeholder="如 A / A、B / B→A→C" style={{ width: 120 }} />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: '#b0b8c4', flexShrink: 0 }}>Epic:</span>
        <InText value={q.epicLabel || ''} onChange={v => uq(qq => { qq.epicLabel = v; })} placeholder="无" style={{ width: 80, fontSize: 11 }} />
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
          title="删除此题">×</button>
        {onProduce && <button className="produce-btn" onClick={e => { e.stopPropagation(); onProduce(); }}
          title={`生产 ${q.id}`}
          style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid rgba(37,99,235,0.35)', background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontSize: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, lineHeight: 1, marginLeft: 2 }}>▶</button>}
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', padding: '12px 16px', gap: 20 }}>
        {/* Left: Template preview + selector */}
        <div style={{ width: 250, flexShrink: 0 }}>
          {/* Preview area — click to open template picker */}
          <div onClick={e => { e.stopPropagation(); setPickerOpen(true); }}
            style={{ cursor: 'pointer', marginBottom: 8, position: 'relative' }}
            title="点击选择/更换模板">
            {tpl ? (
              <TemplateThumb template={tpl} />
            ) : (
              <div style={{
                width: THUMB_W, height: THUMB_H, border: '1px solid #e2e8f0', borderRadius: 6,
                background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 10,
              }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {opts.map((opt, i) => (
                    <div key={i} style={{
                      width: 50, height: 50, borderRadius: 8, border: '2px solid #86efac',
                      background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: '#15803d',
                    }}>{opt.label}</div>
                  ))}
                </div>
              </div>
            )}
            {/* Hover overlay */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 4, background: 'rgba(37,99,235,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity .15s',
            }} onMouseEnter={e => { e.currentTarget.style.opacity = 1; }} onMouseLeave={e => { e.currentTarget.style.opacity = 0; }}>
              <span style={{ background: '#2563eb', color: '#fff', padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                {tpl ? '更换模板' : '选择模板'}
              </span>
            </div>
          </div>
          {/* Template info */}
          {tpl && (
            <div style={{ fontSize: 10, color: '#64748b' }}>
              <div style={{ fontWeight: 600, color: '#334155', fontSize: 11, marginBottom: 2 }}>{tpl.name}</div>
              <div>{STEM_TYPE_LABELS[tpl.stemType] || tpl.stemType} / {OPT_STYLE_LABELS[tpl.optionStyle] || tpl.optionStyle} / {tpl.optionCount || '?'}选项</div>
              <a href={`/templates/${tpl.id}?from=/prd/${prdId}`} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ color: '#2563eb', display: 'inline-block', marginTop: 2, fontSize: 10 }}>
                编辑模板 →
              </a>
            </div>
          )}
          {!tpl && <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>点击上方预览选择模板</div>}
        </div>

        {/* Right: Text info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 6, display: 'flex', gap: 4 }}>
            <span style={S.tag}>题干：</span>
            <InText value={q.stem} onChange={v => uq(qq => { qq.stem = v; })} placeholder="点击输入题干内容..." multiline />
          </div>

          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ color: '#64748b', fontSize: 11, flexShrink: 0 }}>题干图：</span>
            <InSelect value={q.stemImage || '无'} options={STEM_MEDIA_TYPES} onChange={v => uq(qq => { qq.stemImage = v; })} style={{ fontSize: 11 }} />
            {q.stemImage && q.stemImage !== '无' && (
              <>
                <span style={{ color: '#94a3b8', fontSize: 11 }}>|</span>
                <InSelect value={q.stemSource === 'upload' ? '直接提供' : 'AI 生成'} options={IMG_SOURCES}
                  onChange={v => uq(qq => { qq.stemSource = v === '直接提供' ? 'upload' : 'ai'; })} style={{ fontSize: 10 }} />
                {q.stemSource === 'upload' ? (
                  <AssetUpload prdId={prdId} label="上传题干图" currentUrl={q.stemUploadUrl}
                    onUploaded={url => uq(qq => { qq.stemUploadUrl = url; })} onClear={() => uq(qq => { qq.stemUploadUrl = ''; })} />
                ) : (
                  <>
                    <InText value={q.stemImageDesc} onChange={v => uq(qq => { qq.stemImageDesc = v; })} placeholder="描述图片内容..." style={{ fontSize: 11, flex: 1, minWidth: 100 }} />
                    <button onClick={e => { e.stopPropagation(); optimizePrompt('image', 'stemImageDesc', q.stemImageDesc || q.stem); }}
                      disabled={!(q.stemImageDesc || q.stem) || optimizing['stemImageDesc']}
                      style={{ background: optimizing['stemImageDesc'] ? '#94a3b8' : '#8b5cf6', color: '#fff', border: 'none', borderRadius: 3, padding: '1px 6px', fontSize: 10, cursor: (q.stemImageDesc || q.stem) && !optimizing['stemImageDesc'] ? 'pointer' : 'default', flexShrink: 0, opacity: (q.stemImageDesc || q.stem) ? 1 : 0.4 }}
                      title="AI 优化图片描述">{optimizing['stemImageDesc'] ? '...' : 'AI优化'}</button>
                    <PromptPreview prompt={q.stemOptimizedPrompt} type="image" backgroundStyle={backgroundStyle} styleDescription={styleDescription}
                      onEdit={v => uq(qq => { qq.stemOptimizedPrompt = v; })}
                      onClear={() => uq(qq => { delete qq.stemOptimizedPrompt; })} />
                    <AssetUpload prdId={prdId} label="参考图" currentUrl={q.stemReferenceUrl}
                      onUploaded={url => uq(qq => { qq.stemReferenceUrl = url; })} onClear={() => uq(qq => { qq.stemReferenceUrl = ''; })} />
                  </>
                )}
              </>
            )}
          </div>

          <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#64748b', fontSize: 11 }}>选项类型：</span>
            <InSelect value={opts[0]?.mediaType || '文字'} options={MEDIA_TYPES}
              onChange={v => uq(qq => { qq.options.forEach(o => { o.mediaType = v; }); })} style={{ fontSize: 11 }} />
            <button onClick={e => {
              e.stopPropagation();
              const allLabels = 'ABCDEFGH';
              uq(qq => {
                const used = new Set(qq.options.map(o => o.label));
                const next = [...allLabels].find(l => !used.has(l)) || allLabels[qq.options.length] || 'X';
                const newOpt = { label: next, text: '', mediaType: qq.options[0]?.mediaType || '图片+文字', imageDesc: '' };
                const insertIdx = qq.options.findIndex(o => o.label > next);
                if (insertIdx === -1) qq.options.push(newOpt);
                else qq.options.splice(insertIdx, 0, newOpt);
              });
            }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 11, padding: '0 4px' }}>+选项</button>
          </div>
          {opts.map((opt, oi) => {
            const hasImg = opt.mediaType && !opt.mediaType.startsWith('文字');
            const isUpload = opt.source === 'upload';
            return (
              <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 10, marginBottom: 3, fontSize: 11, color: '#475569', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#15803d', width: 14, flexShrink: 0 }}>{opt.label}</span>
                <InText value={opt.text} onChange={v => uq(qq => { qq.options[oi].text = v; })} placeholder="选项文字" style={{ fontSize: 11, maxWidth: 110 }} />
                {hasImg && (
                  <>
                    <span style={{ color: '#94a3b8' }}>【</span>
                    <InSelect value={opt.mediaType} options={MEDIA_TYPES} onChange={v => uq(qq => { qq.options[oi].mediaType = v; })} style={{ fontSize: 10 }} />
                    <span style={{ color: '#94a3b8' }}>|</span>
                    <InSelect value={isUpload ? '直接提供' : 'AI 生成'} options={IMG_SOURCES}
                      onChange={v => uq(qq => { qq.options[oi].source = v === '直接提供' ? 'upload' : 'ai'; })} style={{ fontSize: 10 }} />
                    {isUpload ? (
                      <AssetUpload prdId={prdId} label="上传" currentUrl={opt.uploadUrl}
                        onUploaded={url => uq(qq => { qq.options[oi].uploadUrl = url; })} onClear={() => uq(qq => { qq.options[oi].uploadUrl = ''; })} />
                    ) : (
                      <>
                        <InText value={opt.imageDesc} onChange={v => uq(qq => { qq.options[oi].imageDesc = v; })} placeholder="图片描述" style={{ fontSize: 11, flex: 1, minWidth: 60 }} />
                        <button onClick={e => { e.stopPropagation(); optimizePrompt('image', `opt_${oi}`, opt.imageDesc || opt.text); }}
                          disabled={!(opt.imageDesc || opt.text) || optimizing[`opt_${oi}`]}
                          style={{ background: optimizing[`opt_${oi}`] ? '#94a3b8' : '#8b5cf6', color: '#fff', border: 'none', borderRadius: 3, padding: '1px 6px', fontSize: 10, cursor: (opt.imageDesc || opt.text) && !optimizing[`opt_${oi}`] ? 'pointer' : 'default', flexShrink: 0, opacity: (opt.imageDesc || opt.text) ? 1 : 0.4 }}
                          title="AI 优化图片描述">{optimizing[`opt_${oi}`] ? '...' : 'AI优化'}</button>
                        <PromptPreview prompt={opt.optimizedImagePrompt} type="image" backgroundStyle={backgroundStyle} styleDescription={styleDescription}
                          onEdit={v => uq(qq => { qq.options[oi].optimizedImagePrompt = v; })}
                          onClear={() => uq(qq => { delete qq.options[oi].optimizedImagePrompt; })} />
                        <AssetUpload prdId={prdId} label="参考" currentUrl={opt.referenceUrl}
                          onUploaded={url => uq(qq => { qq.options[oi].referenceUrl = url; })} onClear={() => uq(qq => { qq.options[oi].referenceUrl = ''; })} />
                      </>
                    )}
                    <span style={{ color: '#94a3b8' }}>】</span>
                  </>
                )}
                <button onClick={e => { e.stopPropagation(); uq(qq => { qq.options.splice(oi, 1); }); }}
                  style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 12, padding: 0, flexShrink: 0 }} title="删除选项">×</button>
              </div>
            );
          })}

          {(q.effects?.correct?.description || q.effects?.opening?.description) && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ ...S.tag, fontSize: 11 }}>动效：</span>
              <span style={{ color: '#475569', fontSize: 11 }}>{q.effects?.correct?.description || q.effects?.opening?.description}</span>
            </div>
          )}

          <div style={{ marginTop: 6 }}>
            <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
              style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 11, padding: 0 }}>
              {expanded ? '▾ 收起详细配置' : '▸ 展开动效 / 配音 / 解析'}
            </button>
          </div>

          {expanded && (
            <div style={{ marginTop: 8, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #f1f5f9' }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>动效需求</span>
                  {(() => {
                    const plays = q.effects?.plays ?? 0;
                    const mode = plays === 0 ? 'loop' : plays === 1 ? 'once' : 'n';
                    const btnStyle = (active) => ({ fontSize: 10, padding: '1px 6px', border: '1px solid', borderRadius: 3, cursor: 'pointer', borderColor: active ? '#6366f1' : '#cbd5e1', background: active ? '#6366f1' : '#fff', color: active ? '#fff' : '#64748b' });
                    return (<>
                      <button style={btnStyle(mode === 'once')} onClick={() => uq(qq => { if (!qq.effects) qq.effects = {}; qq.effects.plays = 1; })}>单次</button>
                      <button style={btnStyle(mode === 'n')} onClick={() => uq(qq => { if (!qq.effects) qq.effects = {}; qq.effects.plays = qq.effects.plays > 1 ? qq.effects.plays : 2; })}>N次</button>
                      {mode === 'n' && <input type="number" min="2" max="99" value={plays} onChange={e => uq(qq => { if (!qq.effects) qq.effects = {}; qq.effects.plays = Math.max(2, Math.min(99, Number(e.target.value) || 2)); })} style={{ width: 32, fontSize: 10, textAlign: 'center', border: '1px solid #c7d2fe', borderRadius: 3, padding: '1px 2px' }} />}
                      <button style={btnStyle(mode === 'loop')} onClick={() => uq(qq => { if (!qq.effects) qq.effects = {}; qq.effects.plays = 0; })}>循环</button>
                    </>);
                  })()}
                </div>
                {[['opening', '开场'], ['correct', '正确反馈'], ['wrong', '错误反馈']].map(([key, label]) => {
                  const eff = q.effects?.[key] || {};
                  return (
                    <div key={key} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, fontSize: 11, flexWrap: 'wrap' }}>
                      <span style={{ color: '#64748b', width: 56, flexShrink: 0 }}>{label}：</span>
                      <InSelect value={eff.target || '无'} options={EFFECT_TARGETS} onChange={v => uq(qq => { if (!qq.effects[key]) qq.effects[key] = {}; qq.effects[key].target = v === '无' ? '' : v; })} style={{ fontSize: 11 }} />
                      <InText value={eff.description} onChange={v => uq(qq => { if (!qq.effects[key]) qq.effects[key] = {}; qq.effects[key].description = v; })} placeholder="效果描述..." style={{ fontSize: 11, flex: 1, minWidth: 80 }} />
                      <button onClick={e => { e.stopPropagation(); optimizePrompt('animation', key, eff.description, eff.duration); }}
                        disabled={!eff.description || optimizing[key]}
                        style={{ background: optimizing[key] ? '#94a3b8' : '#8b5cf6', color: '#fff', border: 'none', borderRadius: 3, padding: '1px 6px', fontSize: 10, cursor: eff.description && !optimizing[key] ? 'pointer' : 'default', flexShrink: 0, opacity: eff.description ? 1 : 0.4 }}
                        title="AI 优化描述语，生成更适合视频引擎的 prompt">{optimizing[key] ? '优化中...' : 'AI优化'}</button>
                      <PromptPreview prompt={eff.optimizedPrompt} type="animation" backgroundStyle={backgroundStyle} styleDescription={styleDescription} duration={eff.duration}
                        onEdit={v => uq(qq => { if (qq.effects?.[key]) qq.effects[key].optimizedPrompt = v; })}
                        onClear={() => uq(qq => { if (qq.effects?.[key]) delete qq.effects[key].optimizedPrompt; })} />
                      <select value={eff.sourceImage || ''} onChange={e => uq(qq => { if (!qq.effects[key]) qq.effects[key] = {}; qq.effects[key].sourceImage = e.target.value; if (e.target.value) qq.effects[key].referenceUrl = ''; })}
                        style={{ fontSize: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, padding: '1px 2px', color: eff.sourceImage ? '#059669' : '#94a3b8', flexShrink: 0 }}
                        title="首帧来源：使用已生成的选项图/题干图作为动效首帧">
                        <option value="">首帧：无</option>
                        {opts.map((o, oi) => <option key={oi} value={`option_${o.label}`}>首帧：选项{o.label}图</option>)}
                        {q.stemImage && q.stemImage !== '无' && <option value="stem">首帧：题干图</option>}
                      </select>
                      {!eff.sourceImage && <AssetUpload prdId={prdId} label="参考帧" currentUrl={eff.referenceUrl}
                        onUploaded={url => uq(qq => { if (!qq.effects[key]) qq.effects[key] = {}; qq.effects[key].referenceUrl = url; })}
                        onClear={() => uq(qq => { if (qq.effects?.[key]) qq.effects[key].referenceUrl = ''; })} />}
                      <InText value={eff.duration || 4} onChange={v => uq(qq => { if (!qq.effects[key]) qq.effects[key] = {}; qq.effects[key].duration = Math.max(2, Math.min(10, Number(v) || 4)); })} style={{ fontSize: 11, width: 32, textAlign: 'center' }} />
                      <span style={{ color: '#94a3b8', fontSize: 11, flexShrink: 0 }}>秒</span>
                      <label style={{ fontSize: 10, color: eff.customApngUrl ? '#059669' : '#8b5cf6', cursor: 'pointer', flexShrink: 0, border: '1px solid', borderColor: eff.customApngUrl ? '#059669' : '#c4b5fd', borderRadius: 3, padding: '1px 5px', background: eff.customApngUrl ? 'rgba(5,150,105,0.08)' : 'rgba(139,92,246,0.08)' }}
                        title={eff.customApngUrl ? '已上传自定义动效，点击替换' : '上传视频自动转换为APNG动效'}>
                        {eff.customApngUrl ? '已上传' : '上传视频'}
                        <input type="file" accept=".mp4,.mov,.webm,.avi,video/*" hidden onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          e.target.value = '';
                          const animEl = tpl?.elements?.find(el => el.presetKey === 'animation_area');
                          const coverEl = tpl?.elements?.find(el => el.presetKey === 'anim_cover');
                          const as = tpl?.animationSettings || {};
                          const fd = new FormData();
                          fd.append('video', file);
                          fd.append('animKey', `${key}_custom`);
                          fd.append('width', animEl?.w || 360);
                          fd.append('height', animEl?.h || 360);
                          fd.append('borderRadius', animEl?.borderRadius?.tl ?? animEl?.borderRadius ?? 0);
                          fd.append('fps', as.fps || 10);
                          fd.append('maxColors', as.maxColors ?? 256);
                          fd.append('dither', as.dither || 'none');
                          fd.append('plays', q.effects?.plays ?? 0);
                          if (coverEl && animEl) {
                            const lp = Math.max(0, animEl.x - coverEl.x);
                            const rp = Math.max(0, (coverEl.x + coverEl.w) - (animEl.x + animEl.w));
                            if (lp > 0 || rp > 0) {
                              fd.append('paddingLeft', lp);
                              fd.append('paddingRight', rp);
                              fd.append('paddingTotal', lp + animEl.w + rp);
                            }
                          }
                          uq(qq => { if (!qq.effects[key]) qq.effects[key] = {}; qq.effects[key]._uploading = true; });
                          try {
                            const r = await fetch(`/api/prd/${prdId}/upload-anim`, { method: 'POST', body: fd });
                            const j = await r.json();
                            if (j.success) {
                              uq(qq => { if (!qq.effects[key]) qq.effects[key] = {}; qq.effects[key].customApngUrl = j.data.url; delete qq.effects[key]._uploading; });
                            } else {
                              alert('转换失败: ' + (j.error || ''));
                              uq(qq => { if (qq.effects?.[key]) delete qq.effects[key]._uploading; });
                            }
                          } catch (err) {
                            alert('上传失败: ' + err.message);
                            uq(qq => { if (qq.effects?.[key]) delete qq.effects[key]._uploading; });
                          }
                        }} />
                      </label>
                      {eff._uploading && <span style={{ fontSize: 10, color: '#8b5cf6' }}>转换中...</span>}
                      {eff.customApngUrl && <button onClick={() => uq(qq => { if (qq.effects?.[key]) { delete qq.effects[key].customApngUrl; } })}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0, flexShrink: 0 }}
                        title="清除自定义动效">×</button>}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 4, fontSize: 11, alignItems: 'flex-start' }}>
                  <span style={{ color: '#64748b', flexShrink: 0 }}>正确解析：</span>
                  <InText value={q.analysis} onChange={v => uq(qq => { qq.analysis = v; })} placeholder="回答正确后显示的解析" style={{ fontSize: 11, flex: 1 }} multiline />
                </div>
              </div>
              <div style={{ fontSize: 11 }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ color: '#64748b', flexShrink: 0 }}>考查点：</span>
                  <InText value={q.examPoint} onChange={v => uq(qq => { qq.examPoint = v; })} placeholder="考查点" style={{ fontSize: 11, flex: 1 }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer: 配音（自由添加） ── */}
      <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 16px', background: '#fafbfc' }}>
        {(q.voiceLines || []).map((line, li) => (
          <div key={li} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3, fontSize: 11 }}>
            <span style={{ ...S.tag, fontSize: 11, width: 44, flexShrink: 0 }}>配音{li + 1}：</span>
            <InText value={line} onChange={v => uq(qq => { if (!qq.voiceLines) qq.voiceLines = []; qq.voiceLines[li] = v; })}
              placeholder="填写或粘贴配音内容" style={{ fontSize: 11, flex: 1 }} />
            <button onClick={e => { e.stopPropagation(); uq(qq => { if (qq.voiceLines) qq.voiceLines.splice(li, 1); }); }}
              style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 12, padding: 0, flexShrink: 0 }} title="删除此条配音">×</button>
          </div>
        ))}
        {(!q.voiceLines || q.voiceLines.length === 0) && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>暂无配音，点击下方添加</div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={e => {
            e.stopPropagation();
            uq(qq => {
              const lines = (qq.options || []).filter(o => o.text?.trim()).map(o => o.text.trim());
              if (lines.length === 0) return;
              if (!qq.voiceLines) qq.voiceLines = [];
              qq.voiceLines.push(...lines);
            });
          }}
            style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: 11, padding: 0 }}
            title="将所有选项文本自动填充为配音">
            ⚡ 选项配音
          </button>
          <button onClick={e => { e.stopPropagation(); uq(qq => { if (!qq.voiceLines) qq.voiceLines = []; qq.voiceLines.push(''); }); }}
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 11, padding: 0 }}>
            + 添加配音
          </button>
        </div>
      </div>

      {/* Template Picker Modal */}
      {pickerOpen && (
        <TemplatePicker questionType={q.type} templates={templates} currentId={q.templateId}
          onSelect={handleTemplateSelect} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

/* ─── Main Editor ─── */
export default function PrdEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const canvasRef = useRef(null);

  const [prd, setPrd] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [themes, setThemes] = useState([]);
  const [trainedStyles, setTrainedStyles] = useState([]);
  const [expandedEpics, setExpandedEpics] = useState({});
  const [dragSource, setDragSource] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const autoSaveRef = useRef(null);
  const [wsVisible, setWsVisible] = useState(true);
  const [wsDetached, setWsDetached] = useState(false);
  const wsWindowRef = useRef(null);
  const [wsPanelWidth, setWsPanelWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('prd_ws_panel_width'));
    return saved && saved >= 280 && saved <= 800 ? saved : 420;
  });
  const [wsSplitDragging, setWsSplitDragging] = useState(false);

  const workspaceKey = prd?.productLine || prd?.id || 'default';

  useEffect(() => {
    if (!wsSplitDragging) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e) => {
      const newWidth = Math.max(280, Math.min(800, window.innerWidth - e.clientX));
      setWsPanelWidth(newWidth);
    };
    const onUp = () => {
      setWsSplitDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setWsPanelWidth(w => { localStorage.setItem('prd_ws_panel_width', String(w)); return w; });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [wsSplitDragging]);

  const handleDetachWorkspace = useCallback(() => {
    const w = window.open(
      `/workspace?key=${encodeURIComponent(workspaceKey)}`,
      'workspace_panel',
      'width=600,height=800,menubar=no,toolbar=no,location=no,status=no'
    );
    if (w) {
      wsWindowRef.current = w;
      setWsDetached(true);
      setWsVisible(false);
      const check = setInterval(() => {
        if (w.closed) { clearInterval(check); setWsDetached(false); setWsVisible(true); wsWindowRef.current = null; }
      }, 500);
    }
  }, [workspaceKey]);

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(d => { if (d.success) setTemplates(d.data); });
    fetch('/api/themes').then(r => r.json()).then(d => { if (d.success) setThemes(d.data); });
    fetch('/api/styles').then(r => r.json()).then(d => { if (d.success) setTrainedStyles(d.data); });
  }, []);

  useEffect(() => {
    if (isNew) {
      setPrd({ name: '', productLine: '', episode: '', theme: '', backgroundStyle: '自然纪录片实拍', styleDescription: '自然实拍风格，高清写实，柔和自然光影，真实环境场景，纪录片镜头感，景深虚化背景突出主体', voiceStyle: '儿童科普风格，语速适中，亲切活泼', ttsEngine: 'ttshub', ttsVoiceId: 'xiaoyuan', epics: [newEpic(0)], status: 'draft' });
      setExpandedEpics({ 0: true });
    } else {
      fetch(`/api/prd/${id}`).then(r => r.json()).then(d => {
        if (d.success) {
          const data = d.data;
          (data.epics || []).forEach(ep => { (ep.questions || []).forEach(qq => { if (!qq._key) qq._key = uid(); }); });
          if (!data.ttsEngine) data.ttsEngine = 'ttshub';
          if (!data.ttsVoiceId) data.ttsVoiceId = 'xiaoyuan';
          setPrd(data);
          const exp = {}; (data.epics || []).forEach((_, i) => { exp[i] = true; }); setExpandedEpics(exp);
        }
      });
    }
  }, [id, isNew]);

  const save = useCallback(async (data) => {
    if (!data) return;
    setSaving(true);
    try {
      const url = data.id ? `/api/prd/${data.id}` : '/api/prd';
      const method = data.id ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const json = await res.json();
      if (json.success) { setPrd(json.data); setDirty(false); if (!data.id) navigate(`/prd/${json.data.id}`, { replace: true }); }
    } finally { setSaving(false); }
  }, [navigate]);

  function update(fn) {
    setPrd(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      setDirty(true);
      clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(() => save(next), 2000);
      return next;
    });
  }

  function addEpic() { update(p => { p.epics.push(newEpic(p.epics.length)); }); setExpandedEpics(prev => ({ ...prev, [(prd?.epics?.length || 0)]: true })); }
  function removeEpic(idx) { if (!confirm('确定删除此集？')) return; update(p => { p.epics.splice(idx, 1); }); }
  function addQuestion(epicIdx) { update(p => { const qs = p.epics[epicIdx].questions; qs.push(newQuestion(epicIdx, qs.length)); }); }
  function removeQuestion(epicIdx, qIdx) { if (!confirm('确定删除此题？')) return; update(p => { p.epics[epicIdx].questions.splice(qIdx, 1); }); }

  function handleQuestionDrop(toEpic, toIdx) {
    if (!dragSource) return;
    const { ei: fromEpic, qi: fromIdx } = dragSource;
    if (fromEpic === toEpic && fromIdx === toIdx) { setDragSource(null); setDragTarget(null); return; }
    update(p => {
      const [moved] = p.epics[fromEpic].questions.splice(fromIdx, 1);
      const adjustedIdx = (fromEpic === toEpic && fromIdx < toIdx) ? toIdx - 1 : toIdx;
      p.epics[toEpic].questions.splice(adjustedIdx, 0, moved);
    });
    setDragSource(null);
    setDragTarget(null);
  }

  function handleEpicDrop(toEpic) {
    if (!dragSource) return;
    const { ei: fromEpic, qi: fromIdx } = dragSource;
    update(p => {
      const [moved] = p.epics[fromEpic].questions.splice(fromIdx, 1);
      p.epics[toEpic].questions.push(moved);
    });
    setExpandedEpics(prev => ({ ...prev, [toEpic]: true }));
    setDragSource(null);
    setDragTarget(null);
  }

  const [toast, setToast] = useState(null);
  function showToast(msg, type) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function produceQuestions(questionIds, label) {
    await save(prd);
    try {
      const prodRes = await fetch(`/api/prd/${prd.id}/produce`, { method: 'POST' });
      const prodJson = await prodRes.json();
      if (!prodJson.success) { showToast('生产数据准备失败: ' + (prodJson.error || ''), 'error'); return; }
      const result = prodJson.data;
      if (questionIds) {
        result.questions = result.questions.filter(q => questionIds.includes(q.id));
      }
      const prdName = [prd.theme, label].filter(Boolean).join(' · ') || prd.name || prd.id;
      const taskRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prdId: prd.id, prdName, analysisResult: result }),
      });
      const taskJson = await taskRes.json();
      if (taskJson.success) {
        if (!questionIds) {
          setPrd(prev => ({ ...prev, status: 'ready' }));
          await fetch(`/api/prd/${prd.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...prd, status: 'ready' }),
          });
        }
        showToast(`已提交「${label}」生产任务`, 'success');
      } else {
        showToast('任务提交失败: ' + (taskJson.error || ''), 'error');
      }
    } catch (err) {
      showToast('网络错误: ' + err.message, 'error');
    }
  }

  function handleProduce() {
    const fullLabel = [prd.episode ? `第${prd.episode}集` : '', prd.episodeTitle || '全部'].filter(Boolean).join(' ') || '全部';
    produceQuestions(null, fullLabel);
  }

  function scrollToCard(ei, qi) {
    const el = document.getElementById(`q-card-${ei}-${qi}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (!prd) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>加载中...</div>;

  const inp = 'glass-input';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--nav-height, 64px))', margin: '-29px -32px -28px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: '1px solid rgba(56,189,248,0.08)', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(12px)', flexShrink: 0, position: 'sticky', top: 0, zIndex: 100 }}>
        <button className="btn btn-glass btn-sm" onClick={() => navigate('/prd')}>← 返回</button>
        <div style={{ width: 1, height: 18, background: 'rgba(56,189,248,0.15)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>主题</span>
        <ResizableField id="prd_theme" width={140}>
          <select className={inp} style={{ width: '100%' }}
            value={prd.themeId || ''}
            onChange={e => {
              const tid = e.target.value;
              const th = themes.find(t => t.id === tid);
              update(p => { p.themeId = tid; p.theme = th ? th.name : ''; });
            }}>
            <option value="">未分组</option>
            {themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </ResizableField>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>集数</span>
        <ResizableField id="prd_ep" width={46}>
          <input className={inp} style={{ width: '100%' }} placeholder="#" value={prd.episode} onChange={e => update(p => { p.episode = e.target.value; })} />
        </ResizableField>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>集标题</span>
        <ResizableField id="prd_eptitle" width={130}>
          <input className={inp} style={{ width: '100%' }} placeholder="本集标题" value={prd.episodeTitle || ''} onChange={e => update(p => { p.episodeTitle = e.target.value; })} />
        </ResizableField>
        <ResizableField id="prd_pl" width={90}>
          <input className={inp} style={{ width: '100%' }} placeholder="产品线" value={prd.productLine} onChange={e => update(p => { p.productLine = e.target.value; })} />
        </ResizableField>
        <ResizableField id="prd_bg" width={180}>
          <select className={inp} style={{ width: '100%' }} value={prd.backgroundStyle}
            onChange={e => {
              const val = e.target.value;
              const presetDesc = getPresetDesc(val);
              const trained = trainedStyles.find(s => s.name === val);
              const desc = trained ? trained.description : presetDesc;
              update(p => { p.backgroundStyle = val; p.styleDescription = desc; });
            }}
            title={prd.styleDescription || prd.backgroundStyle}>
            {(() => {
              const allNames = new Set([...ALL_PRESET_STYLES.map(s => s.name), ...trainedStyles.map(s => s.name)]);
              if (prd.backgroundStyle && !allNames.has(prd.backgroundStyle)) {
                return <option value={prd.backgroundStyle}>{prd.backgroundStyle}</option>;
              }
              return null;
            })()}
            {trainedStyles.length > 0 && (
              <optgroup label="已训练风格">
                {trainedStyles.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </optgroup>
            )}
            {BG_STYLE_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.styles.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </optgroup>
            ))}
          </select>
        </ResizableField>
        <div style={{ width: 1, height: 18, background: 'rgba(56,189,248,0.15)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>配音引擎</span>
        <select className={inp} style={{ width: 80 }} value={prd.ttsEngine || 'ttshub'} onChange={e => {
          const eng = e.target.value;
          const firstVoice = TTS_ENGINES[eng]?.voices?.[0]?.id || '';
          update(p => { p.ttsEngine = eng; p.ttsVoiceId = firstVoice; });
        }}>
          {Object.entries(TTS_ENGINES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>音色</span>
        <select className={inp} style={{ width: 110 }} value={prd.ttsVoiceId || ''} onChange={e => update(p => { p.ttsVoiceId = e.target.value; })}>
          {(TTS_ENGINES[prd.ttsEngine || 'ttshub']?.voices || []).map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <div style={{ width: 1, height: 18, background: 'rgba(56,189,248,0.15)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>绘图引擎</span>
        <select className={inp} style={{ width: 80 }} value={prd.imageEngine || ''} onChange={e => update(p => { p.imageEngine = e.target.value; })}>
          <option value="">自动</option>
          <option value="doubao">豆包</option>
          <option value="gemini">Gemini</option>
          <option value="gpt">GPT</option>
        </select>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: dirty ? '#eab308' : 'var(--text-muted)' }}>{saving ? '保存中...' : dirty ? '未保存' : '已保存'}</span>
        <button className="btn btn-glass btn-sm" onClick={() => save(prd)} disabled={saving}>保存</button>
        <select className={inp} style={{ width: 80 }} value={prd.status} onChange={e => update(p => { p.status = e.target.value; })}>
          <option value="draft">编辑中</option>
          <option value="ready">待生产</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={handleProduce} disabled={!prd.id}>一键生产 →</button>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: toast.type === 'success' ? '#065f46' : '#7f1d1d',
          color: '#fff', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)', animation: 'fadeIn .2s',
          display: 'flex', alignItems: 'center', gap: 8, maxWidth: 500,
        }}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 220, borderRight: '1px solid rgba(56,189,248,0.08)', display: 'flex', flexDirection: 'column', background: 'rgba(15,23,42,0.3)', flexShrink: 0 }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(56,189,248,0.06)', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>大纲</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {prd.epics.map((epic, ei) => (
              <div key={epic.id || ei}>
                <div style={{
                    display: 'flex', alignItems: 'center', padding: '4px 8px', cursor: 'pointer', fontSize: 12, gap: 4, userSelect: 'none',
                    background: dragSource && dragTarget?.ei === ei && dragTarget?.qi === -1 ? 'rgba(37,99,235,0.1)' : 'transparent',
                  }}
                  onClick={() => setExpandedEpics(prev => ({ ...prev, [ei]: !prev[ei] }))}
                  onDragOver={e => { if (dragSource) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragTarget({ ei, qi: -1 }); } }}
                  onDragLeave={() => setDragTarget(null)}
                  onDrop={e => { e.preventDefault(); handleEpicDrop(ei); }}>
                  <span style={{ fontSize: 9, width: 10, textAlign: 'center', transition: 'transform .15s', transform: expandedEpics[ei] ? 'rotate(90deg)' : '' }}>▶</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{epic.title}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{epic.questions.length}</span>
                  <button className="produce-btn" onClick={e => { e.stopPropagation(); produceQuestions(epic.questions.map(q => q.id), epic.title); }}
                    title={`生产 ${epic.title}`}
                    style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontSize: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, lineHeight: 1 }}>▶</button>
                  <button onClick={e => { e.stopPropagation(); removeEpic(ei); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0 }}>×</button>
                </div>
                {expandedEpics[ei] && (
                  <div>
                    {epic.questions.map((qq, qi) => {
                      const prevLbl = qi > 0 ? (epic.questions[qi - 1].epicLabel || '') : '';
                      const curLbl = qq.epicLabel || '';
                      const divider = curLbl && curLbl !== prevLbl;
                      return (
                        <React.Fragment key={qq._key || qi}>
                          {divider && (
                            <div style={{ padding: '2px 8px 2px 16px', fontSize: 9, color: '#94a3b8', fontWeight: 600, opacity: 0.7 }}>
                              ─ {curLbl}
                            </div>
                          )}
                          <div
                            draggable
                            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragSource({ ei, qi }); e.currentTarget.style.opacity = '0.4'; }}
                            onDragEnd={e => { e.currentTarget.style.opacity = '1'; setDragSource(null); setDragTarget(null); }}
                            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragTarget({ ei, qi }); }}
                            onDragLeave={() => setDragTarget(null)}
                            onDrop={e => { e.preventDefault(); handleQuestionDrop(ei, qi); }}
                            onClick={() => scrollToCard(ei, qi)}
                            style={{
                              padding: '4px 8px 4px 22px', cursor: dragSource ? 'grabbing' : 'pointer', fontSize: 11,
                              display: 'flex', alignItems: 'center', gap: 4,
                              borderTop: dragTarget?.ei === ei && dragTarget?.qi === qi ? '2px solid #2563eb' : '2px solid transparent',
                            }}>
                            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 11, width: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{qq.id || `#${qi + 1}`}</span>
                            <span style={{ flex: 1, color: 'var(--text-secondary, #94a3b8)' }}>{qq.type}</span>
                            {qq.templateId && <span style={{ fontSize: 8, background: 'rgba(56,189,248,0.15)', color: 'var(--accent)', padding: '0 4px', borderRadius: 3 }}>T</span>}
                          </div>
                        </React.Fragment>
                      );
                    })}
                    <div style={{ padding: '3px 8px 3px 22px' }}>
                      <button onClick={() => addQuestion(ei)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 11 }}>+ 添加题目</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div style={{ padding: '6px 10px' }}>
              <button className="btn btn-glass btn-sm" style={{ width: '100%', fontSize: 11 }} onClick={addEpic}>+ 添加集</button>
            </div>
          </div>
        </div>

        <div ref={canvasRef} style={{
          flex: 1, overflowY: 'auto', overflowX: 'auto', background: '#e8ecf1',
          backgroundImage: 'radial-gradient(circle, #cbd5e1 0.8px, transparent 0.8px)', backgroundSize: '20px 20px',
          padding: '32px 40px',
        }}>
          {prd.epics.map((epic, ei) => (
            <div key={epic.id || ei} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingLeft: 2 }}>
                <input style={{ background: 'transparent', border: 'none', borderBottom: '1px dashed #94a3b8', fontSize: 15, fontWeight: 700, color: '#1e293b', outline: 'none', width: 260, padding: '2px 0' }}
                  value={epic.title} onChange={e => update(p => { p.epics[ei].title = e.target.value; })} />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{epic.questions.length} 道题</span>
              </div>
              {epic.questions.map((qq, qi) => {
                const prevLabel = qi > 0 ? (epic.questions[qi - 1].epicLabel || '') : '';
                const curLabel = qq.epicLabel || '';
                const showDivider = curLabel && curLabel !== prevLabel;
                return (
                  <div key={qq._key || qi}>
                    {showDivider && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 8px', padding: '0 4px' }}>
                        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap' }}>{curLabel}</span>
                        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                      </div>
                    )}
                    <div id={`q-card-${ei}-${qi}`}>
                      <QuestionCard q={qq} ei={ei} qi={qi} templates={templates} update={update} onRemove={() => removeQuestion(ei, qi)} onProduce={() => produceQuestions([qq.id], qq.id)} prdId={prd.id} backgroundStyle={prd.backgroundStyle} styleDescription={prd.styleDescription} />
                    </div>
                  </div>
                );
              })}
              <button onClick={() => addQuestion(ei)}
                style={{ background: '#fff', border: '1px dashed #94a3b8', borderRadius: 6, padding: '10px 24px', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>
                + 添加题目到 {epic.title}
              </button>
            </div>
          ))}
          <button onClick={addEpic}
            style={{ background: '#fff', border: '1px dashed #64748b', borderRadius: 6, padding: '12px 32px', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + 添加新集
        </button>
        </div>

        {/* Workspace Splitter + Panel */}
        {wsVisible && !wsDetached && (
          <>
            <div
              onMouseDown={e => { e.preventDefault(); setWsSplitDragging(true); }}
              style={{
                width: 6, flexShrink: 0, cursor: 'col-resize',
                background: wsSplitDragging ? '#2563eb' : '#e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: wsSplitDragging ? 'none' : 'background .15s',
                zIndex: 10,
              }}
              onMouseEnter={e => { if (!wsSplitDragging) e.currentTarget.style.background = '#94a3b8'; }}
              onMouseLeave={e => { if (!wsSplitDragging) e.currentTarget.style.background = '#e2e8f0'; }}
            >
              <div style={{ width: 2, height: 32, background: wsSplitDragging ? '#fff' : '#94a3b8', borderRadius: 1, transition: wsSplitDragging ? 'none' : 'background .15s' }} />
            </div>
            <div style={{ width: wsPanelWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <WorkspacePanel workspaceKey={workspaceKey} onDetach={handleDetachWorkspace} onClose={() => setWsVisible(false)} isDetached={false}
                onApplyStyle={(name, desc) => {
                  update(p => { p.backgroundStyle = name; p.styleDescription = desc || ''; });
                  fetch('/api/styles').then(r => r.json()).then(d => { if (d.success) setTrainedStyles(d.data); });
                }}
                onFillPrd={(epics, mode) => {
                  update(p => {
                    const normalized = epics.map((epic, ei) => {
                      const baseIdx = mode === 'append' ? p.epics.length + ei : ei;
                      return {
                        id: uid(),
                        title: epic.title || `E${baseIdx + 1}`,
                        questions: (epic.questions || []).map((q, qi) => ({
                          _key: uid(),
                          id: `E${baseIdx + 1}-${qi + 1}`,
                          type: q.type || '单选题',
                          stem: q.stem || '',
                          stemImage: q.stemImage || '无',
                          stemImageDesc: '',
                          correctAnswer: q.correctAnswer || '',
                          options: (q.options || []).map(o => ({
                            label: o.label || '',
                            text: o.text || '',
                            mediaType: q.mediaType || '图片+文字',
                            imageDesc: '',
                          })),
                          analysis: q.analysis || '',
                          examPoint: q.examPoint || '',
                          epicLabel: q.epicLabel || '',
                          templateId: '',
                          effects: { opening: { description: '', duration: 4, target: '' }, correct: { description: '', duration: 4, target: '' }, wrong: { description: '', duration: 4, target: '' } },
                          voiceLines: [],
                          artStyle: '实拍',
                        })),
                      };
                    });
                    if (mode === 'replace') {
                      p.epics = normalized;
                    } else {
                      p.epics.push(...normalized);
                    }
                  });
                }} />
            </div>
          </>
        )}
      </div>

      {/* Workspace toggle button */}
      {!wsVisible && !wsDetached && (
        <button onClick={() => setWsVisible(true)}
          style={{
            position: 'fixed', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px 0 0 6px',
            padding: '12px 6px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            writingMode: 'vertical-rl', letterSpacing: 2, zIndex: 50,
          }}>工作台</button>
      )}
      {wsDetached && (
        <button onClick={() => { if (wsWindowRef.current) wsWindowRef.current.focus(); }}
          style={{
            position: 'fixed', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px 0 0 6px',
            padding: '12px 6px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            writingMode: 'vertical-rl', letterSpacing: 2, zIndex: 50,
          }}>已弹出</button>
      )}
    </div>
  );
}
