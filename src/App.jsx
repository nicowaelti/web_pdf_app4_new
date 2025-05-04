import React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
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
  padding: 10px;
  border-radius: 5px;
  background: white;
  border: 1px solid #1a192b;
  min-width: 150px;
}

.custom-node-content {
  padding: 8px;
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
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// Helper function for random positioning
const getRandomPosition = () => ({
  x: Math.random() * 400 + 100,
  y: Math.random() * 400 + 100
});

// Define constant styles and node types outside of component
const commonNodeStyle = {
  borderRadius: '5px',
  border: '1px solid #ddd',
  fontSize: '12px',
  width: '100%',
  height: '100%'
};

const TopicNode = React.memo(({ data }) => (
  <>
    <Handle type="target" position={Position.Left} />
    <div style={{
      ...commonNodeStyle,
      backgroundColor: '#f0fdf4',
      border: '2px solid #86efac'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Topic</div>
      <div>{data.label}</div>
    </div>
    <Handle type="source" position={Position.Right} />
  </>
));

const ReferenceNode = React.memo(({ data }) => (
  <>
    <Handle type="target" position={Position.Left} />
    <div style={{
      ...commonNodeStyle,
      backgroundColor: '#f8f9fa'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Reference</div>
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
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Paper</div>
      <div>{data.label}</div>
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
      padding: '10px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Central Topic</div>
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

// Initial states
const initialNodes = [];
const initialEdges = [];

function App() {
  const [dbStatus, setDbStatus] = useState('connecting');
  const [currentPaperId, setCurrentPaperId] = useState(null);
  const [currentPaperTitle, setCurrentPaperTitle] = useState('');
  const [showTopicPopup, setShowTopicPopup] = useState(false);
  const [showCentralTopicPopup, setShowCentralTopicPopup] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newCentralTopicName, setNewCentralTopicName] = useState('');

  const handleCreateCentralTopic = async () => {
    if (!newCentralTopicName.trim()) return;

    try {
      const result = await executeQuery(
        `
        CREATE (ct:CentralTopic {
          name: $name,
          positionX: $positionX,
          positionY: $positionY,
          timestamp: datetime()
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
                `,
                { topicId, newName }
              );
              setNodes(prev =>
                prev.map(node =>
                  node.id === `central-topic-${topicId}`
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

      setNodes(prev => [...prev, newNode]);
      setNewCentralTopicName('');
      setShowCentralTopicPopup(false);
    } catch (error) {
      console.error('Error creating central topic:', error);
      alert('Failed to create central topic');
    }
  };

  // Initialize Neo4j connection
  useEffect(() => {
    const initAndLoadData = async () => {
      try {
        await initializeDriver();
        console.log('Successfully connected to Neo4j');
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
          const position = {
            x: typeof topic.get('positionX') === 'number' ? topic.get('positionX') : getRandomPosition().x,
            y: typeof topic.get('positionY') === 'number' ? topic.get('positionY') : getRandomPosition().y
          };
          const topicId = topic.get('topicId').toNumber();
          return {
            id: `central-topic-${topicId}`,
            type: 'centralTopicNode',
            position,
            data: {
              label: topic.get('name'),
              onRename: async (newName) => {
                try {
                  await executeQuery(
                    `
                    MATCH (ct:CentralTopic)
                    WHERE ID(ct) = $topicId
                    SET ct.name = $newName
                    `,
                    { topicId, newName }
                  );
                  setNodes(prev =>
                    prev.map(node =>
                      node.id === `central-topic-${topicId}`
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
        
        // Load all papers and their references
        const papers = await executeQuery(`
          MATCH (p:Paper)
          RETURN
            ID(p) as paperId,
            p.title as title,
            toFloat(p.positionX) as positionX,
            toFloat(p.positionY) as positionY
        `);
        
        // Load papers with their positions
        const paperNodes = papers.map(paper => {
          const position = {
            x: typeof paper.get('positionX') === 'number' ? paper.get('positionX') : getRandomPosition().x,
            y: typeof paper.get('positionY') === 'number' ? paper.get('positionY') : getRandomPosition().y
          };
          return {
            id: `paper-${paper.get('paperId').toNumber()}`,
            type: 'paperNode',
            position: position,
            data: { label: paper.get('title') }
          };
        });

        // Load all topics and their connections
        const topics = await executeQuery(`
          MATCH (t:Topic)
          OPTIONAL MATCH (t)-[r:HAS_TOPIC|HAS_REFERENCE]-(other)
          RETURN
            ID(t) as topicId,
            t.name as name,
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
          const position = {
            x: typeof topic.get('positionX') === 'number' ? topic.get('positionX') : getRandomPosition().x,
            y: typeof topic.get('positionY') === 'number' ? topic.get('positionY') : getRandomPosition().y
          };
          return {
            id: `topic-${topic.get('topicId').toNumber()}`,
            type: 'topicNode',
            position: position,
            data: { label: topic.get('name') }
          };
        });

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

        const edges = references.map(ref => {
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

        setNodes([...paperNodes, ...topicNodes, ...referenceNodes, ...centralTopicNodes]);
        setEdges([...edges, ...centralEdges, ...topicConnections]);

      } catch (error) {
        console.error('Failed to connect to Neo4j:', error);
        setDbStatus('error');
      }
    };

    initAndLoadData();
    return () => {
      closeDriver();
    };
  }, []);

  // State management
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [pdfContent, setPdfContent] = useState({ pages: [] });
  const [leftWidth, setLeftWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
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
            timestamp: datetime()
          })
          CREATE (p)-[r:HAS_MARK]->(t)
          `,
          {
            paperId: currentPaperId,
            text: selectedText
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
            timestamp: datetime()
          })
          CREATE (p)-[rel:HAS_REFERENCE]->(r)
          RETURN ID(r) as refId
          `,
          {
            paperId: currentPaperId,
            text: selectedText
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
    const textContent = await page.getTextContent();
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
        // More accurate font size calculation using transform matrix
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

    return {
      number: pageNum,
      content: sortedLines.map((line, lineIndex) => {
        // Calculate average line height based on font metrics
        const avgLineHeight = line.items.reduce((sum, item) =>
          sum + (item.ascent - item.descent), 0) / line.items.length;

        // Calculate line spacing based on vertical position difference with previous line
        const prevLine = lineIndex > 0 ? sortedLines[lineIndex - 1] : null;
        const lineSpacing = prevLine ? (line.y - prevLine.y) / avgLineHeight : 1;

        return {
          text: line.items.map(item => item.text).join(''),
          style: {
            fontSize: `${Math.round(line.items[0].fontSize)}px`,
            fontFamily: line.items[0].fontFamily.replace('+', ' '),
            marginLeft: `${Math.round(line.items[0].x / viewport.width * 100)}%`,
            fontWeight: line.items[0].bold ? 'bold' : 'normal',
            fontStyle: line.items[0].italic ? 'italic' : 'normal',
            lineHeight: `${Math.max(1.2, lineSpacing)}`,
            marginTop: lineSpacing > 1.5 ? `${(lineSpacing - 1) * 1}em` : '0',
            textAlign: 'left',
            position: 'relative'
          }
        };
      })
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
      const loadingTask = pdfjsLib.getDocument(arrayBuffer);
      const pdf = await loadingTask.promise;
      
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
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const processedPage = await processPdfPage(page, i);
        pages.push(processedPage);
      }

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
        onNewTopic={() => setShowTopicPopup(true)}
        onNewCentralTopic={() => setShowCentralTopicPopup(true)}
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
          <div className="bg-white p-8 rounded-lg shadow-sm max-h-[calc(100vh-10rem)] overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center text-gray-600">
                <div className="animate-pulse">Loading PDF content...</div>
              </div>
            ) : (
              <div className="pdf-content mx-auto">
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
                          style={line.style}
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
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              defaultEdgeOptions={{ type: 'floating', animated: true }}
              onNodesChange={async (changes) => {
                // Apply changes to the visual nodes
                setNodes((nds) => applyNodeChanges(changes, nds));
                
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
                          positionY: change.position.y
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
                    // Extract IDs from edge ID (format: edge-type-id-type-id-timestamp)
                    const parts = edge.id.split('-');
                    const sourceId = parts[2];
                    const targetId = parts[4];
                    await executeQuery(
                      `
                      MATCH (source)-[r]->(target)
                      WHERE ID(source) = $sourceId AND ID(target) = $targetId
                      DELETE r
                      `,
                      { sourceId: parseInt(sourceId), targetId: parseInt(targetId) }
                    );
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
                    query = `
                      MATCH (source:${sourceLabel}), (target:${targetLabel})
                      WHERE ID(source) = $sourceId AND ID(target) = $targetId
                      CREATE (source)-[r:HAS_TOPIC]->(target)
                    `;
                  } else if (sourceNode.type === 'topicNode') {
                    // Handle connections from topics
                    const sourceLabel = 'Topic';
                    const targetLabel = targetNode.type === 'centralTopicNode' ? 'CentralTopic' :
                                     targetNode.type === 'paperNode' ? 'Paper' : 'Topic';
                    query = `
                      MATCH (source:${sourceLabel}), (target:${targetLabel})
                      WHERE ID(source) = $sourceId AND ID(target) = $targetId
                      CREATE (source)-[r:HAS_TOPIC]->(target)
                    `;
                  }

                  // Log query for debugging
                  console.log('Executing query:', query);

                  // Execute the query
                  await executeQuery(query, {
                    sourceId: parseInt(sourceId),
                    targetId: parseInt(targetId)
                  });

                  // Create and add visual edge
                  const newEdge = {
                    id: `edge-${sourceType}-${sourceId}-${targetType}-${targetId}-${Date.now()}-${Math.random()}`,
                    source: params.source,
                    target: params.target,
                    type: 'default',
                    animated: true
                  };

                  // Log edge creation
                  console.log('Adding edge:', newEdge);

                  setEdges(eds => addEdge(newEdge, eds));
                } catch (error) {
                  console.error('Error creating connection:', error);
                  alert('Failed to create connection. Please try again.');
                }
              }}
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

      {/* New Topic Popup */}
      {showTopicPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Create New Topic</h3>
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
                  try {
                    // Create topic node in Neo4j
                    const position = getRandomPosition();
                    const result = await executeQuery(
                      `
                      MERGE (t:Topic {
                        name: $name
                      })
                      ON CREATE SET
                        t.createdAt = datetime(),
                        t.positionX = $positionX,
                        t.positionY = $positionY
                      ON MATCH SET
                        t.updatedAt = datetime(),
                        t.positionX = $positionX,
                        t.positionY = $positionY
                      RETURN ID(t) as topicId
                      `,
                      {
                        name: newTopicName.trim(),
                        positionX: position.x,
                        positionY: position.y
                      }
                    );
                    
                    const topicId = result[0].get('topicId').toNumber();
                    
                    // Create node in the graph
                    const newTopicNode = {
                      id: `topic-${topicId}`,
                      type: 'topicNode',
                      position: position,
                      data: { label: newTopicName.trim() }
                    };
                    
                    setNodes(prevNodes => [...prevNodes, newTopicNode]);
                    setShowTopicPopup(false);
                    setNewTopicName('');
                  } catch (error) {
                    console.error('Error creating topic:', error);
                    alert('Failed to create topic. Please try again.');
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Create
              </button>
            </div>
          </div>
        </div>
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
