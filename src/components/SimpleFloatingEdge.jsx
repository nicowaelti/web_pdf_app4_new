import React, { memo } from 'react';
import { getStraightPath } from 'reactflow';
import { getEdgeParams } from '../utils/FloatingEdgeUtils';

function SimpleFloatingEdge({ id, style, markerEnd, sourceX, sourceY, targetX, targetY }) {
  const params = getEdgeParams(
    { x: sourceX, y: sourceY, width: 0, height: 0 },
    { x: targetX, y: targetY, width: 0, height: 0 }
  );

  const [edgePath] = getStraightPath({
    sourceX: params.sx,
    sourceY: params.sy,
    targetX: params.tx,
    targetY: params.ty,
  });

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      style={style}
      markerEnd={markerEnd}
    />
  );
}

export default memo(SimpleFloatingEdge);
