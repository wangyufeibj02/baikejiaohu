import React from 'react';
import { useParams, Link } from 'react-router-dom';

export default function CanvasEditor() {
  const { id } = useParams();
  return (
    <div style={{ padding: 40 }}>
      <Link to="/canvas" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: 13 }}>← 返回画布管理</Link>
      <h2 style={{ marginTop: 16 }}>画布编辑器 {id === 'new' ? '(新建)' : `(${id})`}</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>画布编辑功能待恢复</p>
    </div>
  );
}
