import React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import EditNodeModal from './components/EditNodeModal';
import { initializeDriver, executeQuery, closeDriver } from './utils/neo4jConnection';
import { exportGraphToRtf } from './features/rtfExport/rtfExporter.js';

// Utility function to clamp a number between min and max values
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
import Header from './components/Header';
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Handle,
  Position,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode from './components/CustomNode';
import SimpleFloatingEdge from './components/SimpleFloatingEdge';

import './App.css';

// Add styles for custom node
const styles = `
.custom-node {
  padding: 6px;
  border-radius: 5px;
  background: white;
  border: 1px solid #1a192b;
  min-width: 150px;
}

.custom-node-content {
  padding: 4px;
  text-align: center;
}

.react-flow__handle {
  background: #1a192b;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import 'reactflow/dist/style.css';
import './index.css';

// Initialize PDF.js worker
try {
  console.log('Initializing PDF.js worker...');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  }
  console.log('PDF.js worker initialized successfully');
} catch (error) {
  console.error('Error initializing PDF.js worker:', error);
}

// Helper functions for positioning and value conversion
const getRandomPosition = () => ({
  x: Math.random() * 400 + 100,
  y: Math.random() * 400 + 100
});

const safeGetPosition = (node, defaultPosition) => {
  try {
    const x = node.get('positionX');
    const y = node.get('positionY');
    return {
      x: typeof x === 'number' ? x : defaultPosition.x,
      y: typeof y === 'number' ? y : defaultPosition.y
    };
  } catch (error) {
    console.warn('Error getting position:', error);
    return defaultPosition;
  }
};

const safeConvertNeoInt = (value, defaultValue = 0) => {
  try {
    return typeof value?.toNumber === 'function' ? value.toNumber() : Number(value) || defaultValue;
  } catch (error) {
    console.warn('Error converting Neo4j integer:', error);
    return defaultValue;
  }
};

// Define constant styles and node types outside of component
// Node styling constants
const commonNodeStyle = {
  borderRadius: '3px',
  padding: '6px 8px',
  fontSize: '12px',
  minWidth: '120px',
  maxWidth: '200px',
  backgroundColor: '#fff',
  border: '1px solid #ddd',
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
};

const selectedNodeStyle = {
  ...commonNodeStyle,
  border: '2px solid #ff0072',
  boxShadow: '0 2px 4px rgba(255,0,114,0.2)'
};

// Node-specific styles
const paperNodeStyle = {
  ...commonNodeStyle,
  backgroundColor: '#e3f2fd',
  border: '1px solid #90caf9'
};

const topicNodeStyle = {
  ...commonNodeStyle,
  backgroundColor: '#f0fdf4',
  border: '1px solid #86efac'
};

const referenceNodeStyle = {
  ...commonNodeStyle,
  backgroundColor: '#f8f9fa',
  border: '1px solid #dee2e6'
};

const centralTopicNodeStyle = {
  ...commonNodeStyle,
  backgroundColor: '#fff3e0',
  border: '1px solid #ffb74d',
  minWidth: '150px'
};

const paragraphNodeStyle = {
  ...commonNodeStyle,
  backgroundColor: '#e6f7ff', // A light blue, adjust as needed
  border: '1px solid #91d5ff'
};

const TopicNode = React.memo(({ data }) => {
  console.log(`TopicNode rendering: Label=${data.label}, DisplayNumber=${data.displayNumber}, SiblingOrder=${data.siblingOrder}, FullData=${JSON.stringify(data)}`);
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div style={{
        ...commonNodeStyle,
        backgroundColor: '#f0fdf4',
        border: '2px solid #86efac'
      }}>
        <div>
          {data.displayNumber && <span style={{ marginRight: '4px' }}>{data.displayNumber}</span>}
          <span>{data.label}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
});

const ReferenceNode = React.memo(({ data }) => (
  <>
    <Handle type="target" position={Position.Left} />
    <div style={{
      ...commonNodeStyle,
      backgroundColor: '#f8f9fa'
    }}>
      <div title={data.fullText}>{data.label}</div>
    </div>
    <Handle type="source" position={Position.Right} />
  </>
));

const PaperNode = React.memo(({ data }) => (
  <>
    <Handle type="target" position={Position.Left} />
    <div style={{
      ...commonNodeStyle,
      backgroundColor: '#e3f2fd',
      border: '2px solid #90caf9'
    }}>
      <div>{data.label}</div>
      {data.importance > 0 && (
        <div style={{ fontSize: '0.8em', color: '#666' }}>
          Importance: {data.importance}/10
        </div>
      )}
      {data.notes && (
        <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
          Notes: {data.notes}
        </div>
      )}
    </div>
    <Handle type="source" position={Position.Right} />
  </>
));

const CentralTopicNode = React.memo(({ data }) => (
  <>
    <Handle type="target" position={Position.Left} />
    <div style={{
      ...commonNodeStyle,
      backgroundColor: '#fff3e0',
      border: '2px solid #ffb74d',
      padding: '8px',
      fontSize: '16px',
      fontWeight: 'bold'
    }}>
      <div
        contentEditable
        onBlur={(e) => data.onRename(e.target.textContent)}
        suppressContentEditableWarning={true}
      >
        {data.label}
      </div>
    </div>
    <Handle type="source" position={Position.Right} />
  </>
));

const ParagraphNode = React.memo(({ data }) => (
  <>
    <Handle type="target" position={Position.Left} />
    <div style={paragraphNodeStyle}>
      <div>
        {data.displayNumber && <span style={{ marginRight: '4px' }}>{data.displayNumber}</span>}
        <span>{data.label}</span> {/* Statement will be in data.label */}
      </div>
    </div>
    <Handle type="source" position={Position.Right} />
  </>
));

const nodeTypes = {
  referenceNode: ReferenceNode,
  paperNode: PaperNode,
  topicNode: TopicNode,
  centralTopicNode: CentralTopicNode,
  paragraphNode: ParagraphNode,
  custom: CustomNode
};

const edgeTypes = {
  floating: SimpleFloatingEdge,
  simpleFloatingEdge: SimpleFloatingEdge // Added to fix console warning
};

const calculateDisplayNumbers = (nodes, edges) => {
  const nodeMap = new Map(nodes.map(n => [n.id, {
    ...n,
    data: {
      ...n.data,
      displayNumber: undefined
    },
    children: []
  }]));
  const centralTopic = nodes.find(n => n.type === 'centralTopicNode');

  if (!centralTopic) return nodes;

  edges.forEach(edge => {
    if (edge.type === 'floating' && (edge.label === 'HAS_TOPIC' || edge.label === 'HAS_PARAGRAPH')) {
      const parentNode = nodeMap.get(edge.source);
      const childNode = nodeMap.get(edge.target);
      if (parentNode && childNode &&
          (parentNode.type === 'centralTopicNode' || parentNode.type === 'topicNode') &&
          (childNode.type === 'topicNode' || childNode.type === 'paragraphNode')) {
        if (childNode.data.siblingOrder !== undefined && childNode.data.siblingOrder !== null) {
          parentNode.children.push(childNode);
        }
      }
    }
  });

  const recursivelyAssignNumbers = (parentId, parentDisplayNumber) => {
    const parentNode = nodeMap.get(parentId);
    if (!parentNode || !parentNode.children) return;

    const sortedChildren = parentNode.children
      .filter(child => (child.type === 'topicNode' || child.type === 'paragraphNode') && child.data.siblingOrder !== undefined && child.data.siblingOrder !== null)
      .sort((a, b) => a.data.siblingOrder - b.data.siblingOrder);

    sortedChildren.forEach((child) => {
      const currentNumber = child.data.siblingOrder;
      console.log(`[recursivelyAssignNumbers] Calculating for ${child.id}: parentDisplayNumber=${parentDisplayNumber}, currentNumber=${currentNumber}`);
      const displayNumber = parentDisplayNumber !== '' ? `${parentDisplayNumber}${currentNumber}.` : `${currentNumber}.`;

      const originalChildNode = nodeMap.get(child.id);
      if (originalChildNode) {
        originalChildNode.data = {
          ...originalChildNode.data,
          displayNumber: displayNumber
        };
        console.log(`[recursivelyAssignNumbers] Assigned to ${originalChildNode.id}: displayNumber=${displayNumber}, SiblingOrder=${originalChildNode.data.siblingOrder}, FullData=${JSON.stringify(originalChildNode.data)}`);
        recursivelyAssignNumbers(child.id, displayNumber);
      }
    });
  };

  recursivelyAssignNumbers(centralTopic.id, '');

  const resultNodes = Array.from(nodeMap.values());
  console.log('[calculateDisplayNumbers] Resulting nodes:', JSON.stringify(resultNodes.map(n => ({id: n.id, label: n.data.label, displayNumber: n.data.displayNumber, siblingOrder: n.data.siblingOrder }))));
  return resultNodes;
};

const initialNodes = [];
const initialEdges = [];

function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showImportantPapers, setShowImportantPapers] = useState(false);
  const [dbStatus, setDbStatus] = useState('connecting');
  const [currentPaperId, setCurrentPaperId] = useState(null);
  // const [currentPaperTitle, setCurrentPaperTitle] = useState(''); // Removed unused state
  const [editNode, setEditNode] = useState(null);
  const [showTopicPopup, setShowTopicPopup] = useState(false);
  const [showCentralTopicPopup, setShowCentralTopicPopup] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newCentralTopicName, setNewCentralTopicName] = useState('');
  const [parentForNewTopic, setParentForNewTopic] = useState(null);
  const [showParagraphPopup, setShowParagraphPopup] = useState(false);
  const [newParagraphStatement, setNewParagraphStatement] = useState('');
  const [parentForNewParagraph, setParentForNewParagraph] = useState(null);
  const [showNodeContextMenu, setShowNodeContextMenu] = useState(false);
  const [nodeContextMenuPosition, setNodeContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextNodeForMenu, setContextNodeForMenu] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [leftWidth, setLeftWidth] = useState(50);
  const [pdfContent, setPdfContent] = useState({ pages: [] });
  const [selectedText, setSelectedText] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const leftWorkspaceRef = useRef(null);
  const dragRef = useRef(null);


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNodeContextMenu && !event.target.closest('.context-menu')) {
        setShowNodeContextMenu(false);
      }
      if (showContextMenu && !event.target.closest('.context-menu-pdf')) {
        setShowContextMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showNodeContextMenu, showContextMenu]);

  const handleUpdateNode = async (formData) => {
    try {
      const nodeId = editNode.id.split('-')[1];
      const nodeType = editNode.type.replace('Node', '');
      
      const label = nodeType === 'paper' ? 'Paper' :
                   nodeType === 'topic' ? 'Topic' :
                   nodeType === 'central-topic' ? 'CentralTopic' :
                   nodeType === 'reference' ? 'ReferencedText' :
                   nodeType === 'paragraph' ? 'Paragraph' : null;

      if (!label) {
        throw new Error('Invalid node type');
      }

      const oldSiblingOrder = editNode?.data?.siblingOrder;
      const newSiblingOrder = parseInt(formData.siblingOrder || 1);

      if (nodeType === 'topic' && oldSiblingOrder !== undefined && oldSiblingOrder !== newSiblingOrder) {
        let parentNeo4jId = null;
        const parentEdge = edges.find(edge => edge.target === editNode.id && (edge.label === 'HAS_TOPIC' || edge.type === 'floating'));
        if (parentEdge) {
          const parentIdParts = parentEdge.source.split('-');
          parentNeo4jId = parseInt(parentIdParts[parentIdParts.length - 1]);
        }

        if (parentNeo4jId !== null) {
          console.log(`Reordering topic ${nodeId}: from ${oldSiblingOrder} to ${newSiblingOrder}, parent ${parentNeo4jId}`);
          await executeQuery(
            `MATCH (parent) WHERE ID(parent) = $parentNeo4jId
            MATCH (movedNode:Topic) WHERE ID(movedNode) = $movedNodeId
            MATCH (parent)-[:HAS_TOPIC]->(sibling:Topic)
            WITH movedNode, $newSiblingOrder AS newOrder, $oldSiblingOrder AS oldOrder, parent, COLLECT({node: sibling, order: sibling.siblingOrder}) AS siblingsList
            UNWIND siblingsList AS s
            WITH movedNode, newOrder, oldOrder, parent, s.node AS siblingNode, s.order AS currentOrder
            SET siblingNode.siblingOrder = CASE
              WHEN siblingNode = movedNode THEN newOrder
              WHEN oldOrder < newOrder AND currentOrder > oldOrder AND currentOrder <= newOrder THEN currentOrder - 1
              WHEN oldOrder > newOrder AND currentOrder >= newOrder AND currentOrder < oldOrder THEN currentOrder + 1
              ELSE currentOrder
            END
            WITH movedNode, $label AS nodeName
            SET movedNode.name = nodeName`,
            {
              parentNeo4jId: parentNeo4jId,
              movedNodeId: parseInt(nodeId),
              oldSiblingOrder: oldSiblingOrder,
              newSiblingOrder: newSiblingOrder,
              label: formData.label
            }
          );

          const affectedNodesResult = await executeQuery(
            `MATCH (parent) WHERE ID(parent) = $parentNeo4jId
             OPTIONAL MATCH (parent)-[:HAS_TOPIC]->(child:Topic)
             RETURN parent, COLLECT({
               id: ID(child),
               name: child.name,
               positionX: child.positionX,
               positionY: child.positionY,
               siblingOrder: child.siblingOrder,
               createdAt: child.createdAt
             }) AS childrenData`,
            { parentNeo4jId: parentNeo4jId }
          );

          if (affectedNodesResult && affectedNodesResult.length > 0) {
            const childrenDataFromDb = affectedNodesResult[0].get('childrenData');
            
            setNodes(prevNodes => {
              const dbChildrenMap = new Map();
              childrenDataFromDb.forEach(childDbRaw => {
                dbChildrenMap.set(`topic-${safeConvertNeoInt(childDbRaw.id)}`, {
                  name: childDbRaw.name,
                  siblingOrder: safeConvertNeoInt(childDbRaw.siblingOrder),
                });
              });

              return prevNodes.map(n => {
                const dbChildData = dbChildrenMap.get(n.id);
                if (dbChildData) {
                  const isMovedNode = n.id === editNode.id;
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      label: isMovedNode ? formData.label : dbChildData.name,
                      siblingOrder: dbChildData.siblingOrder,
                      ...(isMovedNode && nodeType === 'topic' && {}),
                      ...(isMovedNode && nodeType === 'referenceNode' && { fullText: formData.fullText }),
                      ...(isMovedNode && nodeType === 'paperNode' && {
                        importance: parseInt(formData.importance || 0),
                        notes: formData.notes || ''
                      }),
                    }
                  };
                }
                return n;
              });
            });
          } else {
            setNodes(prevNodes => prevNodes.map(n => {
              if (n.id === editNode.id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    label: formData.label,
                    siblingOrder: newSiblingOrder, 
                    ...(nodeType === 'referenceNode' && { fullText: formData.fullText }),
                    ...(nodeType === 'paperNode' && {
                      importance: parseInt(formData.importance || 0),
                      notes: formData.notes || ''
                    }),
                  }
                };
              }
              return n;
            }));
          }
        } else { 
          const query = `
            MATCH (n:${label})
            WHERE ID(n) = $nodeId
            SET n.name = $label
            ${nodeType === 'referenceNode' ? ', n.text = $fullText' : ''}
            ${nodeType === 'paperNode' ? ', n.importance = $importance, n.notes = $notes' : ''}
            ${(nodeType === 'topic' || nodeType === 'paragraph') ? ', n.siblingOrder = $siblingOrder' : ''}
            RETURN n
          `;
          await executeQuery(query, {
            nodeId: parseInt(nodeId),
            label: formData.label,
            fullText: formData.fullText,
            importance: parseInt(formData.importance || 0),
            notes: formData.notes || '',
            siblingOrder: newSiblingOrder
          });
          setNodes(prevNodes => prevNodes.map(n =>
            n.id === editNode.id
              ? { ...n, data: { ...n.data, ...formData, siblingOrder: newSiblingOrder } } 
              : n
          ));
        }
      } else { 
          const query = `
            MATCH (n:${label})
            WHERE ID(n) = $nodeId
            SET n.name = $label 
            ${nodeType === 'referenceNode' ? ', n.text = $fullText' : ''}
            ${nodeType === 'paperNode' ? ', n.importance = $importance, n.notes = $notes' : ''}
            ${(nodeType === 'topic' || nodeType === 'paragraph' || nodeType === 'central-topic') ? ', n.siblingOrder = $siblingOrder' : ''}
            RETURN n
          `;
          await executeQuery(query, {
            nodeId: parseInt(nodeId),
            label: formData.label,
            fullText: formData.fullText,
            importance: parseInt(formData.importance || 0),
            notes: formData.notes || '',
            siblingOrder: newSiblingOrder
          });
        setNodes(prevNodes => prevNodes.map(n =>
          n.id === editNode.id
            ? { ...n, data: { ...n.data, ...formData, siblingOrder: newSiblingOrder } }
            : n
        ));
      }
      setNodes(prevNodes => calculateDisplayNumbers(prevNodes, edges));
      setEditNode(null);
    } catch (error) {
      console.error('Error updating node:', error);
      alert('Failed to update node: ' + error.message);
    }
  };

  const handleCreateCentralTopic = async () => {
    if (!newCentralTopicName.trim()) {
      alert('Please enter a central topic name');
      return;
    }
    try {
      const result = await executeQuery(
        'CREATE (ct:CentralTopic {name: $name, positionX: $positionX, positionY: $positionY, createdAt: datetime()}) RETURN ID(ct) as id, elementId(ct) as elementId, ct.name as name, ct.positionX as positionX, ct.positionY as positionY, ct.createdAt as createdAt',
        {
          name: newCentralTopicName.trim(),
          positionX: getRandomPosition().x,
          positionY: getRandomPosition().y
        }
      );
      const record = result[0];
      const newId = record.get('id').toNumber();
      const elementId = record.get('elementId');

      const newNode = {
        id: `central-topic-${newId}`,
        type: 'centralTopicNode',
        position: { x: record.get('positionX'), y: record.get('positionY') },
        data: {
          label: record.get('name'),
          rawElementId: elementId,
          createdAt: record.get('createdAt').toString(),
          onRename: async (newName) => {
            await executeQuery('MATCH (n) WHERE ID(n) = $id SET n.name = $newName', { id: newId, newName });
            setNodes(nds => nds.map(n => n.id === `central-topic-${newId}` ? { ...n, data: { ...n.data, label: newName } } : n));
          }
        },
      };
      setNodes((nds) => nds.concat(newNode));
      setNewCentralTopicName('');
      setShowCentralTopicPopup(false);
    } catch (error) {
      console.error('Error creating central topic:', error);
      alert('Failed to create central topic: ' + error.message);
    }
  };

  const handleDeleteNode = async (nodeToDelete) => {
    try {
      const parts = nodeToDelete.id.split('-');
      const nodeId = parseInt(parts[parts.length - 1]);
      const nodeTypePrefix = parts.slice(0, -1).join('-');
      
      let label;
      switch (nodeTypePrefix) {
        case 'paper': label = 'Paper'; break;
        case 'topic': label = 'Topic'; break;
        case 'central-topic': label = 'CentralTopic'; break;
        case 'referenceNode': label = 'ReferencedText'; break;
        case 'paragraph': label = 'Paragraph'; break;
        default: throw new Error(`Unknown node type prefix: ${nodeTypePrefix}`);
      }

      await executeQuery(
        `MATCH (n:${label}) WHERE ID(n) = $nodeId DETACH DELETE n`,
        { nodeId }
      );
      setNodes((nds) => nds.filter((n) => n.id !== nodeToDelete.id));
      setEdges((eds) => eds.filter((e) => e.source !== nodeToDelete.id && e.target !== nodeToDelete.id));
      setNodes(prevNodes => calculateDisplayNumbers(prevNodes, edges));

    } catch (error) {
      console.error('Error deleting node:', error);
      alert('Failed to delete node: ' + error.message);
    }
  };
  
  const handleCreateTopicNode = async (parent, topicName) => {
    try {
      let newTopicId;
      let newTopicElementId;
      let position = getRandomPosition();
      let newSiblingOrder = 1;

      if (parent) {
        const parentIdParts = parent.id.split('-');
        const parentNeo4jId = parseInt(parentIdParts[parentIdParts.length - 1]);
        const parentType = parentIdParts.slice(0, -1).join('-');
        const parentLabel = parentType === 'central-topic' ? 'CentralTopic' : 'Topic';

        const siblingOrderResult = await executeQuery(
          `MATCH (p:${parentLabel})-[r:HAS_TOPIC]->(child:Topic) WHERE ID(p) = $parentId
           RETURN MAX(child.siblingOrder) as maxOrder`,
          { parentId: parentNeo4jId }
        );
        if (siblingOrderResult && siblingOrderResult.length > 0 && siblingOrderResult[0].get('maxOrder') !== null) {
          newSiblingOrder = siblingOrderResult[0].get('maxOrder').toNumber() + 1;
        }
        
        position = { x: parent.position.x + 200, y: parent.position.y + (newSiblingOrder * 50 - 100) };

        const result = await executeQuery(
          `MATCH (p:${parentLabel}) WHERE ID(p) = $parentId
           CREATE (t:Topic {name: $name, positionX: $positionX, positionY: $positionY, siblingOrder: $siblingOrder, createdAt: datetime()})
           CREATE (p)-[:HAS_TOPIC]->(t)
           RETURN ID(t) as id, elementId(t) as elementId`,
          { parentId: parentNeo4jId, name: topicName, positionX: position.x, positionY: position.y, siblingOrder: newSiblingOrder }
        );
        newTopicId = result[0].get('id').toNumber();
        newTopicElementId = result[0].get('elementId');
      } else { 
        const result = await executeQuery(
          'CREATE (t:Topic {name: $name, positionX: $positionX, positionY: $positionY, siblingOrder: $siblingOrder, createdAt: datetime()}) RETURN ID(t) as id, elementId(t) as elementId',
          { name: topicName, positionX: position.x, positionY: position.y, siblingOrder: newSiblingOrder }
        );
        newTopicId = result[0].get('id').toNumber();
        newTopicElementId = result[0].get('elementId');
      }

      const newNode = {
        id: `topic-${newTopicId}`,
        type: 'topicNode',
        position,
        data: {
          label: topicName,
          rawElementId: newTopicElementId,
          siblingOrder: newSiblingOrder,
        },
      };

      setNodes((nds) => {
        const newNodes = nds.concat(newNode);
        if (parent) { 
          const newEdge = {
            id: `e-${parent.id}-topic-${newTopicId}`,
            source: parent.id,
            target: newNode.id,
            type: 'floating',
            label: 'HAS_TOPIC',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed }
          };
          setEdges((eds) => addEdge(newEdge, eds));
          return calculateDisplayNumbers(newNodes, addEdge(newEdge, edges)); 
        }
        return calculateDisplayNumbers(newNodes, edges);
      });
      
      setShowTopicPopup(false);
      setNewTopicName('');
      setParentForNewTopic(null);
    } catch (error) {
      console.error('Error creating topic node:', error);
      alert('Failed to create topic: ' + error.message);
    }
  };

  const handleCreateParagraphNode = async (parent, statement) => {
    try {
      let newParagraphId;
      let newParagraphElementId;
      let position = getRandomPosition();
      let newSiblingOrder = 1;

      if (parent) { 
        const parentIdParts = parent.id.split('-');
        const parentNeo4jId = parseInt(parentIdParts[parentIdParts.length - 1]);
        const parentLabel = 'Topic'; 

        const siblingOrderResult = await executeQuery(
          `MATCH (p:${parentLabel})-[r:HAS_PARAGRAPH]->(child:Paragraph) WHERE ID(p) = $parentId
           RETURN MAX(child.siblingOrder) as maxOrder`,
          { parentId: parentNeo4jId }
        );
        if (siblingOrderResult && siblingOrderResult.length > 0 && siblingOrderResult[0].get('maxOrder') !== null) {
          newSiblingOrder = siblingOrderResult[0].get('maxOrder').toNumber() + 1;
        }
        
        position = { x: parent.position.x + 250, y: parent.position.y + (newSiblingOrder * 40 - 80) };

        const result = await executeQuery(
          `MATCH (p:${parentLabel}) WHERE ID(p) = $parentId
           CREATE (para:Paragraph {Statement: $statement, positionX: $positionX, positionY: $positionY, siblingOrder: $siblingOrder, createdAt: datetime()})
           CREATE (p)-[:HAS_PARAGRAPH]->(para)
           RETURN ID(para) as id, elementId(para) as elementId`,
          { parentId: parentNeo4jId, statement: statement, positionX: position.x, positionY: position.y, siblingOrder: newSiblingOrder }
        );
        newParagraphId = result[0].get('id').toNumber();
        newParagraphElementId = result[0].get('elementId');
      } else { 
         const result = await executeQuery(
          'CREATE (para:Paragraph {Statement: $statement, positionX: $positionX, positionY: $positionY, siblingOrder: $siblingOrder, createdAt: datetime()}) RETURN ID(para) as id, elementId(para) as elementId',
          { statement: statement, positionX: position.x, positionY: position.y, siblingOrder: newSiblingOrder }
        );
        newParagraphId = result[0].get('id').toNumber();
        newParagraphElementId = result[0].get('elementId');
      }

      const newNode = {
        id: `paragraph-${newParagraphId}`,
        type: 'paragraphNode',
        position,
        data: {
          label: statement, 
          rawElementId: newParagraphElementId,
          siblingOrder: newSiblingOrder,
          onRename: async (newName) => { 
            try {
              await executeQuery('MATCH (n:Paragraph) WHERE ID(n) = $id SET n.Statement = $newName', { id: newParagraphId, newName });
              setNodes(nds => nds.map(n => n.id === `paragraph-${newParagraphId}` ? { ...n, data: { ...n.data, label: newName } } : n));
            } catch (renameError) {
              console.error('Error renaming paragraph:', renameError);
              alert('Failed to rename paragraph.');
            }
          }
        },
      };

      setNodes(prev => [...prev, newNode]);

      if (parent) {
        const newEdge = {
          id: 'e-' + parent.id + '-paragraph-' + newParagraphId,
          source: parent.id,
          target: newNode.id,
          type: 'floating', 
          label: 'HAS_PARAGRAPH', 
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed }
        };
        setEdges(prev => addEdge(newEdge, prev));
      }
    } catch (error) {
      console.error('Error creating paragraph node:', error);
      alert('Failed to create paragraph: ' + error.message);
    }

    setNewParagraphStatement('');
    setShowParagraphPopup(false);
    setParentForNewParagraph(null);
  };

 const onNodeContextMenu = useCallback((event, node) => {
   event.preventDefault();
   event.stopPropagation();
   setNodeContextMenuPosition({ x: event.clientX, y: event.clientY });
   setContextNodeForMenu(node);
   setShowNodeContextMenu(true);
 }, [setNodeContextMenuPosition, setContextNodeForMenu, setShowNodeContextMenu]);

  const handleNodeContextMenuAction = useCallback((action) => {
    if (!contextNodeForMenu) return;

    switch (action) {
      case 'addParagraph':
        setParentForNewParagraph(contextNodeForMenu.id);
        setShowParagraphPopup(true);
        break;
      case 'addSubTopic':
        setParentForNewTopic(contextNodeForMenu.id);
        setShowTopicPopup(true);
        break;
      case 'deleteNode':
        handleDeleteNode(contextNodeForMenu);
        break;
      // 'exportRtf' case removed
      default:
        console.warn('Unknown node context menu action:', action);
    }
    setShowNodeContextMenu(false);
    setContextNodeForMenu(null);
  }, [contextNodeForMenu, setParentForNewParagraph, setShowParagraphPopup, setParentForNewTopic, setShowTopicPopup, handleDeleteNode, setShowNodeContextMenu, setContextNodeForMenu]);

  useEffect(() => {
    const initAndLoadData = async () => {
      try {
        console.log('Initializing Neo4j connection...');
        await initializeDriver();
        console.log('Successfully connected to Neo4j');
        
        console.log('Loading central topics...');
        setDbStatus('connected');
        
        const centralTopicsQuery =
          'MATCH (ct:CentralTopic) ' +
          'OPTIONAL MATCH (ct)-[r:HAS_TOPIC|HAS_REFERENCE|HAS_PARAGRAPH]-(other) ' +
          'RETURN ' +
          '  ID(ct) as topicId, elementId(ct) as elementId, ' + 
          '  ct.name as name, ' +
          '  toFloat(ct.positionX) as positionX, ' +
          '  toFloat(ct.positionY) as positionY, ' +
          '  COLLECT(DISTINCT { ' +
          '    otherId: ID(other), elementIdOther: elementId(other), ' + 
          '    otherType: CASE ' +
          "      WHEN other:Topic THEN 'topic' " +
          "      WHEN other:Paper THEN 'paper' " +
          "      WHEN other:CentralTopic THEN 'central-topic' " +
          "      WHEN other:Paragraph THEN 'paragraph' " +
          "      WHEN other:ReferencedText THEN 'referenceNode' " + 
          '    END, ' +
          '    isOutgoing: startNode(r) = ct ' +
          '  }) as connections';
        const centralTopics = await executeQuery(centralTopicsQuery);

        const centralTopicNodes = centralTopics.map(topic => {
          const defaultPos = getRandomPosition();
          const position = safeGetPosition(topic, defaultPos);
          const idValue = safeConvertNeoInt(topic.get('topicId'));
          const elementId = topic.get('elementId'); 

          return {
            id: `central-topic-${idValue}`,
            type: 'centralTopicNode',
            position,
            data: {
              label: topic.get('name'),
              rawElementId: elementId || idValue.toString(), 
              onRename: async (newName) => {
                await executeQuery('MATCH (n) WHERE ID(n) = $id SET n.name = $newName', { id: idValue, newName });
                setNodes(nds => nds.map(n => n.id === `central-topic-${idValue}` ? { ...n, data: { ...n.data, label: newName } } : n));
              }
            },
          };
        });

        const paperQuery = 'MATCH (p:Paper) RETURN ID(p) as id, p.title as title, p.author as author, p.importance as importance, p.notes as notes, toFloat(p.positionX) as positionX, toFloat(p.positionY) as positionY, elementId(p) as elementId';
        const papers = await executeQuery(paperQuery);
        const paperNodes = papers.map(paper => {
          const defaultPos = getRandomPosition();
          const position = safeGetPosition(paper, defaultPos);
          const idValue = safeConvertNeoInt(paper.get('id'));
          const elementId = paper.get('elementId');
          return {
            id: `paper-${idValue}`,
            type: 'paperNode',
            position,
            data: {
              label: paper.get('title') || 'Untitled Paper',
              author: paper.get('author') || 'Unknown Author',
              importance: safeConvertNeoInt(paper.get('importance'), 0),
              notes: paper.get('notes') || '',
              rawElementId: elementId || idValue.toString(),
            },
          };
        });

        const topicQuery = 'MATCH (t:Topic) RETURN ID(t) as id, t.name as name, toFloat(t.positionX) as positionX, toFloat(t.positionY) as positionY, t.siblingOrder as siblingOrder, elementId(t) as elementId, t.createdAt as createdAt';
        const topics = await executeQuery(topicQuery);
        const topicNodes = topics.map(topic => {
          const defaultPos = getRandomPosition();
          const position = safeGetPosition(topic, defaultPos);
          const idValue = safeConvertNeoInt(topic.get('id'));
          const elementId = topic.get('elementId');
          return {
            id: `topic-${idValue}`,
            type: 'topicNode',
            position,
            data: {
              label: topic.get('name') || 'Untitled Topic',
              rawElementId: elementId || idValue.toString(),
              siblingOrder: safeConvertNeoInt(topic.get('siblingOrder'), null), 
              createdAt: topic.get('createdAt')?.toString()
            },
          };
        });
        
        const paragraphQuery = 'MATCH (p:Paragraph) RETURN ID(p) as id, p.Statement as statement, toFloat(p.positionX) as positionX, toFloat(p.positionY) as positionY, p.siblingOrder as siblingOrder, elementId(p) as elementId, p.createdAt as createdAt';
        const paragraphs = await executeQuery(paragraphQuery);
        const paragraphNodes = paragraphs.map(para => {
          const defaultPos = getRandomPosition();
          const position = safeGetPosition(para, defaultPos);
          const idValue = safeConvertNeoInt(para.get('id'));
          const elementId = para.get('elementId');
          return {
            id: `paragraph-${idValue}`,
            type: 'paragraphNode',
            position,
            data: {
              label: para.get('statement') || 'Empty Paragraph',
              rawElementId: elementId || idValue.toString(),
              siblingOrder: safeConvertNeoInt(para.get('siblingOrder'), null),
              createdAt: para.get('createdAt')?.toString(),
               onRename: async (newName) => {
                await executeQuery('MATCH (n:Paragraph) WHERE ID(n) = $id SET n.Statement = $newName', { id: idValue, newName });
                setNodes(nds => nds.map(n => n.id === `paragraph-${idValue}` ? { ...n, data: { ...n.data, label: newName } } : n));
              }
            },
          };
        });

        const referenceQuery = 'MATCH (r:ReferencedText) RETURN ID(r) as id, r.text as text, toFloat(r.positionX) as positionX, toFloat(r.positionY) as positionY, elementId(r) as elementId';
        const references = await executeQuery(referenceQuery);
        const referenceNodes = references.map(ref => {
          const defaultPos = getRandomPosition();
          const position = safeGetPosition(ref, defaultPos);
          const idValue = safeConvertNeoInt(ref.get('id'));
          const elementId = ref.get('elementId');
          const fullText = ref.get('text') || 'No text';
          return {
            id: `referenceNode-${idValue}`,
            type: 'referenceNode',
            position,
            data: {
              label: fullText.substring(0, 30) + (fullText.length > 30 ? '...' : ''),
              fullText: fullText,
              rawElementId: elementId || idValue.toString(),
            },
          };
        });
        
        const paragraphCiteQuery = `
          MATCH (para:Paragraph)-[r:CITES]->(ref:ReferencedText)
          RETURN ID(para) AS sourceId, ID(ref) AS targetId, type(r) as label
        `;
        const paragraphCiteResults = await executeQuery(paragraphCiteQuery);
        const paragraphCiteEdges = paragraphCiteResults.map(edge => ({
          id: `e-paragraph-${safeConvertNeoInt(edge.get('sourceId'))}-referenceNode-${safeConvertNeoInt(edge.get('targetId'))}-CITES`,
          source: `paragraph-${safeConvertNeoInt(edge.get('sourceId'))}`,
          target: `referenceNode-${safeConvertNeoInt(edge.get('targetId'))}`,
          type: 'simpleFloatingEdge', 
          label: edge.get('label'),
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#FF0072' },
          style: { stroke: '#FF0072', strokeWidth: 1.5 },
        }));

        const relationshipQuery = `
          MATCH (source)-[r]->(target)
          WHERE NOT type(r) = 'CITES' 
          RETURN 
            ID(source) AS sourceId, 
            labels(source)[0] AS sourceType, 
            elementId(source) AS sourceElementId, 
            ID(target) AS targetId, 
            labels(target)[0] AS targetType, 
            elementId(target) AS targetElementId, 
            type(r) AS label
        `;
        const relationships = await executeQuery(relationshipQuery);
        const loadedEdges = relationships.map(rel => {
          const sourceId = safeConvertNeoInt(rel.get('sourceId'));
          const targetId = safeConvertNeoInt(rel.get('targetId'));
          let sourceType = rel.get('sourceType')?.toLowerCase().replace('_', '-');
          if (sourceType === 'referencedtext') sourceType = 'referenceNode';
          if (sourceType === 'centraltopic') sourceType = 'central-topic'; // Ensure 'central-topic' matches node ID format
          
          let targetType = rel.get('targetType')?.toLowerCase().replace('_', '-');
          if (targetType === 'referencedtext') targetType = 'referenceNode';
          if (targetType === 'centraltopic') targetType = 'central-topic'; // Ensure 'central-topic' matches node ID format
          
          const label = rel.get('label');

          const sourceReactFlowId = `${sourceType}-${sourceId}`;
          const targetReactFlowId = `${targetType}-${targetId}`;

          console.log('[initAndLoadData] Edge Processing:', {
            originalSourceType: rel.get('sourceType'),
            originalTargetType: rel.get('targetType'),
            processedSourceType: sourceType,
            processedTargetType: targetType,
            sourceReactFlowId,
            targetReactFlowId,
            label
          });

          return {
            id: `edge-${sourceReactFlowId}-${targetReactFlowId}-${label}-${Date.now()}-${Math.random()}`, 
            source: sourceReactFlowId,
            target: targetReactFlowId,
            type: 'floating',
            label: label,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
          };
        }).filter(edge => edge.source && edge.target && edge.label); 


        const baseNodes = [
          ...centralTopicNodes, ...paperNodes, ...topicNodes, ...referenceNodes, ...paragraphNodes
        ];
        
        console.log('All nodes loaded, combining:', { 
          centralTopicNodes, paperNodes, topicNodes, referenceNodes, paragraphNodes 
        });

        const allEdges = [
          ...loadedEdges, ...paragraphCiteEdges 
        ].filter((edge, index, self) => 
            index === self.findIndex((e) => (
                e.source === edge.source && e.target === edge.target && e.label === edge.label
            ))
        );
        
        const nodesWithDisplayNumbers = calculateDisplayNumbers(baseNodes, allEdges.filter(e => e.label === 'HAS_TOPIC' || e.label === 'HAS_PARAGRAPH'));
        
        setNodes(nodesWithDisplayNumbers.map(node => ({
          ...node,
          style: node.type === 'paperNode' ? paperNodeStyle :
                 node.type === 'topicNode' ? topicNodeStyle :
                 node.type === 'referenceNode' ? referenceNodeStyle :
                 node.type === 'centralTopicNode' ? centralTopicNodeStyle :
                 node.type === 'paragraphNode' ? paragraphNodeStyle :
                 commonNodeStyle
        })));
        setEdges(allEdges);
        console.log('Data loaded and processed.');

      } catch (error) {
        console.error('Failed to initialize and load data:', error);
        setDbStatus('error');
      }
    };
    initAndLoadData();
    return () => {
      closeDriver();
    };
  }, []);

  const onSelectionChange = useCallback((elements) => {
    if (elements && elements.nodes && elements.nodes.length > 0) {
      setSelectedNode(elements.nodes[0]);
      setNodes((prevNodes) =>
        prevNodes.map((node) => ({
          ...node,
          style: node.id === elements.nodes[0].id
            ? selectedNodeStyle
            : node.type === 'paperNode'
              ? paperNodeStyle
              : node.type === 'topicNode'
                ? topicNodeStyle
                : node.type === 'referenceNode'
                  ? referenceNodeStyle
                  : node.type === 'centralTopicNode'
                    ? centralTopicNodeStyle
                    : node.type === 'paragraphNode'
                      ? paragraphNodeStyle
                      : commonNodeStyle
        }))
      );
    } else {
      setSelectedNode(null);
      setNodes((prevNodes) =>
        prevNodes.map((node) => ({
          ...node,
          style: node.type === 'paperNode' ? paperNodeStyle :
                 node.type === 'topicNode' ? topicNodeStyle :
                 node.type === 'referenceNode' ? referenceNodeStyle :
                 node.type === 'centralTopicNode' ? centralTopicNodeStyle :
                 node.type === 'paragraphNode' ? paragraphNodeStyle :
                 commonNodeStyle
        }))
      );
    }
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      const numPages = pdf.numPages;
      const pagesContent = [];
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const pageData = await processPdfPage(page, i);
        pagesContent.push(pageData);
      }
      setPdfContent({ pages: pagesContent, title: file.name });

      try {
        // First check if paper with same title exists
        const existingPaper = await executeQuery(
          'MATCH (p:Paper {title: $title}) RETURN ID(p) as id',
          { title: file.name }
        );

        if (existingPaper.length > 0) {
          // Use the existing paper's ID
          const existingId = existingPaper[0].get('id').toNumber();
          setCurrentPaperId(existingId);
          return;
        }

        // If no duplicate found, create the new paper with the original title
        const result = await executeQuery(
          'CREATE (p:Paper {title: $title, author: $author, uploadedAt: datetime(), positionX: $positionX, positionY: $positionY, localPath: $localPath}) RETURN ID(p) as id, elementId(p) as elementId',
          {
            title: file.name,
            author: 'Unknown',
            positionX: getRandomPosition().x,
            positionY: getRandomPosition().y,
            localPath: URL.createObjectURL(file)
          }
        );
        const newPaperId = result[0].get('id').toNumber();
        const newPaperElementId = result[0].get('elementId');
        const paperNode = {
          id: `paper-${newPaperId}`,
          type: 'paperNode',
          position: getRandomPosition(),
          data: {
            label: file.name,
            author: 'Unknown',
            rawElementId: newPaperElementId,
            localPath: URL.createObjectURL(file)
          },
          style: paperNodeStyle,
        };
        setNodes(nds => [...nds, paperNode]);
        setCurrentPaperId(newPaperId); 
        // setCurrentPaperTitle(file.name); // This was the unused state setter
      } catch (error) {
        console.error('Error handling paper upload:', error);
        alert('Error uploading paper: ' + error.message);
      }
    } else {
      alert('Please select a PDF file.');
    }
  };

  useEffect(() => {
    const handleContextMenu = (event) => {
      if (leftWorkspaceRef.current && leftWorkspaceRef.current.contains(event.target)) {
        event.preventDefault();
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        if (text) {
          setSelectedText(text);
          setContextMenuPosition({
            x: event.clientX,
            y: event.clientY
          });
          setShowContextMenu(true);
        }
      } else {
        setShowContextMenu(false);
      }
    };

    const handleClickOutside = (event) => {
      if (!event.target.closest('.context-menu-pdf')) {
        setShowContextMenu(false);
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [pdfContent]);

  useEffect(() => {
    const handleKeyDown = async (event) => {
      if (event.key === 'Delete' && selectedNode) {
        await handleDeleteNode(selectedNode);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNode, handleDeleteNode]); 

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const newLeftPercent = ((dragRef.current.startWidthPx + dx) / window.innerWidth) * 100;
      setLeftWidth(clamp(newLeftPercent, 20, 80)); 
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);


  const handleContextMenuAction = async (action) => {

    try {
      if (action === 'mark') {
        await executeQuery(
          `
          MATCH (p:Paper)
          WHERE ID(p) = $paperId
          CREATE (t:TextMark {
            text: $text,
            createdAt: datetime()
          })
          CREATE (p)-[r:HAS_MARK]->(t)
          `,
          {
            paperId: currentPaperId,
            text: selectedText,
            positionX: getRandomPosition().x,
            positionY: getRandomPosition().y
          }
        );
        console.log('Marked text saved and linked to paper:', selectedText);
      } else if (action === 'reference') {
        const result = await executeQuery(
          `
          MATCH (p:Paper)
          WHERE ID(p) = $paperId
          CREATE (r:ReferencedText {
            text: $text,
            createdAt: datetime(),
            positionX: $positionX,
            positionY: $positionY
          })
          CREATE (p)-[rel:HAS_REFERENCE]->(r)
          RETURN ID(r) as refId, elementId(r) as elementId
          `,
          {
            paperId: currentPaperId,
            text: selectedText,
            positionX: getRandomPosition().x,
            positionY: getRandomPosition().y
          }
        );
        
        if (!result || result.length === 0) {
          throw new Error('Failed to create reference: No result returned from database');
        }
        
        const record = result[0];
        if (!record || !record.get('refId')) {
          throw new Error('Failed to create reference: Invalid result structure');
        }
        
        const refId = record.get('refId').toNumber();
        const refElementId = record.get('elementId');
        const newRefNode = {
          id: `referenceNode-${refId}`, 
          type: 'referenceNode',
          position: getRandomPosition(),
          data: {
            label: selectedText.substring(0, 30) + (selectedText.length > 30 ? '...' : ''),
            fullText: selectedText,
            rawElementId: refElementId
          }
        };
        
        const newEdge = {
          id: `edge-paper-${currentPaperId}-referenceNode-${refId}-${Date.now()}-${Math.random()}`,
          source: `paper-${currentPaperId}`,
          target: `referenceNode-${refId}`,
          type: 'floating', 
          label: 'HAS_REFERENCE', 
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed }
        };
        
        setNodes(prevNodes => [...prevNodes, newRefNode]);
        setEdges(prevEdges => addEdge(newEdge, prevEdges)); 
        
        console.log('Reference created and added to graph:', refId);
      }
    } catch (error) {
      console.error('Error saving to Neo4j:', error);
      alert(error.message || 'Failed to save the selection. Please try again.');
    } finally {
      setShowContextMenu(false);
    }
  };

  const processPdfPage = async (page, pageNum) => {
    console.log('Getting text content for page...');
    const textContent = await page.getTextContent();
    console.log('Text content received:', textContent);
    const viewport = page.getViewport({ scale: 1.0 });
    
    const lines = textContent.items.reduce((acc, item) => {
      const y = Math.round((viewport.height - item.transform[5]) * 100) / 100;
      if (!acc[y]) {
        acc[y] = [];
      }
      acc[y].push({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
        fontSize: Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]),
        fontFamily: item.fontName,
        ascent: item.ascent,
        descent: item.descent,
        bold: item.fontName.toLowerCase().includes('bold'),
        italic: item.fontName.toLowerCase().includes('italic')
      });
      return acc;
    }, {});

    const sortedLines = Object.entries(lines)
      .sort(([y1], [y2]) => parseFloat(y1) - parseFloat(y2))
      .map(([yPos, items]) => ({
        y: parseFloat(yPos),
        text: items.sort((a, b) => a.x - b.x).map(item => item.text).join(' '),
        items: items.sort((a, b) => a.x - b.x) 
      }));

    return {
      pageNum,
      lines: sortedLines.map(line => {
        const style = {
          fontWeight: line.items[0]?.bold ? 'bold' : 'normal',
          fontStyle: line.items[0]?.italic ? 'italic' : 'normal',
          fontSize: `${line.items[0]?.fontSize || 10}px`, 
        };
        return {
          text: line.text,
          style: style,
          rawItems: line.items 
        };
      })
    };
  };

  const handleExportRtfFromMenu = () => {
    const centralTopicNode = nodes.find(node => node.type === 'centralTopicNode');
    if (centralTopicNode && centralTopicNode.data && centralTopicNode.data.rawElementId) {
      console.log('Exporting RTF from menu for Central Topic:', {
        nodeId: centralTopicNode.id,
        elementId: centralTopicNode.data.rawElementId,
        type: centralTopicNode.type,
        nodeData: centralTopicNode.data
      });
      exportGraphToRtf(centralTopicNode.data.rawElementId);
    } else {
      const topicNode = nodes.find(node => node.type === 'topicNode');
      if (topicNode && topicNode.data && topicNode.data.rawElementId) {
        console.log('No CentralTopic found. Exporting RTF from menu for Topic:', {
          nodeId: topicNode.id,
          elementId: topicNode.data.rawElementId,
          type: topicNode.type,
          nodeData: topicNode.data
        });
        exportGraphToRtf(topicNode.data.rawElementId);
      } else {
        alert('No Central Topic or Topic found to export. Please ensure a graph is loaded.');
        console.error('No CentralTopic or Topic node found with rawElementId to initiate RTF export from menu.');
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Header
        dbStatus={dbStatus}
        onFileUpload={handleFileUpload}
        onNewTopic={() => {
          setParentForNewTopic(null); 
          setShowTopicPopup(true);
        }}
        onNewCentralTopic={() => setShowCentralTopicPopup(true)}
        onNewParagraph={() => {
          setParentForNewParagraph(null); 
          setShowParagraphPopup(true);
        }}
        showImportantPapers={showImportantPapers}
        onToggleImportantPapers={() => setShowImportantPapers(!showImportantPapers)}
        onExportRtf={handleExportRtfFromMenu} 
      />
      <div className="flex flex-grow pt-16 overflow-hidden"> {/* pt-16 to offset fixed header */}
        {/* Left Workspace */}
        <div
          ref={leftWorkspaceRef}
          className="workspace p-6 overflow-y-auto bg-white border-r border-gray-300"
          style={{ width: `${leftWidth}%` }}
        >
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            {pdfContent.title || 'PDF Viewer'}
          </h2>
          {pdfContent.pages.length > 0 ? (
            pdfContent.pages.map((page, pageIndex) => (
              <div key={`page-${pageIndex}`} className="mb-8 pdf-page">
                <h3 className="text-lg font-medium mb-2 border-b pb-1">Page {page.pageNum}</h3>
                {page.lines.map((line, lineIndex) => (
                  <p
                    key={`line-${pageIndex}-${lineIndex}`}
                    style={{
                      fontSize: line.style.fontSize,
                      fontWeight: line.style.fontWeight,
                      fontStyle: line.style.fontStyle,
                      marginBottom: '0.2em', 
                      whiteSpace: 'pre-wrap' 
                    }}
                  >
                    {line.text}
                  </p>
                ))}
              </div>
            ))
          ) : (
            <p className="text-gray-500">Select a PDF file to view its content.</p>
          )}
          {/* PDF Context Menu */}
          {showContextMenu && selectedText && (
            <div
              className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 context-menu-pdf"
              style={{
                left: `${contextMenuPosition.x}px`,
                top: `${contextMenuPosition.y}px`
              }}
            >
              <button
                onClick={() => {
                  if (!currentPaperId || !pdfContent.pages.length) {
                    alert('Please load a PDF document first');
                    setShowContextMenu(false);
                    return;
                  }
                  handleContextMenuAction('mark');
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              >
                Mark
              </button>
              <button
                onClick={() => {
                  if (!currentPaperId || !pdfContent.pages.length) {
                    alert('Please load a PDF document first');
                    setShowContextMenu(false);
                    return;
                  }
                  handleContextMenuAction('reference');
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-t border-gray-200"
              >
                Reference
              </button>
            </div>
          )}
        </div>

        {/* Node Context Menu */}
        {showNodeContextMenu && contextNodeForMenu && (
          <div
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 context-menu"
            style={{
              left: `${nodeContextMenuPosition.x}px`,
              top: `${nodeContextMenuPosition.y}px`,
            }}
          >
            {(contextNodeForMenu.type === 'topicNode' || contextNodeForMenu.type === 'centralTopicNode') && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNodeContextMenuAction('addSubTopic');
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                >
                  Add Sub-Topic
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNodeContextMenuAction('addParagraph');
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                >
                  Add Paragraph
                </button>
              </>
            )}
            {(contextNodeForMenu.type === 'paperNode' || contextNodeForMenu.type === 'topicNode' || contextNodeForMenu.type === 'paragraphNode' || contextNodeForMenu.type === 'referenceNode' || contextNodeForMenu.type === 'centralTopicNode') && ( 
              <button
                onClick={() => handleNodeContextMenuAction('deleteNode')}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 border-t border-gray-200 mt-1 pt-1"
              >
                Delete Node
              </button>
            )}
          </div>
        )}

        {/* Resizer */}
        <div
          className={`workspace-resizer ${isDragging ? 'dragging' : ''}`}
          onMouseDown={(e) => {
            setIsDragging(true);
            dragRef.current = {
              startX: e.clientX,
              startWidthPx: leftWorkspaceRef.current.offsetWidth 
            };
          }}
        />

        {/* Right Workspace */}
        <div
          className="workspace p-6 overflow-y-auto"
          style={{ width: `${100 - leftWidth}%` }}
        >
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Flow Workspace</h2>
          <div className="h-[calc(100%-2rem)] border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <ReactFlow
              nodes={nodes && (showImportantPapers
                ? nodes.filter(node =>
                    !node ||
                    node.type !== 'paperNode' ||
                    (node.data?.importance && node.data.importance >= 7)
                  )
                : nodes)
              }
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              defaultEdgeOptions={{ type: 'floating', animated: true }}
              onSelectionChange={onSelectionChange}
              nodesFocusable={true}
              selectNodesOnDrag={false}
              onNodeDoubleClick={(_, node) => setEditNode(node)}
              onNodesChange={async (changes) => {
                const deletedNodes = changes.filter(change => change.type === 'remove');
                for (const node of deletedNodes) {
                  try {
                    const parts = node.id.split('-');
                    const nodeId = parts[parts.length - 1];
                    const nodeType = parts.slice(0, -1).join('-');
                    
                    const label = nodeType === 'paper' ? 'Paper' :
                                nodeType === 'topic' ? 'Topic' :
                                nodeType === 'central-topic' ? 'CentralTopic' :
                                nodeType === 'ref' ? 'ReferencedText' : null;
                    
                    if (label) {
                      await executeQuery(
                        `
                        MATCH (n:${label})
                        WHERE ID(n) = $nodeId
                        DETACH DELETE n
                        `,
                        { nodeId: parseInt(nodeId) }
                      );
                    }
                  } catch (error) {
                    console.error('Error deleting node from database:', error);
                  }
                }

                setNodes((nds) => {
                  const updatedNodes = applyNodeChanges(changes, nds);
                  return updatedNodes.map(node => ({
                    ...node,
                    style: selectedNode?.id === node.id
                      ? selectedNodeStyle
                      : node.type === 'paperNode'
                        ? paperNodeStyle
                        : node.type === 'topicNode'
                          ? topicNodeStyle
                          : node.type === 'referenceNode'
                            ? referenceNodeStyle
                            : centralTopicNodeStyle
                  }));
                });
                
                const positionChanges = changes.filter(change =>
                  change.type === 'position' && change.position
                );
                
                for (const change of positionChanges) {
                  const parts = change.id.split('-');
                  const nodeId = parts[parts.length - 1];
                  const nodeType = parts.slice(0, -1).join('-');
                  const label = nodeType === 'paper' ? 'Paper' :
                              nodeType === 'topic' ? 'Topic' :
                              nodeType === 'central-topic' ? 'CentralTopic' :
                              nodeType === 'referenceNode' ? 'ReferencedText' :
                              nodeType === 'paragraph' ? 'Paragraph' : null;
                  
                  console.log('Updating position for:', { nodeType, nodeId, label, position: change.position });
                  
                  if (label) {
                    try {
                      await executeQuery(
                        `
                        MATCH (n:${label})
                        WHERE ID(n) = $nodeId
                        SET n.positionX = $positionX,
                            n.positionY = $positionY
                        `, 
                        {
                          nodeId: parseInt(nodeId),
                          positionX: change.position.x,
                          positionY: change.position.y,
                        }
                      );
                    } catch (error) {
                      console.error('Error updating node position:', error);
                    }
                  }
                }
              }}
              onEdgesChange={async (changes) => {
                const deletedEdges = changes.filter(change => change.type === 'remove');
                for (const edge of deletedEdges) {
                  try {
                    const parts = edge.id.split('-');
                    const sourceType = parts[1];
                    const sourceId = parts[2];
                    const targetType = parts[3];
                    const targetId = parts[4];

                    const sourceLabel = sourceType === 'paper' ? 'Paper' :
                                      sourceType === 'topic' ? 'Topic' :
                                      sourceType === 'central-topic' ? 'CentralTopic' :
                                      sourceType === 'ref' ? 'ReferencedText' : null;

                    const targetLabel = targetType === 'paper' ? 'Paper' :
                                      targetType === 'topic' ? 'Topic' :
                                      targetType === 'central-topic' ? 'CentralTopic' :
                                      targetType === 'ref' ? 'ReferencedText' : null;

                    if (sourceLabel && targetLabel) {
                      await executeQuery(
                        `
                        MATCH (source:${sourceLabel})-[r]-(target:${targetLabel})
                        WHERE ID(source) = $sourceId AND ID(target) = $targetId
                        DELETE r
                        `,
                        { sourceId: parseInt(sourceId), targetId: parseInt(targetId) }
                      );
                    }
                  } catch (error) {
                    console.error('Error deleting edge in Neo4j:', error);
                  }
                }
                setEdges((eds) => applyEdgeChanges(changes, eds));
              }}
              onConnect={async (params) => {
                try {
                  const sourceNode = nodes.find(n => n.id === params.source);
                  const targetNode = nodes.find(n => n.id === params.target);

                  console.log('[onConnect] PARAMS:', JSON.stringify(params, null, 2));
                  console.log('[onConnect] sourceNode:', JSON.stringify(sourceNode, null, 2));
                  console.log('[onConnect] targetNode:', JSON.stringify(targetNode, null, 2));

                  if (!sourceNode || !targetNode) {
                    console.error('Source or target node not found');
                    return;
                  }

                  const sourceParts = params.source.split('-');
                  const sourceId = sourceParts[sourceParts.length - 1];
                  const sourceType = sourceParts.slice(0, -1).join('-');

                  const targetParts = params.target.split('-');
                  const targetId = targetParts[targetParts.length - 1];
                  const targetType = targetParts.slice(0, -1).join('-');

                  console.log('Connection attempt:', { sourceType, sourceId, targetType, targetId });

                  if (sourceNode.type === 'referenceNode') {
                    alert('Invalid connection: References cannot be source nodes');
                    return;
                  }

                  let relationshipType = 'RELATES_TO';
                  let sourceLabel = '';
                  let targetLabel = '';
                  console.log('[onConnect] Initial check: sourceNode.type:', sourceNode.type, 'targetNode.type:', targetNode.type);

                  // Determine relationship type and labels based on node types
                  if (sourceNode.type === 'centralTopicNode' && targetNode.type === 'topicNode') {
                    relationshipType = 'HAS_TOPIC';
                    sourceLabel = 'CentralTopic';
                    targetLabel = 'Topic';
                    console.log('[onConnect] Determined labels and type (centralTopicNode -> topicNode):', { sourceLabel, targetLabel, relationshipType });
                  } else if (sourceNode.type === 'topicNode' && targetNode.type === 'topicNode') {
                    relationshipType = 'HAS_TOPIC';
                    sourceLabel = 'Topic';
                    targetLabel = 'Topic';
                    console.log('[onConnect] Determined labels and type (topicNode -> topicNode):', { sourceLabel, targetLabel, relationshipType });
                  } else if (sourceNode.type === 'topicNode' && targetNode.type === 'paragraphNode') {
                    relationshipType = 'HAS_PARAGRAPH';
                    sourceLabel = 'Topic';
                    targetLabel = 'Paragraph';
                    console.log('[onConnect] Determined labels and type (topicNode -> paragraphNode):', { sourceLabel, targetLabel, relationshipType });
                  } else if (sourceNode.type === 'paragraphNode' && targetNode.type === 'referenceNode') {
                    relationshipType = 'CITES';
                    sourceLabel = 'Paragraph';
                    targetLabel = 'ReferencedText';
                    console.log('[onConnect] Determined labels and type (paragraphNode -> referenceNode):', { sourceLabel, targetLabel, relationshipType });
                  } else if ((sourceNode.type === 'centralTopicNode' || sourceNode.type === 'paperNode' || sourceNode.type === 'topicNode') && targetNode.type === 'referenceNode') {
                     relationshipType = 'HAS_REFERENCE';
                     sourceLabel = sourceNode.type === 'centralTopicNode' ? 'CentralTopic' : sourceNode.type === 'paperNode' ? 'Paper' : 'Topic';
                     targetLabel = 'ReferencedText';
                     console.log('[onConnect] Determined labels and type (various -> referenceNode):', { sourceLabel, targetLabel, relationshipType });
                  }
                   // Add other specific connection types as needed

                  if (!sourceLabel || !targetLabel) {
                     console.error('[onConnect] UNHANDLED CONNECTION:', { sourceNodeType: sourceNode.type, targetNodeType: targetNode.type });
                     console.warn(`Unhandled connection type: ${sourceNode.type} -> ${targetNode.type}`);
                     alert(`Cannot create connection between ${sourceNode.type} and ${targetNode.type}`);
                     return;
                  }


                  console.log('Creating connection:', {
                    source: { type: sourceNode.type, id: sourceId, label: sourceLabel },
                    target: { type: targetNode.type, id: targetId, label: targetLabel },
                    relationshipType: relationshipType
                  });

                  // Create relationship in Neo4j (simplified query)
                  const query = `
                    MATCH (source:${sourceLabel})
                    WHERE ID(source) = $sourceId
                    MATCH (target:${targetLabel})
                    WHERE ID(target) = $targetId
                    MERGE (source)-[r:${relationshipType}]->(target)
                    RETURN type(r) as createdRelationshipType
                  `;
                  console.log('[onConnect] Neo4j Query:', query);
                  console.log('[onConnect] Neo4j Params:', JSON.stringify({ sourceId: parseInt(sourceId), targetId: parseInt(targetId) }, null, 2));

                  const result = await executeQuery(query, {
                    sourceId: parseInt(sourceId),
                    targetId: parseInt(targetId)
                  });

                  console.log('[onConnect] Neo4j Result:', JSON.stringify(result, null, 2));

                  // Add visual edge
                  const newEdge = {
                    id: `edge-${sourceType}-${sourceId}-${targetType}-${targetId}-${relationshipType}-${Date.now()}-${Math.random()}`,
                    source: params.source,
                    target: params.target,
                    type: (relationshipType === 'CITES') ? 'simpleFloatingEdge' : 'floating',
                    label: relationshipType,
                    animated: true,
                    markerEnd: { type: MarkerType.ArrowClosed },
                  };

                  console.log('[onConnect] Adding visual edge:', JSON.stringify(newEdge, null, 2));

                  const finalEdges = addEdge(newEdge, edges);
                  setEdges(finalEdges);

                  // Recalculate display numbers after adding edge
                  // The calculateDisplayNumbers function handles siblingOrder based on the graph structure
                  setNodes(prevNodes => calculateDisplayNumbers(prevNodes, finalEdges));


                } catch (error) {
                  console.error('Error creating connection:', error);
                  alert('Failed to create connection. Please try again.');
                }
              }}
              onNodeContextMenu={onNodeContextMenu}
              onConnectStart={(_, { nodeId }) => {
                const el = document.querySelector(`[data-id="${nodeId}"]`);
                if (el) el.classList.add('connecting');
              }}
              onConnectEnd={() => {
                document.querySelectorAll('.connecting').forEach(el => {
                  el.classList.remove('connecting');
                });
              }}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </div>
      </div>

      {/* Edit Node Modal */}
      {editNode && (
        <EditNodeModal
          node={editNode}
          isOpen={true}
          onClose={() => setEditNode(null)}
          onSave={handleUpdateNode}
        />
      )}

      {/* New Topic Popup */}
      {showTopicPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">
              {parentForNewTopic ? 'Create Sub-Topic' : 'Create New Topic (Orphan)'}
            </h3>
            <input
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="Enter topic name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowTopicPopup(false);
                  setNewTopicName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newTopicName.trim()) {
                    alert('Please enter a topic name');
                    return;
                  }
                  if (parentForNewTopic) {
                    await handleCreateTopicNode(parentForNewTopic, newTopicName.trim());
                  } else {
                    await handleCreateTopicNode(null, newTopicName.trim());
                  }
                  setShowTopicPopup(false);
                  setNewTopicName('');
                  setParentForNewTopic(null); 
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Node Modal */}
      {editNode && (
        <EditNodeModal
          node={editNode}
          isOpen={true}
          onClose={() => setEditNode(null)}
          onSave={handleUpdateNode}
        />
      )}

      {/* New Central Topic Popup */}
      {showCentralTopicPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Create New Central Topic</h3>
            <input
              type="text"
              value={newCentralTopicName}
              onChange={(e) => setNewCentralTopicName(e.target.value)}
              placeholder="Enter central topic name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-orange-500"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCentralTopicPopup(false);
                  setNewCentralTopicName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCentralTopic}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Paragraph Popup */}
      {showParagraphPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">
              {parentForNewParagraph ? 'Create Sub-Paragraph' : 'Create New Paragraph (Orphan)'}
            </h3>
            <textarea
              value={newParagraphStatement}
              onChange={(e) => setNewParagraphStatement(e.target.value)}
              placeholder="Enter paragraph statement"
              className="w-full p-2 border border-gray-300 rounded mb-4"
              rows="3"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowParagraphPopup(false);
                  setNewParagraphStatement('');
                  setParentForNewParagraph(null); 
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newParagraphStatement.trim()) {
                    alert('Please enter a paragraph statement');
                    return;
                  }
                  await handleCreateParagraphNode(parentForNewParagraph, newParagraphStatement.trim());
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
