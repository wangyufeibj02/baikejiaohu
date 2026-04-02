import React, { useEffect, useState } from 'react';

export default function StepExtract({ uploadData, onExtracted, onBack }) {
  const [text, setText] = useState('');
  const [pageImages, setPageImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasPdf = uploadData.pdfs && uploadData.pdfs.length > 0;
  const hasUserImages = uploadData.images && uploadData.images.length > 0;

  useEffect(() => {
    if (!hasPdf) {
      setText('[没有 PDF 文件，将仅依靠图片进行 AI 视觉分析]');
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/analyze/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfs: uploadData.pdfs }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setText(json.data.text);
        setPageImages(json.data.pageImages || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleNext() {
    const allImages = [...pageImages, ...(uploadData.images || [])];
    onExtracted(text, allImages);
  }

  return (
    <div className="card">
      <h2>Step 2 - 文本与图片提取结果</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>
        {hasPdf && `PDF: ${uploadData.pdfs.map(p => p.originalName).join(', ')}`}
        {hasPdf && hasUserImages && ' | '}
        {hasUserImages && `额外图片: ${uploadData.images.length} 张`}
      </p>

      {loading && (
        <div className="loading-text">
          <div className="spinner" />
          <span>正在提取 PDF 文本并渲染页面图片...</span>
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}

      {!loading && text && (
        <>
          <details open={pageImages.length === 0}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              提取的文本内容
            </summary>
            <div className="pre-block">{text}</div>
          </details>

          {pageImages.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                PDF 页面渲染图片（{pageImages.length} 页，将用于 AI 视觉分析）
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {pageImages.map((img, i) => (
                  <div key={`page-${i}`} style={{
                    borderRadius: 8, border: '1px solid var(--border)',
                    overflow: 'hidden', background: '#f8fafc',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}>
                    <img
                      src={`/uploads/${img.savedName}`}
                      alt={img.originalName}
                      style={{ width: 160, height: 200, objectFit: 'contain', background: '#fff' }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px 6px' }}>
                      第 {i + 1} 页
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasUserImages && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                用户上传的额外图片（{uploadData.images.length} 张）
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {uploadData.images.map((img, i) => (
                  <div key={`user-${i}`} style={{
                    borderRadius: 8, border: '1px solid var(--border)',
                    overflow: 'hidden', background: '#f8fafc',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}>
                    <img
                      src={`/uploads/${img.savedName}`}
                      alt={img.originalName}
                      style={{ width: 120, height: 120, objectFit: 'cover' }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px 6px', textAlign: 'center', wordBreak: 'break-all', maxWidth: 120 }}>
                      {img.originalName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="actions">
            <button className="btn btn-outline" onClick={onBack}>上一步</button>
            <button className="btn btn-primary" onClick={handleNext}>
              确认，进入 AI 解析（共 {pageImages.length + (uploadData.images || []).length} 张图片）
            </button>
          </div>
        </>
      )}
    </div>
  );
}
