import React from 'react';
import { useSearchParams } from 'react-router-dom';
import WorkspacePanel from './WorkspacePanel';

export default function WorkspacePage() {
  const [params] = useSearchParams();
  const key = params.get('key') || 'default';

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <WorkspacePanel workspaceKey={key} isDetached={true} />
    </div>
  );
}
