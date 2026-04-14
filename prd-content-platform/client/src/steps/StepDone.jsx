import React, { useState } from 'react';

const TYPE_ICON = { '图片': '\uD83D\uDDBC\uFE0F', '配音': '\uD83C\uDF99\uFE0F', '动效': '\uD83C\uDFAC' };

function Stat({ label, total, done, failed }) {
  const color = failed > 0 ? 'var(--danger)' : 'var(--primary)';
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>
        {done !== undefined ? `${done}/${total}` : total}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</div>
      {failed > 0 && (
        <div style={{ fontSize: 12, color: 'var(--danger)' }}>{failed} 失败</div>
      )}
    </div>
  );
}

function FailurePanel({ failures }) {
  const [expanded, setExpanded] = useState(true);
  if (!failures || failures.length === 0) return null;

  return (
    <div style={{
      margin: '0 auto 28px', maxWidth: 640, textAlign: 'left',
      border: '1px solid #fecaca', borderRadius: 12,
      background: '#fef2f2', overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', cursor: 'pointer', userSelect: 'none',
          background: '#fee2e2', fontWeight: 700, fontSize: 14, color: '#991b1b',
        }}
      >
        <span>{failures.length} 项生成失败 — 点击{expanded ? '收起' : '展开'}查看详情</span>
        <span style={{ fontSize: 12, transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}>&#9660;</span>
      </div>

      {expanded && (
        <div style={{ padding: '4px 0' }}>
          {failures.map((f, i) => (
            <div key={i} style={{
              padding: '12px 16px',
              borderBottom: i < failures.length - 1 ? '1px solid #fecaca' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{TYPE_ICON[f.type] || '\u26A0\uFE0F'}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                  {f.type} · {f.name}
                </span>
                {f.questionId && (
                  <span style={{
                    fontSize: 11, padding: '1px 6px', borderRadius: 4,
                    background: '#e2e8f0', color: '#475569',
                  }}>
                    {f.questionId}
                  </span>
                )}
              </div>

              <div style={{
                fontSize: 12, color: '#dc2626', marginBottom: 6,
                padding: '6px 10px', background: '#fff5f5', borderRadius: 6,
                border: '1px solid #fecaca', wordBreak: 'break-all',
              }}>
                <strong>原因：</strong>{f.error}
              </div>

              <div style={{
                fontSize: 12, color: '#15803d',
                padding: '6px 10px', background: '#f0fdf4', borderRadius: 6,
                border: '1px solid #bbf7d0',
              }}>
                <strong>建议：</strong>{f.suggestion}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StepDone({ result, onReset }) {
  const s = result?.summary || {};
  const failures = result?.failures || [];
  const allSuccess = failures.length === 0;

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>
        {allSuccess ? '\u2705' : '\u26A0\uFE0F'}
      </div>
      <h2>{allSuccess ? '生成完成' : '生成完成（部分失败）'}</h2>
      <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px', fontSize: 14 }}>
        {allSuccess
          ? '所有素材已生成并打包'
          : `${failures.length} 项素材生成失败，其余已打包完成`}
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 28, flexWrap: 'wrap' }}>
        <Stat label="图片" total={s.images || 0} done={s.imagesDone} failed={s.imagesFailed} />
        <Stat label="配音" total={s.audios || 0} done={s.audiosDone} failed={s.audiosFailed} />
        <Stat label="动效" total={s.animations || 0} done={s.animationsDone} failed={s.animationsFailed} />
        <Stat label="配置" total={s.configs || 0} />
      </div>

      <FailurePanel failures={failures} />

      <div className="actions" style={{ justifyContent: 'center' }}>
        <a
          href={result?.downloadUrl}
          className="btn btn-success"
          download
        >
          &#128229; 下载素材包
        </a>
        <button className="btn btn-outline" onClick={onReset}>
          处理新文档
        </button>
      </div>
    </div>
  );
}
