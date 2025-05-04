import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const handleStyle = { width: 8, height: 8 };

function CustomNode({ data }) {
  return (
    <div className="custom-node">
      <Handle type="source" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Left} style={handleStyle} />
      
      <div className="custom-node-content">
        {data.label}
      </div>

      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="target" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
    </div>
  );
}

export default memo(CustomNode);
