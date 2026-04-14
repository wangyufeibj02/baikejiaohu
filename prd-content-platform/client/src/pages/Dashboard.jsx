import React from 'react';
import { Link } from 'react-router-dom';

const CARDS = [
  {
    title: '题型模板',
    desc: '可视化设计题板布局，定义选项尺寸、文字规范、配音位置',
    icon: '\u{1F3A8}',
    link: '/templates',
    color: 'var(--primary)',
  },
  {
    title: '生产任务',
    desc: '上传 PRD 文档，AI 自动解析并生成图片、配音、动效、配置',
    icon: '\u{1F680}',
    link: '/production',
    color: 'var(--success)',
  },
];

export default function Dashboard() {
  return (
    <div>
      <h1 className="page-title">工作台</h1>
      <p className="page-subtitle">AI 交互题自动生产平台 — 从模板设计到素材生成</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
        {CARDS.map(c => (
          <Link to={c.link} key={c.title} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="glass-card" style={{ cursor: 'pointer', transition: 'all 0.25s' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{c.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{c.title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.desc}</div>
              <div style={{ marginTop: 16 }}>
                <span className="btn btn-glass btn-sm">进入 &rarr;</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
