# Plan: Node Sequence Numbering

**Goal:** Implement hierarchical sequence numbering for `Topic` nodes, displayed like a mind map (e.g., "1.", "1.1.", "1.1.2."), editable in the node popup, with automatic reordering and persistence in Neo4j.

**I. Data Model Changes (Neo4j & Client-side)**

1.  **Neo4j Node Property:**
    *   Add a new integer property, `siblingOrder`, to the `Topic` nodes in Neo4j.
    *   This property will store the 1-based sequence number of a topic among its direct siblings under the same parent.
    *   The `CentralTopic` node will not have this property.
2.  **Client-side Node Data:**
    *   The client-side representation of `Topic` nodes (in React Flow and general state management) will also include this `siblingOrder` property.
    *   A derived property, `displayNumber` (e.g., "1.2.3."), will be calculated on the client-side for display purposes.

**II. Backend (Neo4j Cypher Queries & Logic)**

1.  **Creating New Topic Nodes:**
    *   When a new `Topic` node is created as a child of the `CentralTopic` or another `Topic` (via a `HAS_TOPIC` relationship):
        *   A Cypher query will determine the maximum `siblingOrder` among existing children of that parent.
        *   The new `Topic` will be assigned `siblingOrder = max_existing_order + 1`. If no siblings exist, it gets `siblingOrder = 1`.
2.  **Updating `siblingOrder` (Manual Edit):**
    *   When a user edits the sequence number of a `Topic` in the popup:
        *   Let the target `Topic` be `T_target` and its desired new `siblingOrder` be `N_new`.
        *   Let its parent be `P`.
        *   **Query 1:** Get all current children of `P`, ordered by `siblingOrder`.
        *   **Logic (Client or Backend):**
            *   Identify the `Topic` currently at `N_new` (if any), let's call it `T_current_at_N`.
            *   If `T_target` is moved to an `N_new` that is *smaller* than its current `siblingOrder`:
                *   All siblings between `N_new` and `T_target`'s old position (inclusive of `T_current_at_N`) will have their `siblingOrder` incremented by 1.
            *   If `T_target` is moved to an `N_new` that is *larger* than its current `siblingOrder`:
                *   All siblings between `T_target`'s old position and `N_new` (inclusive of `T_current_at_N`) will have their `siblingOrder` decremented by 1.
            *   `T_target`'s `siblingOrder` is then set to `N_new`.
        *   **Query 2 (Batch Update):** Update the `siblingOrder` for all affected sibling nodes in a single transaction.
3.  **Deleting Topic Nodes:**
    *   When a `Topic` node is deleted:
        *   Let the deleted `Topic` be `T_deleted` with `siblingOrder = N_deleted` under parent `P`.
        *   All siblings of `T_deleted` under `P` that have `siblingOrder > N_deleted` must have their `siblingOrder` decremented by 1.
        *   This needs to be handled in the Cypher query that deletes the node and its relationships.
4.  **Fetching Topic Nodes:**
    *   When fetching `Topic` nodes, ensure they are fetched along with their `siblingOrder`.
    *   To reconstruct the hierarchy and full `displayNumber` on the client, queries will need to fetch paths or allow traversal from `CentralTopic` down through `HAS_TOPIC` relationships.

**III. Frontend (React Components & Logic)**

1.  **`EditNodeModal.jsx` Modifications:**
    *   For `Topic` nodes, add a new input field for `siblingOrder`.
    *   This field should likely be a number input.
    *   Validation: Ensure the input is a positive integer. The maximum value could be capped by the number of siblings.
    *   On save, the `handleUpdateNode` function in `App.jsx` will need to be extended to trigger the backend logic for updating `siblingOrder` and reordering siblings.
2.  **`App.jsx` (or relevant state management):**
    *   **Hierarchy Construction & `displayNumber` Calculation:**
        *   After fetching nodes from Neo4j, implement logic to traverse the `HAS_TOPIC` relationships starting from the `CentralTopic`.
        *   For each `Topic` node, recursively build its full `displayNumber` string (e.g., "1.", "1.1.", "1.2.1.") based on its `siblingOrder` and its parent's `displayNumber`.
        *   The `CentralTopic` is the unnumbered root. Its direct children start with "1.", "2.", etc.
    *   **Node Rendering (`TopicNode` component):**
        *   Modify the `TopicNode` component (defined in `App.jsx` or potentially moved to its own file) to display the calculated `displayNumber` before the node's label (e.g., "1.2. My Topic Label").
    *   **State Updates:** Ensure that after any operation (create, update `siblingOrder`, delete), the local React Flow state for nodes (including their `siblingOrder` and derived `displayNumber`) is correctly updated to reflect changes from the database. This might involve re-fetching parts of the graph or intelligently updating the client-side data.
    *   **New Node Creation Logic:**
        *   When a new `Topic` is added, the client will send the parent ID to the backend. The backend assigns the `siblingOrder`. The client then re-fetches or updates to get the new node with its `siblingOrder`.
3.  **Displaying Nodes in Order:**
    *   React Flow renders nodes based on the `nodes` array. To ensure topics under a parent are visually grouped or can be easily perceived in order, the client-side logic that prepares nodes for React Flow should sort sibling `Topic` nodes by their `siblingOrder` before passing them to the React Flow component if a specific visual order is desired beyond React Flow's default layout.

**IV. Workflow Diagram (Mermaid)**

```mermaid
graph TD
    A[User Action: Edit Sibling Order in Popup] --> B{Node Type = Topic?};
    B -- Yes --> C[Get Target Topic (T_target), New Order (N_new), Parent (P)];
    C --> D[Client: Send Update Request to Backend (T_target_id, N_new)];
    D --> E[Backend: Start Transaction];
    E --> F[Fetch Siblings of T_target under P, ordered by siblingOrder];
    F --> G[Calculate Sibling Order Changes];
    G --> H[Update siblingOrder for T_target and affected siblings in Neo4j];
    H --> I[Backend: Commit Transaction];
    I --> J[Backend: Send Success/Failure to Client];
    J --> K[Client: Update React Flow State (re-fetch or optimistic update)];
    K --> L[Re-calculate displayNumbers for affected branch];
    L --> M[Re-render Nodes];
    B -- No --> N[Normal Node Update Logic];

    U[User Action: Create New Topic] --> V[Specify Parent (P_new)];
    V --> W[Client: Send Create Request (Parent_id, new_topic_data)];
    W --> X[Backend: Start Transaction];
    X --> Y[Determine max siblingOrder under P_new];
    Y --> Z[Assign siblingOrder = max_order + 1 to new Topic];
    Z --> AA[Create new Topic node with HAS_TOPIC from P_new in Neo4j];
    AA --> AB[Backend: Commit Transaction];
    AB --> AC[Backend: Send new Topic data (with ID & siblingOrder) to Client];
    AC --> K;
```

**V. Considerations & Potential Challenges**

*   **Performance:** For very large hierarchies, recursively calculating `displayNumber` on the client or complex reordering queries could have performance implications. Optimize Cypher queries and client-side logic.
*   **Concurrency:** If multiple users can edit the structure simultaneously, optimistic locking or more robust conflict resolution might be needed. Assume single-user context for now.
*   **Error Handling:** Robust error handling for database operations and client-side logic is crucial.
*   **Transaction Management:** All database modifications for reordering must occur within a single transaction to ensure data integrity.
*   **Initial Data Migration:** If there are existing `Topic` nodes, a one-time script might be needed to assign an initial `siblingOrder` to them.