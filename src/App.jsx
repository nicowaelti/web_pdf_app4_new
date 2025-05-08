import React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import EditNodeModal from './components/EditNodeModal';
import { initializeDriver, executeQuery, closeDriver } from './utils/neo4jConnection';

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

const TopicNode = React.memo(({ data }) => {
  // Log to see exactly what TopicNode receives
  // The 'id' prop is passed directly by React Flow, not typically in data for custom nodes unless specifically put there.
  // For logging, we'll try to access a known unique property from data if available, or just log what's in data.
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

// Define nodeTypes outside component to prevent unnecessary recreation
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

const nodeTypes = {
  referenceNode: ReferenceNode,
  paperNode: PaperNode,
  topicNode: TopicNode,
  centralTopicNode: CentralTopicNode,
  custom: CustomNode
};

const edgeTypes = {
  floating: SimpleFloatingEdge
};

// Function to calculate display numbers for Topic nodes
const calculateDisplayNumbers = (nodes, edges) => {
  // Initialize all nodes without display numbers
  const nodeMap = new Map(nodes.map(n => [n.id, {
    ...n,
    data: {
      ...n.data,
      displayNumber: undefined  // Clear any existing display numbers
    },
    children: []
  }]));
  const centralTopic = nodes.find(n => n.type === 'centralTopicNode');

  if (!centralTopic) return nodes; // No central topic, nothing to number

  // Build adjacency list only for actual HAS_TOPIC relationships
  edges.forEach(edge => {
    if (edge.type === 'floating' || edge.label === 'HAS_TOPIC') {
      const parentNode = nodeMap.get(edge.source);
      const childNode = nodeMap.get(edge.target);
      // Only build parent-child relationship for valid connections
      if (parentNode && childNode &&
          (parentNode.type === 'centralTopicNode' || parentNode.type === 'topicNode') &&
          childNode.type === 'topicNode') {
        // Add to children array only if it has a valid siblingOrder
        if (childNode.data.siblingOrder !== undefined) {
          parentNode.children.push(childNode);
        }
      }
    }
  });

  const recursivelyAssignNumbers = (parentId, parentDisplayNumber) => {
    const parentNode = nodeMap.get(parentId);
    if (!parentNode || !parentNode.children) return;

    // Sort children by siblingOrder
    const sortedChildren = parentNode.children
      .filter(child => child.type === 'topicNode' && child.data.siblingOrder !== undefined)
      .sort((a, b) => a.data.siblingOrder - b.data.siblingOrder);

    sortedChildren.forEach((child) => {
      // The actual siblingOrder from data should be used for numbering, not the loop index directly
      // but for display, we use its sorted position.
      // The plan is to use siblingOrder directly for the number part.
      const currentNumber = child.data.siblingOrder;
      // Log inputs to calculation
      console.log(`[recursivelyAssignNumbers] Calculating for ${child.id}: parentDisplayNumber=${parentDisplayNumber}, currentNumber=${currentNumber}`);
      const displayNumber = parentDisplayNumber !== '' ? `${parentDisplayNumber}${currentNumber}.` : `${currentNumber}.`; // Check parentDisplayNumber explicitly for empty string

      const originalChildNode = nodeMap.get(child.id);
      if (originalChildNode) {
        // Ensure we're creating a new data object for the update
        originalChildNode.data = {
          ...originalChildNode.data,
          displayNumber: displayNumber
        };
        // Log right after assignment
        console.log(`[recursivelyAssignNumbers] Assigned to ${originalChildNode.id}: displayNumber=${displayNumber}, SiblingOrder=${originalChildNode.data.siblingOrder}, FullData=${JSON.stringify(originalChildNode.data)}`);
        
        // The nodeMap holds the reference, so this update to originalChildNode.data should be reflected
        // when Array.from(nodeMap.values()) is called.
        recursivelyAssignNumbers(child.id, displayNumber);
      }
    });
  };

  recursivelyAssignNumbers(centralTopic.id, ''); // Start recursion from CentralTopic

  const resultNodes = Array.from(nodeMap.values());
  console.log('[calculateDisplayNumbers] Resulting nodes:', JSON.stringify(resultNodes.map(n => ({id: n.id, label: n.data.label, displayNumber: n.data.displayNumber, siblingOrder: n.data.siblingOrder }))));
  return resultNodes;
};

// Initial states
const initialNodes = [];
const initialEdges = [];

function App() {
  // Basic state for node management
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);

  // UI state
  const [showImportantPapers, setShowImportantPapers] = useState(false);
  const [dbStatus, setDbStatus] = useState('connecting');
  const [currentPaperId, setCurrentPaperId] = useState(null);
  const [currentPaperTitle, setCurrentPaperTitle] = useState('');
  const [editNode, setEditNode] = useState(null);
  const [showTopicPopup, setShowTopicPopup] = useState(false); // This will now be for adding sub-topics
  const [showCentralTopicPopup, setShowCentralTopicPopup] = useState(false);
  const [newTopicName, setNewTopicName] = useState(''); // For general new topics / sub-topics
  const [newCentralTopicName, setNewCentralTopicName] = useState('');
  const [parentForNewTopic, setParentForNewTopic] = useState(null); // To store parent when creating a sub-topic

  // Workspace state
  const [isDragging, setIsDragging] = useState(false);
  const [leftWidth, setLeftWidth] = useState(50);
  const [pdfContent, setPdfContent] = useState({ pages: [] });

  const handleUpdateNode = async (formData) => {
    try {
      const nodeId = editNode.id.split('-')[1];
      const nodeType = editNode.type.replace('Node', '');
      
      // Update in Neo4j based on node type
      const label = nodeType === 'paper' ? 'Paper' :
                   nodeType === 'topic' ? 'Topic' :
                   nodeType === 'central-topic' ? 'CentralTopic' :
                   nodeType === 'reference' ? 'ReferencedText' : null;

      if (!label) {
        throw new Error('Invalid node type');
      }

      const oldSiblingOrder = editNode?.data?.siblingOrder;
      const newSiblingOrder = parseInt(formData.siblingOrder || 1);

      if (nodeType === 'topic' && oldSiblingOrder !== undefined && oldSiblingOrder !== newSiblingOrder) {
        // Find parent node ID (Neo4j ID)
        let parentNeo4jId = null;
        const parentEdge = edges.find(edge => edge.target === editNode.id && (edge.label === 'HAS_TOPIC' || edge.type === 'floating')); // Assuming HAS_TOPIC edges
        if (parentEdge) {
          const parentIdParts = parentEdge.source.split('-');
          parentNeo4jId = parseInt(parentIdParts[parentIdParts.length - 1]);
        }

        if (parentNeo4jId !== null) {
          console.log(`Reordering topic ${nodeId}: from ${oldSiblingOrder} to ${newSiblingOrder}, parent ${parentNeo4jId}`);
          // IMPORTANT: This query reorders siblings.
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
            // Also update the name of the moved node as it might have changed too
            WITH movedNode, $label AS nodeName
            SET movedNode.name = nodeName`,
            {
              parentNeo4jId: parentNeo4jId,
              movedNodeId: parseInt(nodeId),
              oldSiblingOrder: oldSiblingOrder,
              newSiblingOrder: newSiblingOrder,
              label: formData.label // Pass label for name update
            }
          );

          // Re-fetch the parent and its children to get updated siblingOrder for all
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
              // Create a map of DB children for efficient lookup
              const dbChildrenMap = new Map();
              childrenDataFromDb.forEach(childDbRaw => {
                dbChildrenMap.set(`topic-${safeConvertNeoInt(childDbRaw.id)}`, {
                  name: childDbRaw.name,
                  siblingOrder: safeConvertNeoInt(childDbRaw.siblingOrder),
                  // positionX: safeConvertNeoInt(childDbRaw.positionX, 0), // Example if positions are managed
                  // positionY: safeConvertNeoInt(childDbRaw.positionY, 0), // Example
                });
              });

              return prevNodes.map(n => {
                const dbChildData = dbChildrenMap.get(n.id);
                if (dbChildData) { // This node is one of the children of the parent
                  const isMovedNode = n.id === editNode.id;
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      label: isMovedNode ? formData.label : dbChildData.name, // Prioritize formData label for moved node
                      siblingOrder: dbChildData.siblingOrder, // Authoritative from DB after reorder
                      // Apply other formData fields if it's the moved node and a topic
                      ...(isMovedNode && nodeType === 'topic' && {
                        // other topic-specific fields from formData if any, besides label/siblingOrder
                      }),
                      // Common fields from formData if it's the moved node (for other types, though less likely here)
                      ...(isMovedNode && nodeType === 'referenceNode' && { fullText: formData.fullText }),
                      ...(isMovedNode && nodeType === 'paperNode' && {
                        importance: parseInt(formData.importance || 0),
                        notes: formData.notes || ''
                      }),
                    }
                  };
                }
                // If it's the edited node but NOT part of the fetched children (e.g. reparented, though not this operation)
                // or if re-fetch failed and this is the fallback path, update from formData.
                // This specific block is now covered by the `else` for re-fetch failure.
                // However, if a node IS the editNode.id but NOT a child of parentNeo4jId, it means something else.
                // For this reorder logic, we assume editNode.id IS a child of parentNeo4jId.
                return n;
              });
            });
          } else {
            // Re-fetch failed, fall back to updating only the edited node with formData
            console.warn('Re-fetch of affected siblings failed after reorder. Updating only the moved node on client from formData.');
            setNodes(prevNodes =>
              prevNodes.map(node => {
                if (node.id === editNode.id) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      label: formData.label,
                      ...(nodeType === 'referenceNode' && { fullText: formData.fullText }),
                      ...(nodeType === 'paperNode' && {
                        importance: parseInt(formData.importance || 0),
                        notes: formData.notes || ''
                      }),
                      ...(nodeType === 'topic' && { siblingOrder: newSiblingOrder })
                    }
                  };
                }
                return node;
              })
            );
          }
        } else { // parentNeo4jId is null (topic reorder but parent not found client-side)
          console.warn(`Could not find parent for topic ${editNode.id} to reorder siblings.`);
          // Fallback to simple DB update for the single node
          await executeQuery(
            `MATCH (n:Topic) WHERE ID(n) = $nodeId
            SET n.name = $label, n.siblingOrder = $siblingOrder`,
            { nodeId: parseInt(nodeId), label: formData.label, siblingOrder: newSiblingOrder }
          );
          // Client-side update for the single node from formData
          setNodes(prevNodes =>
            prevNodes.map(node => {
              if (node.id === editNode.id) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    label: formData.label,
                    ...(nodeType === 'topic' && { siblingOrder: newSiblingOrder })
                  }
                };
              }
              return node;
            })
          );
        }
      } else { // Not a topic reorder OR siblingOrder didn't change for a topic
        // Standard DB update for non-topic nodes or if siblingOrder hasn't changed for a topic
        let updateQuery = `
          MATCH (n:${label})
          WHERE ID(n) = $nodeId
          SET n.name = $label`;
        const queryParams = {
          nodeId: parseInt(nodeId),
          label: formData.label,
        };

        if (nodeType === 'reference') {
          updateQuery += ', n.text = $fullText';
          queryParams.fullText = formData.fullText;
        } else if (nodeType === 'paper') {
          updateQuery += ', n.importance = $importance, n.notes = $notes';
          queryParams.importance = parseInt(formData.importance || 0);
          queryParams.notes = formData.notes || '';
        } else if (nodeType === 'topic') {
          // This case implies oldSiblingOrder === newSiblingOrder for a topic
          if (oldSiblingOrder === newSiblingOrder) {
             updateQuery += ', n.siblingOrder = $siblingOrder';
             queryParams.siblingOrder = newSiblingOrder; // or oldSiblingOrder, they are the same
          }
        }
        await executeQuery(updateQuery, queryParams);
        // Client-side update for the single edited node from formData
        setNodes(prevNodes =>
          prevNodes.map(node => {
            if (node.id === editNode.id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  label: formData.label,
                  ...(nodeType === 'referenceNode' && { fullText: formData.fullText }),
                  ...(nodeType === 'paperNode' && {
                    importance: parseInt(formData.importance || 0),
                    notes: formData.notes || ''
                  }),
                  // Update siblingOrder from formData if it's a topic (even if unchanged, for consistency)
                  ...(nodeType === 'topic' && { siblingOrder: newSiblingOrder })
                }
              };
            }
            return node;
          })
        );
      }
      
      // Recalculate display numbers after any node update path
      setNodes(currentNodes => calculateDisplayNumbers(currentNodes, edges));
      setEditNode(null);
    } catch (error) {
      console.error('Error updating node:', error);
      alert('Failed to update node');
    }
  };

  const handleCreateCentralTopic = async () => {
    if (!newCentralTopicName.trim()) return;

    try {
      const result = await executeQuery(
        `
        CREATE (ct:CentralTopic {
          name: $name,
          positionX: $positionX,
          positionY: $positionY,
          createdAt: datetime()
        })
        RETURN ID(ct) as topicId
        `,
        {
          name: newCentralTopicName,
          positionX: getRandomPosition().x,
          positionY: getRandomPosition().y
        }
      );

      const topicId = result[0].get('topicId').toNumber();
      const newNode = {
        id: `central-topic-${topicId}`,
        type: 'centralTopicNode',
        position: { x: getRandomPosition().x, y: getRandomPosition().y },
        data: {
          label: newCentralTopicName,
          onRename: async (newName) => {
            try {
              await executeQuery(
                `
                MATCH (ct:CentralTopic)
                WHERE ID(ct) = $topicId
                SET ct.name = $newName
                `, // End of query template literal
                { topicId, newName } // parameters for executeQuery
              ); // end executeQuery
              setNodes(prev => // start setNodes
                prev.map(node => // start map
                  node.id === `central-topic-${safeConvertNeoInt(topicId)}`
                    ? { ...node, data: { ...node.data, label: newName } }
                    : node
                ) // end map
              ); // end setNodes
            } catch (error) { // catch for onRename
              console.error('Error renaming central topic:', error);
              alert('Failed to rename central topic');
            } // end catch for onRename
          } // Close onRename function
        } // Close data object
      }; // Close newNode object

      setNodes(prev => [...prev, newNode]); // Add the new central topic node
      setNewCentralTopicName('');
      setShowCentralTopicPopup(false);
    } catch (error) { // Catch for handleCreateCentralTopic's try
      console.error('Error creating central topic:', error);
      alert('Failed to create central topic');
    } // end catch for handleCreateCentralTopic
  }; // Close handleCreateCentralTopic function

// Correctly starting handleDeleteNode after closing handleCreateCentralTopic
const handleDeleteNode = async (nodeToDelete) => {
    if (!nodeToDelete) return;

    const nodeId = nodeToDelete.id.split('-')[1];
    const nodeType = nodeToDelete.type.replace('Node', '');
    const label = nodeType === 'paper' ? 'Paper' :
                  nodeType === 'topic' ? 'Topic' :
                  nodeType === 'central-topic' ? 'CentralTopic' :
                  nodeType === 'reference' ? 'ReferencedText' : null;

    if (!label) {
      console.error('Cannot delete node with unknown label:', nodeType);
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete this ${nodeType}?`);
    if (!confirmDelete) return;

    try {
      if (label === 'Topic') {
        // Special handling for Topics to reorder siblings
        const oldSiblingOrder = nodeToDelete.data.siblingOrder;
        let parentNeo4jId = null;
        const parentEdge = edges.find(edge => edge.target === nodeToDelete.id && (edge.label === 'HAS_TOPIC' || edge.type === 'floating'));
        if (parentEdge) {
          const parentIdParts = parentEdge.source.split('-');
          parentNeo4jId = parseInt(parentIdParts[parentIdParts.length - 1]);
        }

        if (parentNeo4jId !== null && oldSiblingOrder !== undefined) {
          console.log(`Deleting topic ${nodeId} (order ${oldSiblingOrder}) from parent ${parentNeo4jId}`);
          // Query to decrement siblingOrder for subsequent siblings and delete the node
          await executeQuery(
            `
            MATCH (parent) WHERE ID(parent) = $parentNeo4jId
            MATCH (parent)-[rel:HAS_TOPIC]->(target:Topic) WHERE ID(target) = $targetId
            
            // Find siblings that need their order decremented
            MATCH (parent)-[:HAS_TOPIC]->(sibling:Topic)
            WHERE sibling.siblingOrder > $oldSiblingOrder
            
            // Decrement order for those siblings
            SET sibling.siblingOrder = sibling.siblingOrder - 1
            
            // Detach and delete the target node
            WITH target, rel
            DETACH DELETE target
            `, 
            // Note: Deleting the relationship 'rel' is implicitly handled by DETACH DELETE target
            {
              parentNeo4jId: parentNeo4jId,
              targetId: parseInt(nodeId),
              oldSiblingOrder: oldSiblingOrder
            }
          );
        } else {
          // Fallback or orphan topic deletion (no reordering needed)
          console.log(`Deleting orphan topic ${nodeId} or parent not found.`);
          await executeQuery(
            `MATCH (n:Topic) WHERE ID(n) = $targetId DETACH DELETE n`,
            { targetId: parseInt(nodeId) }
          );
        }
      } else {
        // Generic deletion for other node types
        console.log(`Deleting ${label} node ${nodeId}`);
        await executeQuery(
          `MATCH (n:${label}) WHERE ID(n) = $targetId DETACH DELETE n`,
          { targetId: parseInt(nodeId) }
        );
      }

      // Update client state: remove node and connected edges
      setNodes(nds => nds.filter(n => n.id !== nodeToDelete.id));
      setEdges(eds => eds.filter(e => e.source !== nodeToDelete.id && e.target !== nodeToDelete.id));
      
      // Recalculate display numbers after deletion might affect siblings
      // Need to ensure the nodes passed here reflect the deletion
      setNodes(currentNodes => calculateDisplayNumbers(currentNodes.filter(n => n.id !== nodeToDelete.id), edges.filter(e => e.source !== nodeToDelete.id && e.target !== nodeToDelete.id)));

    } catch (error) {
      console.error(`Error deleting ${nodeType}:`, error);
      alert(`Failed to delete ${nodeType}.`);
    }
  };

  const handleCreateTopicNode = async (parentId, topicName) => {
    if (!topicName.trim()) {
      alert('Topic name is required.');
      return;
    }

    // Allow orphan topics
    if (!parentId) {
      console.log('Creating orphan topic...');
    }

    let position = getRandomPosition();
    let query;
    let params;

    try {
      if (parentId) {
        // Creating a child topic
        const parentIdParts = parentId.split('-');
        const parentNeo4jId = parseInt(parentIdParts[parentIdParts.length - 1]);
        const parentLabel = parentIdParts[0] === 'central' ? 'CentralTopic' : 'Topic';

        query = `
          MATCH (p:${parentLabel}) WHERE ID(p) = $parentNeo4jId
          OPTIONAL MATCH (p)-[:HAS_TOPIC]->(existingChild:Topic)
          WITH p, COUNT(existingChild) AS siblingCount
          CREATE (newTopic:Topic {
            name: $topicName,
            siblingOrder: siblingCount + 1,
            positionX: p.positionX + rand()*100 - 50,
            positionY: p.positionY + 100 + rand()*50,
            createdAt: datetime()
          })
          CREATE (p)-[r:HAS_TOPIC]->(newTopic)
          RETURN ID(newTopic) AS newTopicId, newTopic.siblingOrder AS newSiblingOrder, newTopic.positionX AS posX, newTopic.positionY AS posY`;
        params = { parentNeo4jId, topicName };
      } else {
        // Creating an orphan topic without sibling order
        query = `
          CREATE (newTopic:Topic {
            name: $topicName,
            positionX: $positionX,
            positionY: $positionY,
            createdAt: datetime()
          })
          RETURN ID(newTopic) AS newTopicId, null AS newSiblingOrder, newTopic.positionX AS posX, newTopic.positionY AS posY`;
        params = {
          topicName,
          positionX: position.x,
          positionY: position.y
        };
      }

      const result = await executeQuery(query, params);

      if (!result || result.length === 0) {
        throw new Error('Topic creation did not return expected result');
      }

      const newTopicRecord = result[0];
      const newTopicId = newTopicRecord.get('newTopicId').toNumber();
      const newSiblingOrder = newTopicRecord.get('newSiblingOrder')?.toNumber();
      const newPosition = {
        x: safeConvertNeoInt(newTopicRecord.get('posX'), position.x),
        y: safeConvertNeoInt(newTopicRecord.get('posY'), position.y)
      };

      const newNode = {
        id: `topic-${newTopicId}`,
        type: 'topicNode',
        position: newPosition,
        data: {
          label: topicName,
          siblingOrder: newSiblingOrder,
          onRename: async (newName) => {
            try {
              await executeQuery(
                `MATCH (t:Topic) WHERE ID(t) = $topicId SET t.name = $newName`,
                { topicId: newTopicId, newName }
              );
              setNodes(prev => prev.map(node =>
                node.id === `topic-${newTopicId}`
                  ? { ...node, data: { ...node.data, label: newName } }
                  : node
              ));
            } catch (error) {
              console.error('Error renaming topic:', error);
              alert('Failed to rename topic');
            }
          }
        }
      };

      setNodes(prev => [...prev, newNode]);

      // Only create edge and recalculate numbers for child topics
     if (parentId) {
       const newEdge = {
         id: `e-${parentId}-${newNode.id}`,
         source: parentId,
         target: newNode.id,
         type: 'floating'
       };
       
       // Batch update edges and nodes together
       const updatedEdges = [...edges, newEdge];
       setEdges(updatedEdges);
       setNodes(currentNodes => calculateDisplayNumbers(
         currentNodes,
         updatedEdges
       ));
     }

     // Clear UI state
     setNewTopicName('');
     setShowTopicPopup(false);
     setParentForNewTopic(null);

   } catch (error) {
     console.error('Error creating topic node:', error);
     alert(`Failed to create topic node: ${error.message}`);
   }
 };

 const onNodeContextMenu = useCallback((event, node) => {
   event.preventDefault();
   if (node.type === 'topicNode' || node.type === 'centralTopicNode') {
     // For simplicity, we'll reuse the existing newTopicName state and showTopicPopup
     // We set the parent for the new topic.
     setParentForNewTopic(node.id);
     setShowTopicPopup(true);
     // If we had a dedicated actual context menu UI, we would set its properties here.
     // For now, we directly show the modal.
   }
   // Add delete option for deletable nodes
   else if (node.type === 'topicNode' || node.type === 'paperNode') { // Example: Allow delete for Topic and Paper nodes
     // TODO: Implement a proper context menu UI instead of just confirm/alert
         handleDeleteNode(node); // Directly call delete for now
      }
      // Add other context menu options here if needed
    },
    [setParentForNewTopic, setShowTopicPopup, handleDeleteNode] // Added handleDeleteNode dependency
  );

  // Initialize Neo4j connection
  useEffect(() => {
    const initAndLoadData = async () => {
      try {
        console.log('Initializing Neo4j connection...');
        await initializeDriver();
        console.log('Successfully connected to Neo4j');
        
        console.log('Loading central topics...');
        setDbStatus('connected');
        
        // Load all central topics and their connections
        const centralTopics = await executeQuery(`
          MATCH (ct:CentralTopic)
          OPTIONAL MATCH (ct)-[r:HAS_TOPIC|HAS_REFERENCE]-(other)
          RETURN
            ID(ct) as topicId,
            ct.name as name,
            toFloat(ct.positionX) as positionX,
            toFloat(ct.positionY) as positionY,
            COLLECT(DISTINCT {
              otherId: ID(other),
              otherType: CASE
                WHEN other:Topic THEN 'topic'
                WHEN other:Paper THEN 'paper'
                WHEN other:CentralTopic THEN 'central-topic'
              END,
              isOutgoing: startNode(r) = ct
            }) as connections
        `);

        const centralTopicNodes = centralTopics.map(topic => {
          const defaultPos = getRandomPosition();
          const position = safeGetPosition(topic, defaultPos);
          const idValue = safeConvertNeoInt(topic.get('topicId'));
          return {
            id: `central-topic-${idValue}`,
            type: 'centralTopicNode',
            position,
            data: {
              label: topic.get('name') || '',
              onRename: async (newName) => {
                const nodeId = idValue; // Capture the ID in closure
                try {
                  await executeQuery(
                    `
                    MATCH (ct:CentralTopic)
                    WHERE ID(ct) = $topicId
                    SET ct.name = $newName
                    `,
                    { topicId: nodeId, newName }
                  );
                  setNodes(prev =>
                    prev.map(node =>
                      node.id === `central-topic-${nodeId}`
                        ? { ...node, data: { ...node.data, label: newName } }
                        : node
                    )
                  );
                } catch (error) {
                  console.error('Error renaming central topic:', error);
                  alert('Failed to rename central topic');
                }
              }
            }
          };
        });
        
        console.log('Central topics loaded:', centralTopicNodes);

        console.log('Loading papers...');
        // Load all papers and their references
        const papers = await executeQuery(`
          MATCH (p:Paper)
          RETURN
            ID(p) as paperId,
            p.title as title,
            toFloat(p.positionX) as positionX,
            toFloat(p.positionY) as positionY,
            p.importance as importance,
            p.notes as notes
        `);
        
        // Load papers with their positions
        const paperNodes = papers.map(paper => {
          const defaultPos = getRandomPosition();
          const position = safeGetPosition(paper, defaultPos);
          const importance = paper.get('importance');
          // Handle importance value which might be a number or Neo4j Integer
          const importanceValue = importance ?
            (typeof importance.toNumber === 'function' ? importance.toNumber() : Number(importance)) : 0;
          
          const idValue = safeConvertNeoInt(paper.get('paperId'));

          return {
            id: `paper-${idValue}`,
            type: 'paperNode',
            position: position,
            data: {
              label: paper.get('title'),
              importance: importanceValue,
              notes: paper.get('notes') || ''
            }
          };
        });

      console.log('Papers loaded:', paperNodes);
      console.log('Loading topics...');

        // Load all topics and their connections
        const topics = await executeQuery(`
          MATCH (t:Topic)
          OPTIONAL MATCH (t)-[r:HAS_TOPIC|HAS_REFERENCE]-(other)
          RETURN
            ID(t) as topicId,
            t.name as name,
            t.siblingOrder as siblingOrder,
            toFloat(t.positionX) as positionX,
            toFloat(t.positionY) as positionY,
            COLLECT(DISTINCT {
              otherId: ID(other),
              otherType: CASE
                WHEN other:Topic THEN 'topic'
                WHEN other:Paper THEN 'paper'
                WHEN other:CentralTopic THEN 'central-topic'
              END,
              isOutgoing: startNode(r) = t
            }) as connections
        `);

        const topicNodes = topics.map(topic => {
          const defaultPos = getRandomPosition();
          const position = safeGetPosition(topic, defaultPos);
          return {
            id: `topic-${safeConvertNeoInt(topic.get('topicId'))}`,
            type: 'topicNode',
            position: position,
            data: {
              label: topic.get('name') || '',
              siblingOrder: safeConvertNeoInt(topic.get('siblingOrder'), 1)
            }
          };
        });

      console.log('Topics loaded:', topicNodes);
      console.log('Loading references...');

        // Load all connections
        const centralConnections = await executeQuery(`
          MATCH (ct:CentralTopic)-[r]-(n)
          WHERE type(r) IN ['HAS_TOPIC', 'HAS_REFERENCE']
          RETURN
            ID(ct) as ctId,
            ID(n) as otherId,
            type(r) as relationType,
            startNode(r) = ct as isOutgoing,
            labels(n) as nodeLabels,
            CASE
              WHEN n:Paper THEN 'paper'
              WHEN n:Topic THEN 'topic'
              WHEN n:CentralTopic THEN 'central-topic'
              WHEN n:ReferencedText THEN 'ref'
            END as otherType
        `);

        const centralEdges = centralConnections.map(conn => {
          const ctId = conn.get('ctId').toNumber();
          const otherId = conn.get('otherId').toNumber();
          const otherType = conn.get('otherType');
          const isOutgoing = conn.get('isOutgoing');
          const relationType = conn.get('relationType');
          
          // Get the correct source and target based on the relationship direction
          let source = isOutgoing ? `central-topic-${ctId}` : `${otherType}-${otherId}`;
          let target = isOutgoing ? `${otherType}-${otherId}` : `central-topic-${ctId}`;

          // Log edge creation for debugging
          console.log('Creating edge:', { source, target, relationType, isOutgoing });
          
          return {
            id: `edge-${source}-${target}-${Date.now()}-${Math.random()}`,
            source,
            target,
            type: 'default',
            animated: true
          };
        });

        // Load remaining references and their connections
        const references = await executeQuery(`
          MATCH (source)-[rel:HAS_REFERENCE]->(r:ReferencedText)
          WHERE source:Paper OR source:Topic
          RETURN
            CASE WHEN source:Paper THEN 'paper' ELSE 'topic' END as sourceType,
            ID(source) as sourceId,
            ID(r) as refId,
            r.text as text,
            toFloat(r.positionX) as positionX,
            toFloat(r.positionY) as positionY
        `);

        const referenceNodes = references.map(ref => {
          const position = {
            x: typeof ref.get('positionX') === 'number' ? ref.get('positionX') : getRandomPosition().x,
            y: typeof ref.get('positionY') === 'number' ? ref.get('positionY') : getRandomPosition().y
          };
          return {
            id: `ref-${ref.get('refId').toNumber()}`,
            type: 'referenceNode',
            position: position,
            data: {
              label: ref.get('text').substring(0, 30) + (ref.get('text').length > 30 ? '...' : ''),
              fullText: ref.get('text')
            }
          };
        });
      console.log('References loaded:', referenceNodes);

        const referenceEdges = references.map(ref => {
          const sourceType = ref.get('sourceType');
          const sourceId = ref.get('sourceId').toNumber();
          const refId = ref.get('refId').toNumber();
          return {
            id: `edge-${sourceType}-${sourceId}-ref-${refId}-${Date.now()}-${Math.random()}`,
            source: `${sourceType}-${sourceId}`,
            target: `ref-${refId}`,
            type: 'default',
            animated: true
          };
        });

        // Create edges from topic and central topic connections
        const topicConnections = [];
        
        // Process central topic connections
        centralTopics.forEach(ct => {
          const connections = ct.get('connections');
          connections.forEach(conn => {
            if (conn.otherId && conn.otherType) {
              const sourceId = conn.isOutgoing ?
                `central-topic-${ct.get('topicId').toNumber()}` :
                `${conn.otherType}-${conn.otherId.toNumber()}`;
              const targetId = conn.isOutgoing ?
                `${conn.otherType}-${conn.otherId.toNumber()}` :
                `central-topic-${ct.get('topicId').toNumber()}`;
              topicConnections.push({
                id: `edge-${sourceId}-${targetId}-${Date.now()}-${Math.random()}`,
                source: sourceId,
                target: targetId,
                type: 'default',
                animated: true
              });
            }
          });
        });

        // Process topic connections
        topics.forEach(topic => {
          const connections = topic.get('connections');
          connections.forEach(conn => {
            if (conn.otherId && conn.otherType) {
              const sourceId = conn.isOutgoing ?
                `topic-${topic.get('topicId').toNumber()}` :
                `${conn.otherType}-${conn.otherId.toNumber()}`;
              const targetId = conn.isOutgoing ?
                `${conn.otherType}-${conn.otherId.toNumber()}` :
                `topic-${topic.get('topicId').toNumber()}`;
              topicConnections.push({
                id: `edge-${sourceId}-${targetId}-${Date.now()}-${Math.random()}`,
                source: sourceId,
                target: targetId,
                type: 'default',
                animated: true
              });
            }
          });
        });

        // Add selection and type-specific styling to nodes
        const baseNodes = [
          ...paperNodes,
          ...topicNodes,
          ...(referenceNodes || []),
          ...centralTopicNodes
        ];

        console.log('All nodes loaded, combining:', {
          paperNodes: paperNodes.length,
          topicNodes: topicNodes.length,
          referenceNodes: referenceNodes?.length || 0,
          centralTopicNodes: centralTopicNodes.length
        });

        // Construct all edges first
        const allEdges = [
          ...(centralEdges || []),
          ...(topicConnections || []),
          ...(referenceEdges || [])
        ].filter(edge => edge && edge.source && edge.target);
        
        console.log('Setting edges:', allEdges);
        setEdges(allEdges);

        // Calculate display numbers using the freshly constructed baseNodes and allEdges
        const nodesWithDisplayNumbers = calculateDisplayNumbers(baseNodes, allEdges);
        setNodes(nodesWithDisplayNumbers);

      } catch (error) {
        console.error('Failed to connect to Neo4j:', error);
        setDbStatus('error');
      }
    };
  
    initAndLoadData();
    return () => {
      closeDriver();
    };
  }, []); // Only run on initial mount

  // Apply styles to nodes
  const getNodeStyle = useCallback((nodeType) => {
    switch (nodeType) {
      case 'paperNode':
        return paperNodeStyle;
      case 'topicNode':
        return topicNodeStyle;
      case 'referenceNode':
        return referenceNodeStyle;
      case 'centralTopicNode':
        return centralTopicNodeStyle;
      default:
        return commonNodeStyle;
    }
  }, []);

  useEffect(() => {
    if (!nodes) return;
    console.log('Applying styles to nodes:', nodes);
    
    const nodesWithStyle = nodes.map(node => {
      // Skip if node already has style
      if (node.style) return node;
      
      return {
        ...node,
        style: getNodeStyle(node.type)
      };
    });

    // Only update if styles have changed
    const hasStyleChanges = nodesWithStyle.some(
      (node, index) => !nodes[index]?.style ||
        JSON.stringify(nodes[index].style) !== JSON.stringify(node.style)
    );

    if (hasStyleChanges) {
      console.log('Updating node styles');
      setNodes(nodesWithStyle);
    }
  }, [nodes, getNodeStyle]); // Update styles when nodes change or style getter changes

// Recalculate display numbers whenever nodes or edges change
  useEffect(() => {
    // console.log("Nodes or edges changed, considering recalculating display numbers...");
    
    // Only proceed if there are nodes to process.
    if (nodes.length === 0) {
      // console.log("No nodes to process for display numbers, skipping recalculation.");
      return;
    }

    const newCalculatedNodes = calculateDisplayNumbers(nodes, edges);

    let displayNumbersActuallyChanged = false;
    if (newCalculatedNodes.length !== nodes.length) {
      // This would indicate a structural change not just a data update, should update.
      displayNumbersActuallyChanged = true;
      // console.warn("Node list length changed during display number calculation. This is unexpected.");
    } else {
      for (let i = 0; i < nodes.length; i++) {
        // Assuming newCalculatedNodes[i] corresponds to nodes[i] in terms of ID and order,
        // which is true because calculateDisplayNumbers uses nodes.map() then Array.from(map.values()).
        if (nodes[i].data.displayNumber !== newCalculatedNodes[i].data.displayNumber) {
          displayNumbersActuallyChanged = true;
          break;
        }
      }
    }

    if (displayNumbersActuallyChanged) {
      // console.log("Display numbers actually changed, updating nodes state.");
      // Pass the already computed newCalculatedNodes.
      // We are using `nodes` from the effect's closure, which is the current state for this render.
      setNodes(newCalculatedNodes);
    } else {
      // console.log("Display numbers did not change, skipping nodes state update to prevent loop.");
    }
  }, [nodes, edges]); // Dependency array includes nodes and edges
  // Handle node selection changes
  const onSelectionChange = useCallback(({ nodes }) => {
    setSelectedNode(nodes?.[0] || null);
  }, []);

  // Handle keyboard events for node deletion
  useEffect(() => {
    const handleKeyDown = async (event) => {
      if (selectedNode && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();

        try {
          // Delete node from Neo4j based on type
          const nodeId = selectedNode.id.split('-')[1];
          
          await executeQuery(
            `
            MATCH (n)
            WHERE ID(n) = $nodeId
            DETACH DELETE n
            `,
            { nodeId: parseInt(nodeId) }
          );

          // Remove node and its connected edges from state
          setNodes(nodes => nodes.filter(node => node.id !== selectedNode.id));
          setEdges(edges => edges.filter(edge =>
            edge.source !== selectedNode.id && edge.target !== selectedNode.id
          ));
          
          setSelectedNode(null);
        } catch (error) {
          console.error('Error deleting node:', error);
          alert('Failed to delete node');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode]);

  const [isLoading, setIsLoading] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');

  // Refs
  const dragRef = useRef(null);
  const leftWorkspaceRef = useRef(null);
  
  // Handle workspace resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !dragRef.current) return;
      const delta = e.clientX - dragRef.current.startX;
      const containerWidth = document.querySelector('.flex-1.flex.mt-16').offsetWidth;
      const newWidth = dragRef.current.startWidth + (delta / containerWidth * 100);
      setLeftWidth(clamp(newWidth, 30, 70)); // Limit width between 30% and 70%
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

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const workspaceRect = leftWorkspaceRef.current.getBoundingClientRect();
      
      // Only show context menu if selection is within left workspace
      if (rect.left >= workspaceRect.left && rect.right <= workspaceRect.right) {
        setSelectedText(text);
        setContextMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.bottom
        });
        setShowContextMenu(true);
      }
    } else {
      setShowContextMenu(false);
    }
  };

  const handleContextMenuAction = async (action) => {
    if (!currentPaperId) {
      alert('Please load a PDF document first');
      setShowContextMenu(false);
      return;
    }

    try {
      if (action === 'mark') {
        // Create TextMark node and relate it to the current Paper
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
        // Create ReferencedText node and relate it to the current Paper
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
          RETURN ID(r) as refId
          `,
          {
            paperId: currentPaperId,
            text: selectedText,
            positionX: getRandomPosition().x,
            positionY: getRandomPosition().y
          }
        );
        
        const refId = result[0].get('refId').toNumber();
        const newRefNode = {
          id: `ref-${refId}`,
          type: 'referenceNode',
          position: getRandomPosition(),
          data: {
            label: selectedText.substring(0, 30) + (selectedText.length > 30 ? '...' : ''),
            fullText: selectedText
          }
        };
        
        // Add new node and edge to the graph
        const newEdge = {
          id: `edge-paper-${currentPaperId}-ref-${refId}-${Date.now()}-${Math.random()}`,
          source: `paper-${currentPaperId}`,
          target: `ref-${refId}`,
          type: 'default',
          animated: true
        };
        
        setNodes(prevNodes => [...prevNodes, newRefNode]);
        setEdges(prevEdges => [...prevEdges, newEdge]);
        
        console.log('Reference created and added to graph:', refId);
      }
    } catch (error) {
      console.error('Error saving to Neo4j:', error);
      alert('Failed to save the selection. Please try again.');
    }
    setShowContextMenu(false);
  };

  const processPdfPage = async (page, pageNum) => {
    console.log('Getting text content for page...');
    const textContent = await page.getTextContent();
    console.log('Text content received:', textContent);
    const viewport = page.getViewport({ scale: 1.0 });
    
    // Group text items by their vertical position (lines)
    const lines = textContent.items.reduce((acc, item) => {
      // More precise y-coordinate calculation
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

    // Sort lines by vertical position and items within lines by horizontal position
    const sortedLines = Object.entries(lines)
      .sort(([y1], [y2]) => Number(y1) - Number(y2))
      .map(([yPos, items]) => ({
        y: Number(yPos),
        items: items.sort((a, b) => a.x - b.x)
      }));

    // Process the sorted lines into text content
    return {
      number: pageNum,
      content: sortedLines.map(line => {
        const text = line.items.map(item => item.text).join('');
        if (!text.trim()) return null; // Skip empty lines
        
        const firstItem = line.items[0];
        const style = {
          fontSize: `${Math.round(firstItem.fontSize)}px`,
          fontFamily: firstItem.fontFamily.replace('+', ' '),
          marginLeft: `${Math.round(firstItem.x / viewport.width * 100)}%`,
          fontWeight: firstItem.bold ? 'bold' : 'normal',
          fontStyle: firstItem.italic ? 'italic' : 'normal',
          position: 'relative',
          display: 'block'
        };

        return {
          text,
          style
        };
      }).filter(Boolean) // Remove null entries (empty lines)
    };
  };

  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please select a valid PDF file');
      return;
    }

    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      console.log('Loading PDF...');
      const loadingTask = pdfjsLib.getDocument(arrayBuffer);
      const pdf = await loadingTask.promise;
      console.log('PDF loaded successfully:', { numPages: pdf.numPages });
      
      // Extract metadata
      const metadata = await pdf.getMetadata().catch(() => ({ info: {} }));
      const title = metadata?.info?.Title || file.name;
      const author = metadata?.info?.Author || 'Unknown';
      const localPath = URL.createObjectURL(file);

      // Check if paper already exists
      const existingPaper = await executeQuery(
        `
        MATCH (p:Paper)
        WHERE p.title = $title OR p.localPath = $localPath
        RETURN ID(p) as paperId, p.title as title, p.author as author, p.localPath as localPath
        LIMIT 1
        `,
        { title, localPath }
      );

      let paperId;
      if (existingPaper.length > 0) {
        // Use existing paper
        const paper = existingPaper[0];
        paperId = paper.get('paperId').toNumber();
        const existingTitle = paper.get('title');
        const existingAuthor = paper.get('author');
        console.log('Using existing paper:', { existingTitle, existingAuthor });
      } else {
        // Create new paper
        const result = await executeQuery(
          `
          CREATE (p:Paper {
            title: $title,
            author: $author,
            localPath: $localPath,
            uploadedAt: datetime()
          })
          RETURN ID(p) as paperId
          `,
          { title, author, localPath }
        );
        paperId = result[0].get('paperId').toNumber();
        console.log('Created new paper:', { title, author });
      }
      setCurrentPaperId(paperId);
      setCurrentPaperTitle(title);

      // Fetch all references for this paper
      const references = await executeQuery(
        `
        MATCH (p:Paper)-[:HAS_REFERENCE]->(r:ReferencedText)
        WHERE ID(p) = $paperId
        RETURN ID(r) as refId, r.text as text
        `,
        { paperId }
      );

      // Create nodes for paper and its references
      const paperNode = {
        id: `paper-${paperId}`,
        type: 'paperNode',
        position: { x: 250, y: 250 },
        data: { label: title }
      };

      const referenceNodes = references.map(ref => {
        const refId = ref.get('refId').toNumber();
        const text = ref.get('text');
        return {
          id: `ref-${refId}`,
          type: 'referenceNode',
          position: getRandomPosition(),
          data: {
            label: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
            fullText: text
          }
        };
      });

      const edges = references.map(ref => {
        const refId = ref.get('refId').toNumber();
        return {
          id: `edge-paper-${paperId}-ref-${refId}-${Date.now()}-${Math.random()}`,
          source: `paper-${paperId}`,
          target: `ref-${refId}`,
          type: 'default',
          animated: true
        };
      });

      // Update graph
      // Preserve existing nodes and edges, only add new ones
      setNodes(prevNodes => {
        const existingNodeIds = new Set(prevNodes.map(n => n.id));
        const newNodes = [paperNode, ...referenceNodes].filter(node => !existingNodeIds.has(node.id));
        return [...prevNodes, ...newNodes];
      });
      
      setEdges(prevEdges => {
        const existingEdgeIds = new Set(prevEdges.map(e => e.id));
        const newEdges = edges.filter(edge => !existingEdgeIds.has(edge.id));
        return [...prevEdges, ...newEdges];
      });

      // Process PDF pages
      const pages = [];
      console.log('Processing PDF pages...');
      for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`Processing page ${i}...`);
        const page = await pdf.getPage(i);
        const processedPage = await processPdfPage(page, i);
        console.log(`Page ${i} processed:`, processedPage);
        pages.push(processedPage);
      }

      console.log('Setting PDF content...');
      setPdfContent({ pages });
    } catch (error) {
      console.error('Error processing PDF:', error);
      setPdfContent({ pages: [] });
      setCurrentPaperId(null);
      setCurrentPaperTitle('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <Header
        dbStatus={dbStatus}
        onFileUpload={handleFileUpload}
        onNewTopic={() => {
          setParentForNewTopic(null); // Ensure we are creating an orphan topic
          setShowTopicPopup(true);
        }}
        onNewCentralTopic={() => setShowCentralTopicPopup(true)}
        showImportantPapers={showImportantPapers}
        onToggleImportantPapers={() => setShowImportantPapers(!showImportantPapers)}
      />
      <div className="flex-1 flex mt-16 w-full">
        {/* Left Workspace */}
        <div
          ref={leftWorkspaceRef}
          className="workspace p-6 bg-gray-50"
          style={{ width: `${leftWidth}%` }}
          onMouseUp={handleTextSelection}
        >
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            PDF Content
            {currentPaperTitle && (
              <span className="ml-2 text-base font-normal text-gray-600">
                - {currentPaperTitle}
              </span>
            )}
          </h2>
          <div className="bg-white p-8 rounded-lg shadow-sm max-h-[calc(100vh-10rem)] overflow-auto min-w-[600px]">
            {isLoading ? (
              <div className="flex items-center justify-center text-gray-600">
                <div className="animate-pulse">Loading PDF content...</div>
              </div>
            ) : (
              <div className="pdf-content mx-auto whitespace-pre-wrap min-w-[500px]">
                {pdfContent.pages.length === 0 ? (
                  <p>Select a PDF file to view its content here</p>
                ) : (
                  pdfContent.pages.map((page) => (
                    <div key={page.number} className="pdf-page">
                      <div className="pdf-heading-2 pdf-text-center mb-4">
                        Page {page.number}
                      </div>
                      {page.content.map((line, idx) => (
                        <div
                          key={idx}
                          className="pdf-paragraph"
                          style={{
                            ...line.style,
                            whiteSpace: 'pre-wrap',
                            marginBottom: '0.25em',
                            lineHeight: '1.5',
                            minHeight: '1.5em'
                          }}
                        >
                          {line.text}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Context Menu */}
        {showContextMenu && (
          <div 
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200"
            style={{
              left: `${contextMenuPosition.x}px`,
              top: `${contextMenuPosition.y}px`,
              transform: 'translate(-50%, 8px)'
            }}
          >
            <button
              onClick={() => handleContextMenuAction('mark')}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              Mark
            </button>
            <button
              onClick={() => handleContextMenuAction('reference')}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100 border-t border-gray-200"
            >
              Reference
            </button>
          </div>
        )}

        {/* Resizer */}
        <div
          className={`workspace-resizer ${isDragging ? 'dragging' : ''}`}
          onMouseDown={(e) => {
            setIsDragging(true);
            dragRef.current = {
              startX: e.clientX,
              startWidth: leftWidth
            };
          }}
        />

        {/* Right Workspace */}
        <div
          className="workspace p-6"
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
                // Handle node deletions first
                const deletedNodes = changes.filter(change => change.type === 'remove');
                for (const node of deletedNodes) {
                  try {
                    // Extract node type and ID
                    const parts = node.id.split('-');
                    const nodeId = parts[parts.length - 1];
                    const nodeType = parts.slice(0, -1).join('-');
                    
                    // Determine Neo4j label
                    const label = nodeType === 'paper' ? 'Paper' :
                                nodeType === 'topic' ? 'Topic' :
                                nodeType === 'central-topic' ? 'CentralTopic' :
                                nodeType === 'ref' ? 'ReferencedText' : null;
                    
                    if (label) {
                      // Delete the node and all its relationships
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

                // Apply changes to the visual nodes while preserving selection and type-specific styles
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
                
                // Update positions in Neo4j for moved nodes
                const positionChanges = changes.filter(change =>
                  change.type === 'position' && change.position
                );
                
                for (const change of positionChanges) {
                  // Handle special case for central-topic which contains a hyphen
                  const parts = change.id.split('-');
                  const nodeId = parts[parts.length - 1];
                  const nodeType = parts.slice(0, -1).join('-');
                  const label = nodeType === 'paper' ? 'Paper' :
                              nodeType === 'topic' ? 'Topic' :
                              nodeType === 'central-topic' ? 'CentralTopic' :
                              nodeType === 'ref' ? 'ReferencedText' : null;
                  
                  // Log position update for debugging
                  console.log('Updating position for:', { nodeType, nodeId, label, position: change.position });
                  
                  if (label) {
                    try {
                      const existingNode = nodes.find(n => n.id === change.id);
                      await executeQuery(
                        `
                        MATCH (n:${label})
                        WHERE ID(n) = $nodeId
                        SET n.positionX = $positionX,
                            n.positionY = $positionY
                            ${label === 'Paper' ? ', n.importance = $importance, n.notes = $notes' : ''}
                        `,
                        {
                          nodeId: parseInt(nodeId),
                          positionX: change.position.x,
                          positionY: change.position.y,
                          ...(label === 'Paper' && {
                            importance: existingNode?.data?.importance || 0,
                            notes: existingNode?.data?.notes || ''
                          })
                        }
                      );
                    } catch (error) {
                      console.error('Error updating node position:', error);
                    }
                  }
                }
              }}
              onEdgesChange={async (changes) => {
                // Handle edge deletions
                const deletedEdges = changes.filter(change => change.type === 'remove');
                for (const edge of deletedEdges) {
                  try {
                    // Extract IDs and types from edge ID (format: edge-type-id-type-id-timestamp)
                    const parts = edge.id.split('-');
                    const sourceType = parts[1];
                    const sourceId = parts[2];
                    const targetType = parts[3];
                    const targetId = parts[4];

                    // Map types to Neo4j labels
                    const sourceLabel = sourceType === 'paper' ? 'Paper' :
                                      sourceType === 'topic' ? 'Topic' :
                                      sourceType === 'central-topic' ? 'CentralTopic' :
                                      sourceType === 'ref' ? 'ReferencedText' : null;

                    const targetLabel = targetType === 'paper' ? 'Paper' :
                                      targetType === 'topic' ? 'Topic' :
                                      targetType === 'central-topic' ? 'CentralTopic' :
                                      targetType === 'ref' ? 'ReferencedText' : null;

                    if (sourceLabel && targetLabel) {
                      // Delete any relationship between these nodes
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
let relationshipType = 'RELATES_TO'; // Default relationship type
                  const sourceNode = nodes.find(n => n.id === params.source);
                  const targetNode = nodes.find(n => n.id === params.target);
                  
                  if (!sourceNode || !targetNode) {
                    console.error('Source or target node not found');
                    return;
                  }

                  // Extract IDs from node IDs
                  // Handle special case for central-topic which contains a hyphen
                  const sourceParts = params.source.split('-');
                  const sourceId = sourceParts[sourceParts.length - 1];
                  const sourceType = sourceParts.slice(0, -1).join('-');

                  const targetParts = params.target.split('-');
                  const targetId = targetParts[targetParts.length - 1];
                  const targetType = targetParts.slice(0, -1).join('-');

                  console.log('Connection attempt:', { sourceType, sourceId, targetType, targetId });

                  // Validate connection types
                  if (sourceNode.type === 'referenceNode') {
                    alert('Invalid connection: References cannot be source nodes');
                    return;
                  }

                  // Log connection attempt details
                  console.log('Creating connection:', {
                    source: { type: sourceNode.type, id: sourceId },
                    target: { type: targetNode.type, id: targetId }
                  });

                  // Create relationship in Neo4j based on node types
                  let query = '';

                  if (sourceNode.type === 'centralTopicNode' && targetNode.type === 'referenceNode') {
                    query = `
                      MATCH (ct:CentralTopic), (r:ReferencedText)
                      WHERE ID(ct) = $sourceId AND ID(r) = $targetId
                      CREATE (ct)-[rel:HAS_REFERENCE]->(r)
                    `;
                  } else if ((sourceNode.type === 'paperNode' || sourceNode.type === 'topicNode') && targetNode.type === 'referenceNode') {
                    const sourceLabel = sourceNode.type === 'paperNode' ? 'Paper' : 'Topic';
                    query = `
                      MATCH (source:${sourceLabel}), (r:ReferencedText)
                      WHERE ID(source) = $sourceId AND ID(r) = $targetId
                      CREATE (source)-[rel:HAS_REFERENCE]->(r)
                    `;
                  } else if (targetNode.type === 'topicNode') {
                    // Handle connections to topics
                    const sourceLabel = sourceNode.type === 'centralTopicNode' ? 'CentralTopic' :
                                     sourceNode.type === 'paperNode' ? 'Paper' : 'Topic';
                    const targetLabel = 'Topic';
                    relationshipType = 'HAS_TOPIC'; // Ensure relationshipType is set
                    query = `
                      MATCH (source:${sourceLabel}), (target:${targetLabel})
                      WHERE ID(source) = $sourceId AND ID(target) = $targetId
                      
                      // Ensure the relationship exists or create it
                      MERGE (source)-[r:HAS_TOPIC]->(target)
                        ON CREATE SET r.createdAt = datetime()

                      // After ensuring the relationship, count other children of the source
                      WITH source, target
                      OPTIONAL MATCH (source)-[:HAS_TOPIC]->(otherChild:Topic)
                      WHERE otherChild <> target // Exclude the target itself from the count
                      WITH target, COUNT(otherChild) AS numOtherSiblings
                      
                      // Set the siblingOrder for the target node
                      SET target.siblingOrder = numOtherSiblings + 1
                      RETURN target.siblingOrder AS newSiblingOrder
                    `;
                  } else if (sourceNode.type === 'topicNode') {
                     // Handle connections from topics (e.g., to Paper, CentralTopic)
                     // These typically don't involve siblingOrder for the target
                     const sourceLabel = 'Topic';
                     const targetLabel = targetNode.type === 'centralTopicNode' ? 'CentralTopic' :
                                      targetNode.type === 'paperNode' ? 'Paper' : 'Topic'; // Avoid Topic->Topic here?
                     relationshipType = 'RELATES_TO_TOPIC'; // Or specific type
                     query = `
                       MATCH (source:${sourceLabel}), (target:${targetLabel})
                       WHERE ID(source) = $sourceId AND ID(target) = $targetId
                       MERGE (source)-[r:${relationshipType}]->(target)
                     `;
                  } else {
                     console.warn(`Unhandled connection type: ${sourceNode.type} -> ${targetNode.type}`);
                     query = ''; // Prevent execution for unhandled types
                  }


                  // Log query for debugging
                  console.log('Executing query:', query);

                  if (query) {
                    // Execute the query
                    const result = await executeQuery(query, {
                      sourceId: parseInt(sourceId),
                      targetId: parseInt(targetId)
                    });

                    let newSiblingOrder = null;
                    // Check if the query returned a new sibling order (only for HAS_TOPIC)
                    if (relationshipType === 'HAS_TOPIC' && result && result.length > 0) {
                       newSiblingOrder = result[0].get('newSiblingOrder')?.toNumber();
                       console.log(`Assigned new siblingOrder: ${newSiblingOrder} to node ${targetNode.id}`);
                    }

                    // Create and add visual edge
                    const newEdge = {
                      id: `edge-${sourceType}-${sourceId}-${targetType}-${targetId}-${Date.now()}-${Math.random()}`,
                      source: params.source,
                      target: params.target,
                      type: 'floating', // Use floating edge type
                      label: relationshipType, // Add label to edge
                      animated: true,
                      markerEnd: { type: MarkerType.ArrowClosed },
                    };

                    // Log edge creation
                    console.log('Adding edge:', newEdge);

                    // Update client state: add edge, update target node's siblingOrder, recalculate numbers
                    const finalEdges = addEdge(newEdge, edges);
                    setEdges(finalEdges); // Update edges state

                    // Update the target node's siblingOrder and recalculate display numbers
                    if (targetNode.type === 'topicNode' && newSiblingOrder !== null && newSiblingOrder !== undefined) {
                      setNodes(prevNodes => {
                        const nodesWithUpdatedSiblingOrder = prevNodes.map(n =>
                          n.id === targetNode.id
                            ? { ...n, data: { ...n.data, siblingOrder: newSiblingOrder } }
                            : n
                        );
                        console.log(`Updating client state for node ${targetNode.id} with siblingOrder: ${newSiblingOrder}`);
                        // Now, recalculate display numbers with the updated nodes and the new edge
                        return calculateDisplayNumbers(nodesWithUpdatedSiblingOrder, finalEdges);
                      });
                    } else {
                      console.log(`No client-side siblingOrder update needed for target ${targetNode.id} (type: ${targetNode.type})`);
                      // Even if no siblingOrder update, if an edge was added, display numbers might need recalculation
                      // (e.g. if a non-topic was involved but structure changed)
                      // However, for this specific issue, we focus on HAS_TOPIC.
                      // If other edge types could affect numbering, this might need to be broader:
                      // setNodes(prevNodes => calculateDisplayNumbers(prevNodes, finalEdges));
                    }
} // End of if(query) block
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
                    // Create an orphan topic if no parent is set
                    await handleCreateTopicNode(null, newTopicName.trim());
                  }
                  setShowTopicPopup(false);
                  setNewTopicName('');
                  setParentForNewTopic(null); // Reset parent
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
    </div>
  );
}

export default App;
