import React from 'react';

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

export default function StepDone({ result, onReset }) {
  const s = result?.summary || {};

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>&#9989;</div>
      <h2>生成完成</h2>
      <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px', fontSize: 14 }}>
        所有素材已生成并打包
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 32, flexWrap: 'wrap' }}>
        <Stat label="图片" total={s.images || 0} done={s.imagesDone} failed={s.imagesFailed} />
        <Stat label="配音" total={s.audios || 0} done={s.audiosDone} failed={s.audiosFailed} />
        <Stat label="动效" total={s.animations || 0} done={s.animationsDone} failed={s.animationsFailed} />
        <Stat label="配置" total={s.configs || 0} />
      </div>

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
