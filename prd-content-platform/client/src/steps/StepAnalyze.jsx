import React, { useState } from 'react';

export default function StepAnalyze({ text, images, preloaded, onAnalyzed, onBack }) {
  const [result, setResult] = useState(preloaded || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function runAnalysis() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/analyze/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, images }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setResult(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const questions = result?.questions || result?.epics?.flatMap(e => e.questions) || [];

  function countAssets(q, type) {
    return q.assets?.[type]?.length || 0;
  }

  return (
    <div className="card">
      <h2>{preloaded ? 'PRD 素材汇总' : 'Step 3 - AI 解析结果'}</h2>

      {!result && !loading && (
        <>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            AI 将分析 PRD 内容{images.length > 0 ? `（含 ${images.length} 张图片）` : ''}，
            提取所有需要生产的素材需求。
          </p>
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-outline" onClick={onBack}>上一步</button>
            <button className="btn btn-primary" onClick={runAnalysis}>开始 AI 解析</button>
          </div>
        </>
      )}

      {loading && (
        <div className="loading-text">
          <div className="spinner" />
          <span>AI 正在分析 PRD 内容，可能需要 10-30 秒...</span>
        </div>
      )}

      {error && (
        <>
          <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 8 }}>解析失败：{error}</p>
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-outline" onClick={onBack}>上一步</button>
            <button className="btn btn-primary" onClick={runAnalysis}>重试</button>
          </div>
        </>
      )}

      {result && (
        <>
          <p style={{ marginBottom: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
            产品线：<strong>{result.productLine}</strong>
            {result.episode && <> | 集数：<strong>{result.episode}</strong></>}
            {result.backgroundStyle && <> | 美术风格：<strong>{result.backgroundStyle}</strong></>}
          </p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>题号</th>
                  <th>题型</th>
                  <th>题干/配音</th>
                  <th>图片</th>
                  <th>配音</th>
                  <th>动效</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td>{q.id}</td>
                    <td><span className="badge badge-info">{q.type}</span></td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {q.stem || q.assets?.audios?.find(a => a.name === 'stem_audio')?.text || '-'}
                    </td>
                    <td>
                      <span className="badge badge-success">{countAssets(q, 'images')}</span>
                    </td>
                    <td>
                      <span className={`badge ${countAssets(q, 'audios') > 0 ? 'badge-success' : 'badge-warning'}`}>
                        {countAssets(q, 'audios')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${countAssets(q, 'animations') > 0 ? 'badge-success' : 'badge-warning'}`}>
                        {countAssets(q, 'animations')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {questions.map((q) => (
            <details key={q.id} style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                {q.id} 产出清单
              </summary>
              <div style={{ padding: '8px 0', fontSize: 13 }}>
                {q.assets?.images?.map((img, i) => (
                  <div key={i} style={{ padding: '2px 0', color: 'var(--text-secondary)' }}>
                    &#128444; <strong>{img.name}.png</strong> — {img.description || img.prompt?.substring(0, 60)}
                  </div>
                ))}
                {q.assets?.audios?.map((a, i) => (
                  <div key={i} style={{ padding: '2px 0', color: 'var(--text-secondary)' }}>
                    &#127908; <strong>{a.name}.mp3</strong> — "{a.text}"
                  </div>
                ))}
                {q.assets?.animations?.map((v, i) => (
                  <div key={i} style={{ padding: '2px 0', color: 'var(--text-secondary)' }}>
                    &#127916; <strong>{v.name}.apng</strong> — {v.description} ({v.duration}秒)
                  </div>
                ))}
              </div>
            </details>
          ))}

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}>
              查看完整 JSON
            </summary>
            <div className="pre-block" style={{ marginTop: 8 }}>
              {JSON.stringify(result, null, 2)}
            </div>
          </details>

          <div className="actions">
            {!preloaded && <button className="btn btn-outline" onClick={onBack}>上一步</button>}
            <button className="btn btn-primary" onClick={() => onAnalyzed(result)}>
              确认，开始生成素材
            </button>
          </div>
        </>
      )}
    </div>
  );
}
