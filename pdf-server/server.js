// server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import process from 'node:process'; // Import process

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