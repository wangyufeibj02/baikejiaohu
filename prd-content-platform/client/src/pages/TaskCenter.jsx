import React, { useState, useEffect, useRef, useCallback } from 'react';

const STATUS_MAP = {
  queued:   { label: '排队中', color: '#94a3b8', bg: '#f1f5f9', icon: '🕐' },
  running:  { label: '生成中', color: '#2563eb', bg: '#eff6ff', icon: '⚙️' },
  done:     { label: '已完成', color: '#16a34a', bg: '#dcfce7', icon: '✅' },
  partial:  { label: '部分失败', color: '#ea580c', bg: '#fff7ed', icon: '⚠️' },
  failed:   { label: '失败', color: '#dc2626', bg: '#fef2f2', icon: '❌' },
  cancelled:{ label: '已取消', color: '#64748b', bg: '#f1f5f9', icon: '🚫' },
};

function fmtTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDuration(start, end) {
  if (!start) return '-';
  const ms = (end || Date.now()) - start;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function ProgressBar({ progress }) {
  if (!progress || !progress.total) return null;
  const pct = Math.min(100, Math.round(((progress.done + progress.failed) / progress.total) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, transition: 'width .3s',
          width: `${pct}%`,
          background: progress.failed > 0
            ? 'linear-gradient(90deg, #22c55e, #f97316)'
            : 'linear-gradient(90deg, #3b82f6, #22c55e)',
        }} />
      </div>
      <span style={{ fontSize: 10, color: '#64748b', flexShrink: 0 }}>{pct}%</span>
    </div>
  );
}

function FailureList({ failures }) {
  const [open, setOpen] = useState(false);
  if (!failures || failures.length === 0) return null;
  const icons = { '图片': '🖼️', '配音': '🎤', '动效': '🎬' };
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(!open)}
        style={{ background: 'none', border: 'none', color: '#ea580c', cursor: 'pointer', fontSize: 11, padding: 0 }}>
        {open ? '▾' : '▸'} {failures.length} 项失败
      </button>
      {open && (
        <div style={{ marginTop: 6, maxHeight: 200, overflowY: 'auto' }}>
          {failures.map((f, i) => (
            <div key={i} style={{ fontSize: 11, padding: '4px 8px', background: '#fef2f2', borderRadius: 4, marginBottom: 4, color: '#7f1d1d' }}>
              <span>{icons[f.type] || '❓'} [{f.type}] {f.name}</span>
              {f.questionId && <span style={{ color: '#94a3b8', marginLeft: 4 }}>({f.questionId})</span>}
              <div style={{ fontSize: 10, color: '#991b1b', marginTop: 2 }}>{f.error}</div>
              {f.suggestion && <div style={{ fontSize: 10, color: '#c2410c', marginTop: 1 }}>💡 {f.suggestion}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TaskCenter() {
  const [tasks, setTasks] = useState([]);
  const [queueLen, setQueueLen] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks');
      const json = await res.json();
      if (json.success) {
        setTasks(json.data.tasks);
        setQueueLen(json.data.queueLength);
        setIsRunning(json.data.running);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchTasks();
    timerRef.current = setInterval(fetchTasks, 3000);
    return () => clearInterval(timerRef.current);
  }, [fetchTasks]);

  async function handleDelete(id) {
    if (!confirm('确定删除该任务记录？')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
  }

  const hasActive = tasks.some(t => t.status === 'running' || t.status === 'queued');

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>加载中...</div>;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>任务中心</h2>
        {hasActive && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: '#2563eb', background: '#eff6ff',
            padding: '3px 10px', borderRadius: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', animation: 'pulse 1.5s infinite' }} />
            {isRunning ? '正在生成...' : ''} 队列 {queueLen}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          共 {tasks.length} 条记录 · 素材包保留 30 天
        </span>
      </div>

      {tasks.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)',
          background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14 }}>暂无任务记录</div>
          <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-muted)' }}>
            在 PRD 编辑器中点击「一键生产」提交生产任务
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tasks.map(task => {
          const st = STATUS_MAP[task.status] || STATUS_MAP.queued;
          const isActive = task.status === 'running' || task.status === 'queued';
          return (
            <div key={task.id} style={{
              background: 'var(--glass-bg)', borderRadius: 10, border: '1px solid var(--glass-border)',
              padding: '16px 20px', backdropFilter: 'blur(12px)',
              boxShadow: isActive ? '0 0 0 1px rgba(37,99,235,0.2), 0 4px 20px rgba(37,99,235,0.08)' : 'none',
              transition: 'box-shadow .2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{st.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {task.prdName || task.prdId || task.id}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '1px 8px', borderRadius: 10,
                      background: st.bg, color: st.color, fontWeight: 600,
                    }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>创建: {fmtTime(task.createdAt)}</span>
                    {task.startedAt && <span>开始: {fmtTime(task.startedAt)}</span>}
                    {task.finishedAt && <span>耗时: {fmtDuration(task.startedAt, task.finishedAt)}</span>}
                    {isActive && task.startedAt && <span>已运行: {fmtDuration(task.startedAt)}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {task.downloadUrl && (task.status === 'done' || task.status === 'partial') && (
                    <a href={task.downloadUrl} download
                      className="btn btn-primary btn-sm" style={{ fontSize: 11, textDecoration: 'none' }}>
                      下载素材包
                    </a>
                  )}
                  <button onClick={() => handleDelete(task.id)}
                    className="btn btn-glass btn-sm" style={{ fontSize: 11, color: '#ef4444' }}>
                    删除
                  </button>
                </div>
              </div>

              {isActive && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#2563eb', marginBottom: 4 }}>
                    {task.progress?.current || '处理中...'}
                  </div>
                  <ProgressBar progress={task.progress} />
                </div>
              )}

              {task.summary && (
                <div style={{
                  marginTop: 10, display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-secondary)',
                  padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6,
                }}>
                  <span>🖼️ 图片 {task.summary.imagesDone}/{task.summary.images}
                    {task.summary.imagesFailed > 0 && <span style={{ color: '#ef4444' }}> ({task.summary.imagesFailed}失败)</span>}
                  </span>
                  <span>🎤 配音 {task.summary.audiosDone}/{task.summary.audios}
                    {task.summary.audiosFailed > 0 && <span style={{ color: '#ef4444' }}> ({task.summary.audiosFailed}失败)</span>}
                  </span>
                  <span>🎬 动效 {task.summary.animationsDone}/{task.summary.animations}
                    {task.summary.animationsFailed > 0 && <span style={{ color: '#ef4444' }}> ({task.summary.animationsFailed}失败)</span>}
                  </span>
                  <span>📄 配置 {task.summary.configs}</span>
                </div>
              )}

              <FailureList failures={task.failures} />
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
