# Plan: Bidirectional Text References Feature

**Version:** 1.0
**Date:** 2025-05-08

## 1. Overview and Goal

This document outlines the plan to implement a bidirectional text referencing feature within the web application. Users will be able to select a segment of text within a document (e.g., PDF), create a 'reference node' from this selection, have the original text visually marked, and navigate from the reference node back to the specific location in the source document.

**Key Objectives:**

1.  Allow users to select text in the primary document viewer.
2.  Enable the creation of a 'reference node' (as part of the existing `reactflow` graph) based on this selection.
3.  Visually and persistently mark the selected text in the source document.
4.  Provide a mechanism on the reference node to navigate back to the marked text in the source document.

**Initial Simplification:** For the first iteration, navigation will focus on jumping to the correct page. Highlighting upon navigation back will be attempted via text search of the stored snippet, while the persistent marking on the source document will aim for greater precision if possible.

## 2. Core Components Involved

*   **Document Viewer (e.g., `PdfWorkspace.jsx` or similar):** Component responsible for displaying document content (extracted text or rendered PDF) and handling text selection.
*   **Reactflow Graph:** Where the new 'reference nodes' will be created and displayed.
*   **Node Creation/Edit Modal (e.g., `EditNodeModal.jsx`):** UI for creating/editing the properties of the reference node.
*   **Neo4j Database:** To store metadata for reference nodes, including links to source documents and information about the selected text (page, text snippet, positional data if available).

## 3. Detailed Workflow and Implementation Steps

### Step 1: Text Selection and Reference Creation Trigger

1.  **Capture Text Selection:**
    *   In the document viewer, implement logic to capture user text selections.
    *   **Data to be captured from selection:**
        *   `sourceDocumentId`: The identifier of the currently viewed document.
        *   `selectedText`: The actual string of text selected by the user.
        *   `sourcePageNumber`: The page number where the selection starts/occurs.
        *   `sourcePositionData` (Optional for V1, Ideal for V2+): If feasible with the PDF viewing component (e.g., `pdfjs-dist` text layer interaction), capture bounding box coordinates or precise character offsets of the selection. For V1, this might be less precise or omitted if focusing on text-search highlighting.
2.  **Initiate Reference Creation:**
    *   Upon text selection, provide a user action to create a reference.
    *   **Recommended UI:** A context menu option (e.g., "Create Reference from Selection") appearing on right-click over selected text.
    *   This action should trigger the opening of the node creation modal.

### Step 2: Reference Node Creation and Data Storage

1.  **Reference Node Properties:**
    *   When the node creation modal opens, it should be pre-populated or receive the captured selection data.
    *   The user can name the reference node and add other relevant details.
2.  **Neo4j Data Model for Reference Node:**
    *   Create a new node in Neo4j (e.g., label `:ReferenceNode` or a specialized type inheriting from a base node type).
    *   **Properties to store:**
        *   `id`: Unique ID for the reference node.
        *   `name` or `title`: User-defined name for the reference.
        *   `type`: "Reference" (or similar to distinguish it).
        *   `sourceDocumentId`: (from captured data)
        *   `sourcePageNumber`: (from captured data)
        *   `sourceSelectedText`: (from captured data)
        *   `sourcePositionData`: (from captured data, if available)
        *   `createdAt`, `updatedAt` timestamps.
    *   **Relationships:**
        *   Create a relationship (e.g., `:HAS_REFERENCE_TO { type: 'textSelection' }`) from the source document's node to the new `:ReferenceNode`.
        *   Alternatively, or in addition, a relationship from the `:ReferenceNode` to the source document node (e.g., `:REFERENCES_DOCUMENT`).

### Step 3: Visual and Persistent Marking of Source Text

1.  **Marking Logic:**
    *   When a reference is created, the original selected text in the source document viewer needs to be visually marked (e.g., a persistent highlight color).
2.  **Persistence Strategy:**
    *   The information required to re-apply this mark (`sourceDocumentId`, `sourcePageNumber`, `sourceSelectedText`, and ideally `sourcePositionData`) is stored in the reference node in Neo4j.
3.  **Applying Marks on Document Load:**
    *   When a document is loaded into the viewer:
        *   Query Neo4j for all `:ReferenceNode`s linked to this `sourceDocumentId`.
        *   For each reference found:
            *   Retrieve its `sourcePageNumber`, `sourceSelectedText`, and `sourcePositionData` (if available).
            *   On the corresponding page, apply the visual mark.
                *   **If using extracted text display:** Wrap the identified text (found via `sourceSelectedText` or `sourcePositionData` like character offsets) in a `<span>` with a specific CSS class for highlighting.
                *   **If using `pdfjs-dist`:** This is more complex.
                    *   **V1 (Text-search based):** On the target page, search for the `sourceSelectedText` and highlight its occurrences.
                    *   **V2+ (Coordinate-based):** If `sourcePositionData` (coordinates) were captured, use these to draw an overlay highlight on the PDF canvas or interact with `pdfjs-dist` annotation layers.

### Step 4: Bidirectional Navigation ("Open Reference" Button)

1.  **UI in Reference Node:**
    *   When a reference node is selected or its edit modal is open in the `reactflow` graph:
        *   Display a button labeled "Open Reference" (or similar).
2.  **Navigation Action:**
    *   On clicking "Open Reference":
        *   Retrieve `sourceDocumentId`, `sourcePageNumber`, `sourceSelectedText`, and `sourcePositionData` (if available) from the reference node's data.
        *   **Viewer Logic:**
            1.  Load the document specified by `sourceDocumentId` into the primary document viewer if it's not already active.
            2.  Navigate the viewer to the `sourcePageNumber`.
            3.  **Scroll & Highlight (V1 - Text Search):**
                *   Attempt to find the `sourceSelectedText` on the current page.
                *   Scroll the view to the first occurrence of this text.
                *   Temporarily emphasize its highlight (e.g., a brief animation or brighter color).
            4.  **Scroll & Highlight (V2+ - Positional):**
                *   If `sourcePositionData` is available, use it to scroll directly to the precise location.
                *   Ensure the persistent highlight is clearly visible, perhaps with temporary emphasis.

## 4. Technical Considerations and Challenges

*   **Text Selection Accuracy:** Capturing the *intended* selection reliably, especially across multiple lines or complex layouts in PDFs, can be challenging.
*   **Positional Data Robustness (for V2+):**
    *   PDF coordinates can be complex.
    *   Text flow and rendering in PDFs can make exact coordinate mapping difficult.
*   **Highlighting Overlaps:** If multiple references originate from overlapping text selections, how will the highlights be displayed?
*   **Performance:** Applying many highlights to a document or searching for text on page navigation needs to be performant.
*   **State Management:** Managing the state of selected text, active highlights, and navigation targets across different components (document viewer, reactflow graph, modals).

## 5. Future Enhancements (Post V1)

*   More precise, coordinate-based highlighting and navigation.
*   Allowing users to customize highlight colors.
*   Handling references that span multiple pages.
*   Preview snippets of referenced text directly on the reference node in the graph.

This plan provides a phased approach, starting with core functionality and allowing for more sophisticated enhancements later.