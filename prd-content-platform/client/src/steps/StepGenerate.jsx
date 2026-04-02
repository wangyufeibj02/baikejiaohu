import React, { useState } from 'react';

export default function StepGenerate({ analysisResult, onGenerated, onBack }) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ step: '', percent: 0 });
  const [error, setError] = useState('');

  async function runGenerate() {
    setGenerating(true);
    setError('');
    setProgress({ step: '提交生成任务...', percent: 5 });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisResult }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setProgress({ step: '完成', percent: 100 });
      onGenerated(json.data);
    } catch (err) {
      setError(err.message);
      setGenerating(false);
    }
  }

  return (
    <div className="card">
      <h2>Step 4 - 生成素材</h2>

      {!generating && (
        <>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            将为 {(analysisResult.questions || analysisResult.epics?.flatMap(e => e.questions) || []).length} 道题目
            生成图片、音频、动效和配置文件。动效视频生成可能需要较长时间。
          </p>
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-outline" onClick={onBack}>上一步</button>
            <button className="btn btn-primary" onClick={runGenerate}>
              开始生成
            </button>
          </div>
        </>
      )}

      {generating && (
        <>
          <div className="loading-text">
            <div className="spinner" />
            <span>{progress.step}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            AI 正在生成图片、配音、动效视频和配置文件，请耐心等待...
          </p>
        </>
      )}

      {error && (
        <>
          <p style={{ color: 'var(--danger)', fontSize: 14, marginTop: 12 }}>{error}</p>
          <div className="actions">
            <button className="btn btn-outline" onClick={onBack}>上一步</button>
            <button className="btn btn-primary" onClick={runGenerate}>重试</button>
          </div>
        </>
      )}
    </div>
  );
}
