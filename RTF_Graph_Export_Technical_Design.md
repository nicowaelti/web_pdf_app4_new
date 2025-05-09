# RTF Graph Export Technical Design

This document outlines the technical design and implementation details for the RTF graph export feature in the Workspace App. The feature allows users to export the hierarchical structure of topics, paragraphs, and references, starting from a selected Central Topic or Topic node, into a Rich Text Format (.rtf) document.

## 1. Overview

The RTF export process involves fetching the relevant subgraph data from the Neo4j database, transforming this data into a hierarchical tree structure in JavaScript, and then recursively traversing this tree to generate the RTF content with proper numbering, indentation, and formatting.

## 2. Component Responsibilities

*   **[`src/App.jsx`](src/App.jsx:1)**:
    *   Provides the user interface trigger for the export (the "Export to RTF" menu item in the header).
    *   Identifies the root node for the export (currently, the first Central Topic found, or the first Topic if no Central Topic exists).
    *   Calls the main export function (`exportGraphToRtf`) in `rtfExporter.js` with the `elementId` of the root node.
*   **[`src/features/rtfExport/rtfExporter.js`](src/features/rtfExport/rtfExporter.js:1)**:
    *   Contains the core logic for fetching graph data and generating the RTF document.
    *   Orchestrates the process by using `GraphDataProcessor` to fetch and structure the data and `RtfBuilder` to generate the RTF string.
    *   Triggers the file download in the browser.
*   **`GraphDataProcessor` Class (in [`src/features/rtfExport/rtfExporter.js`](src/features/rtfExport/rtfExporter.js:44))**:
    *   Responsible for querying the Neo4j database to retrieve the subgraph data relevant to the export.
    *   Transforms the flat list of nodes and relationships returned by the query into a hierarchical tree structure (`ProcessedGraphNode` objects).
*   **`RtfBuilder` Class (in [`src/features/rtfExport/rtfExporter.js`](src/features/rtfExport/rtfExporter.js:264))**:
    *   Responsible for taking the hierarchical `ProcessedGraphNode` tree and generating the final RTF formatted string.
    *   Handles RTF syntax for formatting, indentation, and hierarchical numbering.
*   **[`src/utils/neo4jConnection.js`](src/utils/neo4jConnection.js:1)**:
    *   Provides the `executeQuery` function used by `GraphDataProcessor` to interact with the Neo4j database.

## 3. Data Structure: `ProcessedGraphNode`

The intermediate data structure used to represent the hierarchical graph in JavaScript is defined by the `ProcessedGraphNode` typedef in [`rtfExporter.js`](src/features/rtfExport/rtfExporter.js:30).

```javascript
/**
 * @typedef {Object} ProcessedGraphNode
 * @property {string} id - Unique identifier (e.g., elementId from Neo4j)
 * @property {NodeType} type - Type of the node ('CentralTopic', 'Topic', 'Paragraph', 'ReferencedText', 'Paper', 'Unknown')
 * @property {Object<string, any>} properties - All properties from Neo4j node
 * @property {Array<ProcessedGraphNode>} children - Child nodes in the hierarchy
 * @property {number | null} siblingOrder - From 'siblingOrder' property, for sorting
 * @property {number} rtfLevel - Calculated depth for numbering and indentation
 * @property {string} [title] - Display title (derived from name, Statement, or title properties)
 * @property {string} [textContent] - Text content (for ReferencedText nodes)
 */
```

This structure is built by the `GraphDataProcessor` and consumed by the `RtfBuilder`.

## 4. Data Fetching and Processing (`GraphDataProcessor.processGraphData`)

The `processGraphData` method in [`rtfExporter.js`](src/features/rtfExport/rtfExporter.js:54) is responsible for fetching the necessary data from Neo4j and building the `ProcessedGraphNode` tree.

### 4.1 Cypher Query

The method executes a single Cypher query to retrieve all relevant nodes and relationships within the subgraph starting from the provided `rootNodeId`.

```cypher
const cypherQuery = `
    MATCH (root) WHERE root.elementId = $rootNodeId OR root.elementId = toString($rootNodeId) OR ID(root) = toInteger(split($rootNodeId, ':')[2])

    // Find all nodes reachable from the root via relevant relationships
    OPTIONAL MATCH path = (root)-[:HAS_TOPIC|HAS_PARAGRAPH|CITES*0..10]->(descendant)
    WITH root, collect(DISTINCT root) + collect(DISTINCT descendant) AS subgraph_nodes

    // Add any papers linked to referenced texts in the subgraph
    UNWIND subgraph_nodes AS node
    OPTIONAL MATCH (paper:Paper)-[:HAS_REFERENCE]->(node) WHERE node:ReferencedText
    WITH collect(DISTINCT node) + collect(DISTINCT paper) AS all_relevant_nodes_list

    UNWIND all_relevant_nodes_list AS n
    WITH collect(DISTINCT n) AS all_nodes_in_subgraph

    // Find all relevant relationships between nodes in the subgraph
    UNWIND all_nodes_in_subgraph AS n1
    UNWIND all_nodes_in_subgraph AS n2
    OPTIONAL MATCH (n1)-[r]->(n2)
    WHERE type(r) IN ['HAS_TOPIC', 'HAS_PARAGRAPH', 'CITES', 'HAS_REFERENCE'] // Only include relevant relationships
    WITH all_nodes_in_subgraph, collect(DISTINCT {
        startNodeElementId: elementId(n1),
        endNodeElementId: elementId(n2),
        type: type(r),
        properties: properties(r)
    }) AS subgraph_relationships

    // Return nodes and relationships
    UNWIND all_nodes_in_subgraph AS node
    RETURN collect({
        id: ID(node),
        elementId: elementId(node),
        labels: labels(node),
        properties: properties(node)
    }) AS nodes, subgraph_relationships AS relationships
`;
```

*   **Root Node Matching**: The query first matches the `root` node using the provided `$rootNodeId`. It attempts to match by `elementId` (both as a string and potentially converted to string) or by extracting the numeric ID from the elementId string and matching against `ID(root)`.
*   **Subgraph Node Collection**: It then finds all nodes reachable from the root via `HAS_TOPIC`, `HAS_PARAGRAPH`, or `CITES` relationships up to 10 levels deep (`*0..10`). It collects the root and all descendants into `subgraph_nodes`.
*   **Including Papers**: It further includes any `Paper` nodes that have a `HAS_REFERENCE` relationship pointing to a `ReferencedText` node already included in the `subgraph_nodes`. This ensures that papers linked to references within the hierarchy are also fetched.
*   **Collecting All Nodes**: All unique nodes identified (root, descendants, and linked papers) are collected into `all_nodes_in_subgraph`.
*   **Collecting Relevant Relationships**: It finds all relationships between any two nodes within the `all_nodes_in_subgraph` list, but only includes relationships of types `HAS_TOPIC`, `HAS_PARAGRAPH`, `CITES`, and `HAS_REFERENCE`. It collects details about these relationships.
*   **Final Return**: The query returns two lists: `nodes` (details of all unique nodes) and `relationships` (details of all relevant relationships between them).

### 4.2 Building the Hierarchy in JavaScript

After executing the query, `processGraphData` processes the returned `nodes` and `relationships` lists to build the hierarchical tree:

1.  **Node Map Creation**: It creates a `Map` (`nodesMap`) where keys are node `elementId`s and values are `ProcessedGraphNode` objects. All nodes returned by the query are added to this map, initializing their `children` arrays as empty.
2.  **Root Node Identification**: The `processedRoot` node is retrieved from the `nodesMap` using the original `rootNodeId`.
3.  **Hierarchy Construction**: It iterates through the `relationships` list. For each relationship, it finds the corresponding `startNode` and `endNode` in the `nodesMap`.
    *   If the relationship type is `HAS_TOPIC` or `HAS_PARAGRAPH`, the `endNode` is added to the `children` array of the `startNode`.
    *   If the relationship type is `CITES` and the `startNode` is a `Paragraph` and the `endNode` is a `ReferencedText`, ensure the `ReferencedText` is added as a child of the `Paragraph`.
    *   If the relationship type is `HAS_REFERENCE` and the `startNode` is a `ReferencedText` and the `endNode` is a `Paper`, add the paper title to the `ReferencedText` node's properties as `paperTitle`.
4.  **RTF Level Calculation**: A recursive function `calculateRtfLevels` traverses the tree starting from the `processedRoot` to determine the `rtfLevel` (depth) of each node. Central Topics are level 0, their direct children are level 1 (for numbering purposes), and so on.
5.  **Sorting Children**: After the hierarchy is built, it iterates through all nodes in the `nodesMap` and sorts their `children` arrays based on the `siblingOrder` property.
6.  **Return Root**: The `processedRoot` node, which is now the root of the complete hierarchical tree, is returned.

## 5. RTF Generation (`RtfBuilder`)

The `RtfBuilder` class takes the hierarchical `ProcessedGraphNode` tree and converts it into an RTF string.

### 5.1 `buildRtf` Method

The `buildRtf` method initializes the RTF header (including font and color tables, and default paragraph formatting) and then calls the recursive `_processNode` method starting with the `rootProcessedNode`. Finally, it appends the RTF footer and joins all the collected RTF snippets into a single string.

### 5.2 `_processNode` Method

This recursive method traverses the `ProcessedGraphNode` tree:

*   **Indentation**: It calculates the indentation for each node based on its `rtfLevel` and a base indent size (0.5 inches per level). Topics also have a hanging indent for their numbers.
*   **Node Type Formatting**: It uses a `switch` statement on `node.type` to apply specific RTF formatting (bold, font size, centering) and structure the output for Central Topics, Topics, Paragraphs, and Referenced Texts.
*   **Hierarchical Numbering**: For Topic nodes, it calls `_getTopicNumber` to generate the correct hierarchical number (e.g., "1.", "1.1.", "1.1.1.").
*   **Content Inclusion**: It includes the node's `title` (for Topics, Central Topics, Paragraphs) or `textContent` (for Referenced Texts). For Referenced Texts, it also includes the linked paper title if available. Multi-line text content is handled by splitting lines and joining them with RTF paragraph breaks (`\par`).
*   **Recursion**: After processing a node, it recursively calls `_processNode` for each of its children.

### 5.3 `_getTopicNumber` Method

This method manages an array (`topicCounters`) to keep track of the current number at each level of the hierarchy. When called for a specific `topicRtfLevel`, it increments the counter for that level and resets counters for any deeper levels. It then constructs the hierarchical number string by joining the counters up to the current level with periods.

### 5.4 `_escapeRtfText` Method

This utility method ensures that special characters in node text content (`\`, `{`, `}`) are properly escaped for RTF format to prevent syntax errors in the generated document.

## 6. File Download

After the RTF string is generated, the `exportGraphToRtf` function creates a `Blob` from the string, generates a download link with a sanitized filename, and programmatically clicks the link to trigger the file download in the user's browser.

## 7. Integration Points

*   **`App.jsx`**: The `handleExportRtfFromMenu` function in `App.jsx` is the primary integration point, calling `exportGraphToRtf` with the root node's `elementId`.
*   **`neo4jConnection.js`**: The `executeQuery` function is used by `GraphDataProcessor` to interact with the database.

This detailed process ensures that the RTF export accurately reflects the hierarchical structure of the graph data, providing a well-formatted document for the user.