import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const handleStyle = { width: 8, height: 8 };

function CustomNode({ data }) {
  const importance = data.importance || 0;
  return (
    <div className="custom-node">
      <Handle type="source" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Left} style={handleStyle} />
      
      <div className="custom-node-content">
        <div>{data.label}</div>
        {importance > 0 && (
          <div className="importance-badge" style={{ fontSize: '0.8em', color: '#666' }}>
            Importance: {importance}/10
          </div>
        )}
        {data.notes && (
          <div className="notes" style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
            Notes: {data.notes}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="target" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Bottom} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
    </div>
  );
}

export default memo(CustomNode);
