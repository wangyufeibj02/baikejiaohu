import React, { useRef, useState } from 'react';

export default function StepUpload({ onUploaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [error, setError] = useState('');

  function addFiles(fileList) {
    const newFiles = Array.from(fileList).filter(f =>
      f.type === 'application/pdf' ||
      f.type.startsWith('image/')
    );
    if (newFiles.length === 0) {
      setError('请上传 PDF 或图片文件（PNG/JPG/WEBP）');
      return;
    }
    setError('');
    setSelectedFiles(prev => [...prev, ...newFiles]);
  }

  function removeFile(index) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      setError('请至少上传一个文件');
      return;
    }

    setUploading(true);
    setError('');

    const form = new FormData();
    selectedFiles.forEach(f => form.append('files', f));

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onUploaded(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const pdfCount = selectedFiles.filter(f => f.type === 'application/pdf').length;
  const imgCount = selectedFiles.filter(f => f.type.startsWith('image/')).length;

  return (
    <div className="card">
      <h2>Step 1 - 上传 PRD 文档和配图</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
        支持 PDF 文档 + 图片文件（PNG/JPG/WEBP）。图片会被 AI 视觉模型分析。
      </p>

      <div
        className={`upload-zone${dragging ? ' dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <div className="icon">&#128196;</div>
        <p>点击或拖拽文件到此处（支持同时添加多个文件）</p>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          PDF (.pdf) &middot; 图片 (.png .jpg .webp)
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
        multiple
        hidden
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />

      {selectedFiles.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            已选择 {selectedFiles.length} 个文件（{pdfCount} PDF，{imgCount} 图片）
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selectedFiles.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 13,
              }}>
                <span>
                  <span className={`badge ${f.type === 'application/pdf' ? 'badge-info' : 'badge-warning'}`}>
                    {f.type === 'application/pdf' ? 'PDF' : 'IMG'}
                  </span>
                  {' '}{f.name}
                  <span style={{ color: '#94a3b8', marginLeft: 8 }}>
                    ({(f.size / 1024).toFixed(1)} KB)
                  </span>
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--danger)',
                    cursor: 'pointer', fontSize: 16, padding: '0 4px',
                  }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', marginTop: 12, fontSize: 14 }}>{error}</p>}

      {selectedFiles.length > 0 && (
        <div className="actions">
          <button
            className="btn btn-outline"
            onClick={() => setSelectedFiles([])}
          >
            清空
          </button>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? '上传中...' : '上传并开始'}
          </button>
        </div>
      )}
    </div>
  );
}
