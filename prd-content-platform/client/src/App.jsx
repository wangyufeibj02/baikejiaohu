import React from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import TemplateList from './pages/TemplateList.jsx';
import TemplateEditor from './pages/TemplateEditor.jsx';
import CanvasPresets from './pages/CanvasPresets.jsx';
import CanvasEditor from './pages/CanvasEditor.jsx';
import PrdEditor from './pages/PrdEditor.jsx';
import TaskCenter from './pages/TaskCenter.jsx';
import Production from './pages/Production.jsx';

function NavBar() {
  return (
    <nav className="top-nav">
      <NavLink to="/" end>工作台</NavLink>
      <NavLink to="/templates">题型模板</NavLink>
      <NavLink to="/canvas">画布管理</NavLink>
      <NavLink to="/tasks">任务中心</NavLink>
      <NavLink to="/production">生产流程</NavLink>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI 交互题生产平台</span>
    </nav>
  );
}

export default function App() {
  const loc = useLocation();
  const hideNav = loc.pathname.startsWith('/templates/') || loc.pathname.startsWith('/canvas/') || loc.pathname.startsWith('/prd/');

  return (
    <>
      {!hideNav && <NavBar />}
      <div className={hideNav ? '' : 'app-shell'}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/templates" element={<TemplateList />} />
          <Route path="/templates/:id" element={<TemplateEditor />} />
          <Route path="/canvas" element={<CanvasPresets />} />
          <Route path="/canvas/new" element={<CanvasEditor />} />
          <Route path="/canvas/:id" element={<CanvasEditor />} />
          <Route path="/prd/:id" element={<PrdEditor />} />
          <Route path="/tasks" element={<TaskCenter />} />
          <Route path="/production" element={<Production />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  );
}
