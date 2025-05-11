import React from 'react';
import './WorkspaceLayout.css';

const WorkspaceLayout = ({ leftWorkspace, rightWorkspace }) => {
  return (
    <div className="workspace-layout">
      <div className="workspace-pane left-pane">
        {leftWorkspace}
      </div>
      <div className="workspace-pane right-pane">
        {rightWorkspace}
      </div>
    </div>
  );
};

export default WorkspaceLayout;