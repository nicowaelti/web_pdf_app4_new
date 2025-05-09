# Technical Design Document: RTF Graph Export

**1. Overview**

This document outlines the technical design for a feature to export a hierarchical representation of graph data (sourced from Neo4j) into an RTF (Rich Text Format) document. The export will start from a user-selected root node and include Topics, Paragraphs, ReferencedText, and associated Paper titles in a structured, numbered, and indented format.

**2. Core Requirements Recap**

*   Hierarchical export: `CentralTopic` -> `Topic` -> `Paragraph` -> `ReferencedText`.
*   Content:
    *   `CentralTopic`: Name as document title/main heading.
    *   `Topic`: Name as numbered heading (e.g., 1.1, 1.2).
    *   `Paragraph`: `Statement` as a labeled/numbered sub-heading (e.g., Paragraph 1), followed by its references.
    *   `ReferencedText`: Full `text` content.
    *   `Paper`: `title` included in parentheses alongside its `ReferencedText`.
*   Formatting: Hierarchical numbering, indentation, multi-paragraph support within `ReferencedText`.
*   Data Source: Neo4j, queried via existing `executeQuery`.
*   Initiation: User selects a root node in the UI.
*   Output: A downloadable .rtf file.

**3. Data Structures (Internal to RTF Exporter)**

The raw data from Neo4j (a flat list of subject-predicate-object triples) needs to be transformed into a hierarchical structure suitable for RTF generation.

**A. `ProcessedGraphNode` Interface/Type (TypeScript example)**

This will represent each node in our internal hierarchical tree.

```typescript
interface ProcessedGraphNode {
  id: string; // Unique identifier (e.g., elementId from Neo4j)
  type: 'CentralTopic' | 'Topic' | 'Paragraph' | 'ReferencedText' | 'Paper';
  properties: Record<string, any>; // All properties from Neo4j node
  children: ProcessedGraphNode[];
  siblingOrder: number | null; // From 'siblingOrder' property, for sorting
  rtfLevel: number; // Calculated depth for numbering and indentation
  // Optional, specific content fields for easier access
  title?: string; // e.g., Topic.name, Paragraph.Statement, Paper.title
  textContent?: string; // e.g., ReferencedText.text
}
```

**B. Hierarchical Tree Structure**

The `GraphDataProcessor` (see section 4.A) will build a tree where the root is the user-selected node, and children are ordered by `siblingOrder`. Each node in this tree will be an instance of `ProcessedGraphNode`.

**4. RTF Export Module Components**

This module will be responsible for fetching data, processing it, and generating the RTF content.

**A. `GraphDataProcessor`**

*   **Responsibility**:
    1.  Receive the ID of the user-selected root node.
    2.  Construct and execute the necessary Cypher query (potentially a modified version of the one provided, or a series of queries) to fetch the root node and all its relevant descendants (Topics, Paragraphs, ReferencedText, and linked Papers) down to the required depth. This might involve a recursive traversal query or a query that fetches all relevant paths from the selected root.
    3.  Parse the flat list of records returned by `executeQuery`.
    4.  Assemble the `ProcessedGraphNode` objects.
    5.  Build the hierarchical tree structure, linking parents and children based on relationships (`HAS_TOPIC`, `HAS_PARAGRAPH`, `CITES`, `HAS_REFERENCE`) and ordering children using the `siblingOrder` property.
    6.  Calculate `rtfLevel` for each node.
*   **Input**: Root node ID.
*   **Output**: The root `ProcessedGraphNode` of the constructed hierarchy.

**B. `RtfBuilder`**

*   **Responsibility**:
    1.  Take the hierarchical tree of `ProcessedGraphNode`s as input.
    2.  Traverse the tree (likely depth-first).
    3.  Generate RTF control words and text content for each node according to its type and the specified output structure.
    4.  Implement hierarchical numbering (e.g., 1., 1.1., 1.1.1. for Topics; "Paragraph X" for Paragraphs; "Reference Y" for ReferencedText).
    5.  Apply appropriate indentation for each level.
    6.  Handle multi-paragraph text within `ReferencedText.text` (converting newlines to RTF paragraph marks `\par`).
    7.  Format titles/headings (e.g., bold).
*   **Input**: The root `ProcessedGraphNode` of the hierarchy.
*   **Output**: A string containing the complete RTF document content.
*   **Key RTF Elements to Use**:
    *   `{\rtf1\ansi\deff0 ... }`: Basic RTF document structure.
    *   `{\fonttbl ...}`: Font table (e.g., Arial, Times New Roman).
    *   `{\colortbl ...}`: Color table (if needed, default is black).
    *   `\pard`: Resets paragraph formatting to default.
    *   `\ql`, `\qr`, `\qc`, `\qj`: Left, right, center, justified alignment.
    *   `\liN`, `\riN`: Left indent, right indent (N is in twips; 1 inch = 1440 twips).
    *   `\fiN`: First line indent.
    *   `\b`: Bold text. `\b0`: Turn off bold.
    *   `\i`: Italic text. `\i0`: Turn off italic.
    *   `\fsN`: Font size (N is in half-points).
    *   `\par`: New paragraph.
    *   `\tab`: Tab character.
    *   Unicode characters: `\uNNNN?` for characters not in ANSI.

**C. Main Export Function (e.g., `exportGraphToRtf(rootNodeId)`)**

*   **Responsibility**:
    1.  Orchestrate the export process.
    2.  Instantiate/call `GraphDataProcessor` to get the hierarchical data.
    3.  Instantiate/call `RtfBuilder` to generate the RTF string.
    4.  Trigger the file download (see Section 6).
*   **Input**: `rootNodeId`.
*   **Output**: Initiates a file download.

**5. RTF Export Format Specification (Key Aspects)**

*   **Document Structure**: Standard RTF header, font table, color table (optional).
*   **Numbering System**:
    *   `CentralTopic` (if it's the root and has a `name`): Large, bold, centered title. No number.
    *   `Topic` nodes:
        *   Level 1: 1., 2., 3. (e.g., `\b Topic 1. \b0 Topic Name`)
        *   Level 2: 1.1., 1.2., 1.3. (e.g., `\pard\li720\fi-360\b 1.1. \b0 Topic Name\par`) (Indentation example)
        *   And so on for deeper topic nesting.
    *   `Paragraph` nodes:
        *   Under a Topic: "Paragraph 1", "Paragraph 2" (e.g., `\pard\li1440\b Paragraph 1: \b0 Paragraph Statement\par`)
    *   `ReferencedText` nodes:
        *   Under a Paragraph: "Reference 1", "Reference 2" (e.g., `\pard\li2160 Reference 1: Referenced Text Content... (Paper: Paper Title)\par`)
*   **Indentation**: Each level of the hierarchy will be indented further than its parent.
    *   Level 0 (CentralTopic title): No indent.
    *   Level 1 (Top-level Topics): e.g., 0.5 inch left indent for numbering.
    *   Level 2 (Sub-Topics): e.g., 1.0 inch left indent for numbering.
    *   Paragraphs under Topics: e.g., 1.5 inch left indent.
    *   References under Paragraphs: e.g., 2.0 inch left indent.
    *(Specific twip values for `\li` will need to be chosen)*
*   **Multi-paragraph Support**: Newlines in `ReferencedText.text` should be converted to `\par` in RTF.
*   **Formatting**:
    *   Topic names: Bold.
    *   Paragraph "Statement": Bold or distinct.
    *   ReferencedText: Plain.
    *   Paper titles: Plain, perhaps italic, within parentheses.

**6. File Format Handling**

*   The `RtfBuilder` produces a string.
*   This string will be used to create a Blob: `new Blob([rtfString], { type: 'application/rtf' })`.
*   A temporary `<a>` element will be created, its `href` set to `URL.createObjectURL(blob)`, its `download` attribute set to a suitable filename (e.g., `export-${rootNodeName}.rtf`), and then `click()` will be called on it to trigger the browser's download mechanism.
*   `URL.revokeObjectURL()` should be called after the download is initiated.

**7. Integration Points with Existing Codebase**

*   **UI for Export Initiation**:
    *   A button or context menu option (e.g., "Export to RTF") will be added to the UI where graph nodes are displayed (likely in [`src/components/workspace/FlowWorkspace.jsx`](src/components/workspace/FlowWorkspace.jsx:0) or a context menu component like [`src/components/workspace/ContextMenu.jsx`](src/components/workspace/ContextMenu.jsx:0)).
    *   This UI element, when activated for a selected node, will call the main export function, passing the `elementId` of the selected node.
*   **Data Fetching**:
    *   The `GraphDataProcessor` will use the existing `executeQuery` function from [`src/utils/neo4jConnection.js`](src/utils/neo4jConnection.js:0) to fetch data from Neo4j.
*   **Error Handling**:
    *   Errors during Neo4j query execution should be caught and reported to the user (e.g., via a toast notification).
    *   Errors during data processing or RTF generation should also be handled gracefully.

**8. Potential Challenges & Considerations**

*   **Complex/Cyclic Graph Structures**: The current Cypher query fetches triples. The `GraphDataProcessor` must correctly reconstruct the intended hierarchy and handle any potential cycles if `HAS_TOPIC` relationships could form them (though the `siblingOrder` implies a tree-like structure for children of a given node). The export should focus on a tree traversal from the selected root.
*   **Data Volume**: Exporting very large subgraphs could be resource-intensive both for data fetching/processing and for generating a large RTF string. Consider if any limits or optimizations are needed (though for typical document sections, this might not be an issue).
*   **RTF Complexity**: RTF can be finicky. Thorough testing with various RTF viewers (MS Word, LibreOffice, TextEdit) is crucial. Start with basic formatting and add complexity iteratively.
*   **Query Optimization**: The Cypher query might need refinement to efficiently fetch all necessary data for a given subgraph starting from a root node ID. For example, using `OPTIONAL MATCH` for deeper parts of the hierarchy or ensuring all relevant node types and their properties are captured.
*   **Sorting**: Ensure `siblingOrder` is consistently used to sort children at each level of the hierarchy. Handle cases where `siblingOrder` might be missing or null.

**9. Mermaid Diagram of Key Components**

```mermaid
graph TD
    A[User Interaction UI <br> (e.g., FlowWorkspace, ContextMenu)] -- 1. rootNodeId --> B(RTF Export Module);
    B -- 2. rootNodeId --> C(GraphDataProcessor);
    C -- 3. Cypher Query --> D([`neo4jConnection.js` <br> executeQuery]);
    D -- 4. Raw Neo4j Records --> C;
    C -- 5. Hierarchical ProcessedGraphNode Tree --> E(RtfBuilder);
    E -- 6. RTF String --> B;
    B -- 7. Trigger Download --> F(Browser File Download);

    subgraph "RTF Export Module"
        direction LR
        C
        E
    end

    style A fill:#lightgrey,stroke:#333,stroke-width:2px
    style D fill:#lightblue,stroke:#333,stroke-width:2px
    style F fill:#lightgreen,stroke:#333,stroke-width:2px
```

**10. Next Steps (Implementation Plan Outline)**

1.  **Setup**: Create a new module/directory for the RTF export feature.
2.  **`GraphDataProcessor` Implementation**:
    *   Develop logic to transform flat Neo4j records into the `ProcessedGraphNode` tree.
    *   Focus on correctly interpreting relationships (`HAS_TOPIC`, `HAS_PARAGRAPH`, `CITES`, `HAS_REFERENCE`) and using `siblingOrder`.
    *   Refine Cypher query if needed to ensure all data for a subtree is fetched efficiently.
3.  **`RtfBuilder` Implementation (Iterative)**:
    *   Start with basic RTF structure (header, one topic).
    *   Implement hierarchical numbering and indentation for Topics.
    *   Add Paragraph formatting.
    *   Add ReferencedText and Paper title inclusion.
    *   Handle multi-paragraph content within `ReferencedText`.
    *   Test output frequently in an RTF viewer.
4.  **Main Export Function & File Download**: Implement the orchestration and download logic.
5.  **UI Integration**: Add the "Export to RTF" option in the relevant UI component.
6.  **Testing**:
    *   Test with various graph structures (simple, nested, missing `siblingOrder`).
    *   Test with different content types and lengths.
    *   Test across different RTF viewers.
7.  **Error Handling**: Implement robust error reporting.