import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import TemplateList from './pages/TemplateList.jsx';
import TemplateEditor from './pages/TemplateEditor.jsx';
import Production from './pages/Production.jsx';
import CanvasPresets from './pages/CanvasPresets.jsx';
import CanvasEditor from './pages/CanvasEditor.jsx';
import PrdList from './pages/PrdList.jsx';
import PrdEditor from './pages/PrdEditor.jsx';
import TaskCenter from './pages/TaskCenter.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';
import Toolbox from './pages/Toolbox.jsx';

function TaskBadge() {
  const [count, setCount] = useState(0);
  const timer = useRef(null);
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/tasks');
        const json = await res.json();
        if (json.success) {
          setCount(json.data.tasks.filter(t => t.status === 'running' || t.status === 'queued').length);
        }
      } catch {}
    };
    poll();
    timer.current = setInterval(poll, 5000);
    return () => clearInterval(timer.current);
  }, []);
  if (count === 0) return null;
  return (
    <span style={{
      position: 'absolute', top: -4, right: -8,
      background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700,
      minWidth: 16, height: 16, borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 4px', lineHeight: 1, boxShadow: '0 1px 4px rgba(239,68,68,0.5)',
      animation: 'pulse 1.5s infinite',
    }}>{count}</span>
  );
}

export default function App() {
  const isWorkspaceWindow = window.location.pathname === '/workspace';

  return (
    <>
      {!isWorkspaceWindow && (
        <>
          <nav className="nav">
            <div className="nav-brand">AI 交互题平台</div>
            <div className="nav-links">
              <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                首页
              </NavLink>
              <NavLink to="/templates" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                题型模板
              </NavLink>
              <NavLink to="/prd" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                PRD 工作台
              </NavLink>
              <NavLink to="/tasks" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} style={{ position: 'relative' }}>
                任务中心
                <TaskBadge />
              </NavLink>
              <NavLink to="/tools" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                工具箱
              </NavLink>
              <NavLink to="/production" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                手动生产
              </NavLink>
            </div>
            <div className="nav-right">
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>v2.1</span>
            </div>
          </nav>
        </>
      )}

      <div className={isWorkspaceWindow ? '' : 'page-container'}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/templates" element={<TemplateList />} />
          <Route path="/templates/new" element={<TemplateEditor />} />
          <Route path="/templates/:id" element={<TemplateEditor />} />
          <Route path="/canvas" element={<CanvasPresets />} />
          <Route path="/canvas/new" element={<CanvasEditor />} />
          <Route path="/canvas/:id" element={<CanvasEditor />} />
          <Route path="/prd" element={<PrdList />} />
          <Route path="/prd/new" element={<PrdEditor />} />
          <Route path="/prd/:id" element={<PrdEditor />} />
          <Route path="/tasks" element={<TaskCenter />} />
          <Route path="/tools" element={<Toolbox />} />
          <Route path="/production" element={<Production />} />
          <Route path="/workspace" element={<WorkspacePage />} />
        </Routes>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
