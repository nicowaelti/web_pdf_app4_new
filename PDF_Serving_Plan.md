# Plan: Local PDF Management and Serving for Web Application

**Version:** 1.0
**Date:** 2025-05-08

## 1. Overview and Goal

This document outlines the plan for a secure and robust server-side solution enabling a web application (React frontend) to display PDF documents. The PDFs are associated with specific entities (e.g., 'paper nodes') in the user interface.

This solution is designed for **local-only use**, meaning the application and its components will run on a single machine and will not be exposed to the internet. User authentication is therefore not a primary concern for this setup.

The core goal is to allow the React frontend (running in a browser) to access and render PDF files stored on the local computer's file system, facilitated by a minimal local backend server.

## 2. Core Components

The system will consist of the following components:

1.  **React Frontend (Existing):** The user-facing web application built with React and Vite. It displays 'paper nodes' and will provide links/buttons to open associated PDFs. It uses `pdfjs-dist` for client-side PDF rendering capabilities.
2.  **Neo4j Database (Existing):** Stores graph data, including 'paper nodes' and their metadata. It will be used to store a reference (e.g., the filename) to the PDF associated with each 'paper node'.
3.  **Local PDF File Storage (New):** A designated directory on the local computer's file system where the actual PDF files will be stored.
4.  **Node.js/Express Backend Server (New - `pdf-server`):** A lightweight, local server application. Its primary responsibilities are:
    *   To receive requests from the React frontend for specific PDF files.
    *   To securely read the requested PDF file from the Local PDF File Storage.
    *   To stream the PDF content back to the React frontend.

## 3. Workflow

```mermaid
graph TD
    A[React Frontend in Browser] -- HTTP Request for PDF (e.g., GET /api/pdfs/{filename}) --> B(Local Node.js/Express Backend @ http://localhost:PORT);
    B -- Reads PDF file from --> C[Local File System (PDF Storage Directory) using {filename}];
    C -- PDF file content --> B;
    B -- HTTP Response with PDF content (Content-Type: application/pdf) --> A;
    A -- Renders PDF (e.g., using pdfjs-dist or iframe) --> D[User Sees PDF];

    subgraph Data Source for Filename
        E[Neo4j Database] -. Stores PDF Filename .-> F(React Frontend Data for 'Paper Node')
        F -. Provides {filename} for request .-> A
    end
```

**Explanation:**

1.  The React frontend, when a user wants to view a PDF for a 'paper node', retrieves the PDF's filename (which is assumed to be stored as metadata with the 'paper node' data, originally sourced from Neo4j).
2.  The frontend constructs a URL (e.g., `http://localhost:3001/api/pdfs/example.pdf`) and makes an HTTP GET request to the local Node.js/Express backend server.
3.  The backend server receives the request, extracts the `filename` from the URL.
4.  It securely constructs the full path to the PDF file within the pre-configured Local PDF File Storage directory.
5.  The backend reads the file and streams its content back to the frontend with the appropriate `Content-Type: application/pdf` header.
6.  The React frontend receives the PDF content and renders it.

## 4. Detailed Component Setup and Configuration

### 4.1. Local PDF File Storage

*   **Action:** Create a dedicated directory on your local machine to store all PDF files.
    *   **Example Windows:** `C:\MyProjectData\PDFs\`
    *   **Example macOS/Linux:** `/Users/YourName/Documents/MyProjectPDFs/`
*   **Important:** This path will be configured in the Node.js/Express backend server.

### 4.2. Neo4j Database

*   **Assumption:** Your 'paper nodes' (or equivalent entities) in Neo4j will have a property that stores the filename of the associated PDF.
*   **Example Cypher to add/update a PDF filename for a node:**
    ```cypher
    MATCH (p:PaperNode {id: 'some_unique_node_id'})
    SET p.pdfFilename = 'actual_filename_on_disk.pdf'
    RETURN p
    ```
*   The React frontend will fetch this `pdfFilename` property when loading data for 'paper nodes'.

### 4.3. Node.js/Express Backend Server (`pdf-server`)

This will be a new, separate Node.js project.

*   **Project Directory:** Create a new folder named `pdf-server`.
*   **`package.json`:**
    Initialize npm and install dependencies:
    ```bash
    cd pdf-server
    npm init -y
    npm install express cors dotenv
    ```
    Your `pdf-server/package.json` should look similar to this:
    ```json
    {
      "name": "pdf-server",
      "version": "1.0.0",
      "description": "Minimal server to serve PDFs locally",
      "main": "server.js",
      "scripts": {
        "start": "node server.js"
      },
      "dependencies": {
        "cors": "^2.8.5",
        "dotenv": "^16.3.1", // Use latest
        "express": "^4.18.2"  // Use latest
      },
      "type": "module" // Recommended for import/export syntax
    }
    ```

*   **`.env` Configuration File (`pdf-server/.env`):**
    Create this file to store configuration:
    ```ini
    # Path to the directory where your PDF files are stored
    PDF_STORAGE_PATH=/Users/YourName/Documents/MyProjectPDFs/ # <-- IMPORTANT: CHANGE THIS TO YOUR ACTUAL PATH

    # Port for the PDF server to listen on
    SERVER_PORT=3001
    ```
    **Note:** Ensure `SERVER_PORT` does not conflict with your React app's port (Vite default is 5173) or Neo4j's port (default Bolt is 7687).

*   **`server.js` (Main Application File - `pdf-server/server.js`):**
    ```javascript
    // server.js
    import express from 'express';
    import cors from 'cors';
    import path from 'path';
    import fs from 'fs';
    import { fileURLToPath } from 'url';
    import dotenv from 'dotenv';

    dotenv.config();

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const PDF_STORAGE_PATH = process.env.PDF_STORAGE_PATH;
    const PORT = process.env.SERVER_PORT || 3001;

    if (!PDF_STORAGE_PATH) {
        console.error("FATAL ERROR: PDF_STORAGE_PATH is not defined in .env file or environment variables.");
        console.error("Please create a .env file in the pdf-server directory with PDF_STORAGE_PATH=/your/actual/path/to/pdfs");
        process.exit(1);
    }

    if (!fs.existsSync(PDF_STORAGE_PATH) || !fs.lstatSync(PDF_STORAGE_PATH).isDirectory()) {
        console.error(`FATAL ERROR: PDF_STORAGE_PATH "${PDF_STORAGE_PATH}" does not exist or is not a directory.`);
        process.exit(1);
    }

    const app = express();

    // Enable CORS for all routes (suitable for local development)
    app.use(cors());

    // API Endpoint to Serve PDFs
    // Example: GET http://localhost:3001/api/pdfs/my-document.pdf
    app.get('/api/pdfs/:filename', (req, res) => {
        const { filename } = req.params;

        // Basic sanitization: prevent directory traversal using filename itself
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            console.warn(`Attempt to access potentially malicious path with filename: ${filename}`);
            return res.status(400).send('Invalid filename.');
        }
        
        const requestedPath = path.join(PDF_STORAGE_PATH, filename);
        
        // Normalize and then check if it's still within the storage path
        // This is a more robust check against path traversal
        const normalizedPdfStoragePath = path.normalize(PDF_STORAGE_PATH + path.sep);
        const normalizedRequestedPath = path.normalize(requestedPath);

        if (!normalizedRequestedPath.startsWith(normalizedPdfStoragePath)) {
            console.warn(`Access attempt outside designated PDF directory: ${filename} (resolved to ${normalizedRequestedPath})`);
            return res.status(403).send('Forbidden: Access to this path is not allowed.');
        }

        if (fs.existsSync(normalizedRequestedPath)) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`); // Shows original filename to user

            const fileStream = fs.createReadStream(normalizedRequestedPath);
            fileStream.pipe(res);

            fileStream.on('error', (err) => {
                console.error('Error streaming file:', err);
                if (!res.headersSent) {
                    res.status(500).send('Error streaming file');
                }
            });
        } else {
            console.log(`PDF not found: ${filename} (resolved to ${normalizedRequestedPath})`);
            res.status(404).send('PDF not found');
        }
    });

    app.listen(PORT, () => {
        console.log(`PDF Server listening on http://localhost:${PORT}`);
        console.log(`Serving PDFs from: ${PDF_STORAGE_PATH}`);
    });
    ```

### 4.4. React Frontend Integration

*   **Fetching PDF Filename:** Ensure your React components that display 'paper nodes' have access to the `pdfFilename` property associated with each node (fetched from Neo4j).
*   **Constructing PDF URL:** When a user clicks to open a PDF:
    ```javascript
    // Example in a React component
    // Assume 'nodeData.pdfFilename' holds the filename like "report.pdf"
    const pdfFileName = nodeData.pdfFilename;
    const serverPort = process.env.REACT_APP_PDF_SERVER_PORT || 3001; // Configure if needed, or hardcode
    const pdfUrl = `http://localhost:${serverPort}/api/pdfs/${encodeURIComponent(pdfFileName)}`;

    // Option 1: Open in an iframe
    // <iframe src={pdfUrl} width="100%" height="600px" title="PDF Viewer"></iframe>

    // Option 2: Open in a new tab
    // <button onClick={() => window.open(pdfUrl, '_blank')}>Open PDF</button>

    // Option 3: Use with pdfjs-dist
    // (Requires fetching the blob and then passing to pdfjs-dist viewer)
    ```

## 5. Running the System

To run the complete application locally:

1.  **Start Neo4j Database:** Ensure your Neo4j instance is running.
2.  **Start the React Frontend Development Server:**
    *   Navigate to your React project directory (`web-pdf-app4`).
    *   Run `npm run dev` (or your usual start command). This typically starts on `http://localhost:5173`.
3.  **Start the Node.js/Express PDF Server:**
    *   Navigate to the `pdf-server` directory.
    *   Run `npm start`. This will start the server, typically on `http://localhost:3001` (as per `.env` config).

All three components must be running simultaneously.

## 6. Key Security Consideration (Local Focus)

*   **Path Traversal Prevention:** The `server.js` for the PDF backend includes checks to prevent requests from accessing files outside the designated `PDF_STORAGE_PATH`. This is the most critical security aspect for this local server.
    *   `if (filename.includes('..') || filename.includes('/') || filename.includes('\\'))` provides a basic check.
    *   The `path.normalize()` and `startsWith()` check is more robust.

## 7. Future Considerations

*   **PDF Identifier vs. Filename:** If direct filenames become cumbersome or you need more flexibility (e.g., storing files with system-generated UUIDs), you could modify the backend to accept a unique ID. The backend would then query Neo4j to map this ID to the actual filename/path on disk before serving the file.
*   **Error Handling & Logging:** The current backend has basic error handling. This could be enhanced for more detailed diagnostics if issues arise.

This plan provides a comprehensive approach to integrating local PDF viewing into your React and Neo4j application.