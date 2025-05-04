// Returns the position (top,right,bottom or left) passed node port should be rendered
export const getHandlePosition = (node, handle) => {
  const nodeWidth = node.width ?? 0;
  const nodeHeight = node.height ?? 0;
  const handlePositions = {
    top: { x: nodeWidth / 2, y: 0 },
    right: { x: nodeWidth, y: nodeHeight / 2 },
    bottom: { x: nodeWidth / 2, y: nodeHeight },
    left: { x: 0, y: nodeHeight / 2 },
  };

  return handlePositions[handle];
};

// Returns the parameters (sx,sy,tx,ty,sourcePos,targetPos) needed for creating the edge path
export const getEdgeParams = (source, target) => {
  const sourceWidth = source.width ?? 0;
  const sourceHeight = source.height ?? 0;
  const targetWidth = target.width ?? 0;
  const targetHeight = target.height ?? 0;

  const sourceCenter = {
    x: source.x + sourceWidth / 2,
    y: source.y + sourceHeight / 2,
  };

  const targetCenter = {
    x: target.x + targetWidth / 2,
    y: target.y + targetHeight / 2,
  };

  const dx = Math.abs(targetCenter.x - sourceCenter.x);
  const dy = Math.abs(targetCenter.y - sourceCenter.y);

  let sourcePos;
  let targetPos;

  if (dx > dy) {
    // horizontal connection
    if (sourceCenter.x < targetCenter.x) {
      sourcePos = 'right';
      targetPos = 'left';
    } else {
      sourcePos = 'left';
      targetPos = 'right';
    }
  } else {
    // vertical connection
    if (sourceCenter.y < targetCenter.y) {
      sourcePos = 'bottom';
      targetPos = 'top';
    } else {
      sourcePos = 'top';
      targetPos = 'bottom';
    }
  }

  const sourceHandle = getHandlePosition(source, sourcePos);
  const targetHandle = getHandlePosition(target, targetPos);

  return {
    sx: source.x + sourceHandle.x,
    sy: source.y + sourceHandle.y,
    tx: target.x + targetHandle.x,
    ty: target.y + targetHandle.y,
    sourcePos,
    targetPos,
  };
};