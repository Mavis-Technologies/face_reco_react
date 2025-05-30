// face-portal-backend/server.js
require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');

const app = express();

// --- HTTPS Configuration (existing code) ---
const SSL_PRIVATE_KEY_PATH = process.env.SSL_PRIVATE_KEY_PATH || '/path/to/your/privkey.pem';
const SSL_FULLCHAIN_CERT_PATH = process.env.SSL_FULLCHAIN_CERT_PATH || '/path/to/your/fullchain.pem';

let serverCredentials = {};
let useHttps = false;

try {
    if (fs.existsSync(SSL_PRIVATE_KEY_PATH) && fs.existsSync(SSL_FULLCHAIN_CERT_PATH)) {
        serverCredentials = {
            key: fs.readFileSync(SSL_PRIVATE_KEY_PATH),
            cert: fs.readFileSync(SSL_FULLCHAIN_CERT_PATH),
        };
        useHttps = true;
        console.log("SSL Certificates found. Will attempt to start HTTPS server.");
    } else {
        console.warn("SSL Certificate files not found at specified paths. Falling back to HTTP.");
        console.warn(`Checked for key: ${SSL_PRIVATE_KEY_PATH}`);
        console.warn(`Checked for cert: ${SSL_FULLCHAIN_CERT_PATH}`);
        useHttps = false;
    }
} catch (e) {
    console.error("Error reading SSL certificate files. Falling back to HTTP.", e);
    useHttps = false;
}


const PORT = parseInt(process.env.PORT, 10) || 8004;
const FACE_REC_API_URL = process.env.FACE_REC_API_URL;

if (!FACE_REC_API_URL) {
    console.error("FATAL ERROR: FACE_REC_API_URL is not defined in .env file.");
    process.exit(1);
}

// CORS Configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'https://identify.mavistech.cloud',
    exposedHeaders: ['Content-Type', 'Result', 'X-Response-Type', 'X-Response-Text'],
};
app.use(cors(corsOptions));

// Middleware to parse JSON bodies (needed for /deletebyname)
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.protocol}://${req.get('host')}${req.originalUrl}`);
    next();
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'UP', message: 'Proxy backend is running' });
});

// --- Proxy /register (existing code) ---
app.post('/api/proxy/register', upload.single('image'), async (req, res) => {
    const targetUrl = `${FACE_REC_API_URL}/register`;
    console.log(`[PROXY REGISTER] Forwarding to: ${targetUrl}`);

    if (!req.file) {
        console.error("[PROXY REGISTER] No image file found.");
        return res.status(400).json({ error: "No image file found in proxy request" });
    }
    if (!req.body.uid) {
        console.error("[PROXY REGISTER] No UID found.");
        return res.status(400).json({ error: "No UID found in proxy request" });
    }
    if (!req.body.name) {
        console.error("[PROXY REGISTER] No name found.");
        return res.status(400).json({ error: "No name found in proxy request" });
    }

    const { uid, name } = req.body;
    const imageFile = req.file;

    const formData = new FormData();
    formData.append('name', name);
    const imageBlob = new Blob([imageFile.buffer], { type: imageFile.mimetype });
    formData.append('image', imageBlob, imageFile.originalname);

    const headersToBackend = {
        'Authentication': uid,
    };

    try {
        console.log(`[PROXY REGISTER] Sending request to backend API with UID: ${uid}, Name: ${name}`);
        const response = await axios.post(targetUrl, formData, {
            headers: headersToBackend,
            timeout: 30000, // 30 seconds
        });

        console.log(`[PROXY REGISTER] Backend API response status: ${response.status}`);
        if (response.headers['result']) res.setHeader('Result', response.headers['result']);
        if (response.headers['x-response-type']) res.setHeader('X-Response-Type', response.headers['x-response-type']);
        if (response.headers['x-response-text']) res.setHeader('X-Response-Text', response.headers['x-response-text']);

        return res.status(response.status).json(response.data);

    } catch (error) {
        console.error(`[PROXY REGISTER] Error during request to backend API ${targetUrl}:`, error.message);
        if (error.response) {
            if (error.response.headers['result']) res.setHeader('Result', error.response.headers['result']);
            if (error.response.headers['x-response-type']) res.setHeader('X-Response-Type', error.response.headers['x-response-type']);
            if (error.response.headers['x-response-text']) res.setHeader('X-Response-Text', error.response.headers['x-response-text']);
            return res.status(error.response.status).json(error.response.data || {
                error: "Backend API error", details: error.message, backend_status: error.response.status
            });
        } else if (error.request) {
            if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
                return res.status(504).json({ error: "Connection to backend API timed out" });
            }
            return res.status(503).json({ error: "Could not connect to backend API (no response)" });
        } else {
            return res.status(500).json({ error: "An error occurred while preparing the request", details: error.message });
        }
    }
});

// --- Proxy /recognize (existing code) ---
app.post('/api/proxy/recognize', upload.single('image'), async (req, res) => {
    const targetUrl = `${FACE_REC_API_URL}/recognize`;
    console.log(`[PROXY RECOGNIZE] Forwarding to: ${targetUrl}`);

    if (!req.file) {
        return res.status(400).json({ error: "No image file found in proxy request" });
    }
    if (!req.body.uid) {
        return res.status(400).json({ error: "No UID found in proxy request" });
    }

    const { uid } = req.body;
    const imageFile = req.file;

    const formData = new FormData();
    const imageBlob = new Blob([imageFile.buffer], { type: imageFile.mimetype });
    formData.append('image', imageBlob, imageFile.originalname);

    const headersToBackend = {
        'Authentication': uid,
    };

    try {
        console.log(`[PROXY RECOGNIZE] Sending request to backend API with UID: ${uid}`);
        const responseFromBackend = await axios.post(targetUrl, formData, {
            headers: headersToBackend,
            timeout: 45000, // 45 seconds
            responseType: 'stream',
        });

        console.log(`[PROXY RECOGNIZE] Backend API response status: ${responseFromBackend.status}, Content-Type: ${responseFromBackend.headers['content-type']}`);
        res.setHeader('Content-Type', responseFromBackend.headers['content-type'] || 'application/octet-stream');
        if (responseFromBackend.headers['result']) res.setHeader('Result', responseFromBackend.headers['result']);
        if (responseFromBackend.headers['x-response-type']) res.setHeader('X-Response-Type', responseFromBackend.headers['x-response-type']);
        if (responseFromBackend.headers['x-response-text']) res.setHeader('X-Response-Text', responseFromBackend.headers['x-response-text']);

        responseFromBackend.data.pipe(res);
        responseFromBackend.data.on('error', (streamError) => { 
            console.error('[PROXY RECOGNIZE] Stream error piping response:', streamError);
            if (!res.headersSent) {
                res.status(500).json({ error: "Stream error from backend API" });
            }
         });
        responseFromBackend.data.on('end', () => { 
            console.log('[PROXY RECOGNIZE] Stream finished.');
        });

    } catch (error) {
        console.error(`[PROXY RECOGNIZE] Error during request to backend API ${targetUrl}:`, error.message);
        if (error.response) {
            if (error.response.headers['result']) res.setHeader('Result', error.response.headers['result']);
            if (error.response.headers['x-response-type']) res.setHeader('X-Response-Type', error.response.headers['x-response-type']);
            if (error.response.headers['x-response-text']) res.setHeader('X-Response-Text', error.response.headers['x-response-text']);
            res.setHeader('Content-Type', error.response.headers['content-type'] || 'application/json');

            if (error.response.data && typeof error.response.data.pipe === 'function') {
                 error.response.data.pipe(res); // If error response is also a stream
            } else {
                res.status(error.response.status).json(error.response.data || {
                    error: "Backend API error during recognition", details: error.message, backend_status: error.response.status
                });
            }
        } else if (error.request) {
             if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
                return res.status(504).json({ error: "Connection to backend API timed out" });
            }
            return res.status(503).json({ error: "Could not connect to backend API (no response for recognition)" });
        } else {
            return res.status(500).json({ error: "An error occurred while preparing the request", details: error.message });
        }
    }
});


// --- NEW: Proxy /faces/list ---
app.get('/api/proxy/faces/list', async (req, res) => {
    const targetUrl = `${FACE_REC_API_URL}/faces/list`;
    console.log(`[PROXY FACES LIST] Forwarding to: ${targetUrl}`);

    const uid = req.headers['x-portal-uid'];
    if (!uid) {
        console.error("[PROXY FACES LIST] No X-Portal-UID header found.");
        return res.status(400).json({ error: "X-Portal-UID header is required" });
    }

    const headersToBackend = {
        'Authentication': uid,
    };

    try {
        console.log(`[PROXY FACES LIST] Sending request to backend API with UID: ${uid}`);
        const response = await axios.get(targetUrl, {
            headers: headersToBackend,
            timeout: 30000, // 30 seconds
        });
        console.log(`[PROXY FACES LIST] Backend API response status: ${response.status}`);
        // Relay headers if needed (though typically list wouldn't have X-Response-Type etc.)
        return res.status(response.status).json(response.data);
    } catch (error) {
        console.error(`[PROXY FACES LIST] Error during request to backend API ${targetUrl}:`, error.message);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data || {
                error: "Backend API error listing faces", details: error.message, backend_status: error.response.status
            });
        } else if (error.request) {
             if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
                return res.status(504).json({ error: "Connection to backend API timed out" });
            }
            return res.status(503).json({ error: "Could not connect to backend API (no response)" });
        } else {
            return res.status(500).json({ error: "An error occurred while preparing the request", details: error.message });
        }
    }
});

// --- NEW: Proxy /faces/deletebyname ---
app.delete('/api/proxy/faces/deletebyname', async (req, res) => {
    console.log(`[PROXY DELETE BY NAME] Received request.`);

    const uid = req.headers['x-portal-uid'];
    if (!uid) {
        console.error("[PROXY DELETE BY NAME] No X-Portal-UID header found.");
        return res.status(400).json({ error: "X-Portal-UID header is required" });
    }

    const { name: personNameToDelete } = req.body;
    if (!personNameToDelete) {
        console.error("[PROXY DELETE BY NAME] 'name' not found in JSON body.");
        return res.status(400).json({ error: "'name' not found in JSON body" });
    }
    console.log(`[PROXY DELETE BY NAME] Orchestrating delete for UID: ${uid}, Name: ${personNameToDelete}`);

    // Step 1: List faces from the actual backend API
    const listUrl = `${FACE_REC_API_URL}/faces/list`;
    let faceEntries = [];
    try {
        console.log(`[PROXY DELETE BY NAME] Step 1: Listing faces from ${listUrl} for UID: ${uid}`);
        const listResponse = await axios.get(listUrl, {
            headers: { 'Authentication': uid },
            timeout: 30000,
        });
        faceEntries = listResponse.data?.registered_face_entries || listResponse.data?.registered_persons || [];
        console.log(`[PROXY DELETE BY NAME] Found ${faceEntries.length} total entries for UID.`);
    } catch (error) {
        console.error(`[PROXY DELETE BY NAME] Error listing faces from backend API:`, error.message);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data || {
                error: "Failed to list faces for deletion", details: error.message, backend_status: error.response.status
            });
        }
        return res.status(500).json({ error: "Failed to list faces due to proxy/network error", details: error.message });
    }

    const idsToDelete = faceEntries
        .filter(entry => entry.name === personNameToDelete && entry.id != null)
        .map(entry => entry.id);

    if (idsToDelete.length === 0) {
        console.log(`[PROXY DELETE BY NAME] No faces found with name '${personNameToDelete}' for UID '${uid}'.`);
        return res.status(200).json({ message: `No faces found with name '${personNameToDelete}' to delete.` });
    }

    console.log(`[PROXY DELETE BY NAME] Step 2: Deleting ${idsToDelete.length} face(s) with IDs: ${idsToDelete.join(', ')}`);
    let deletedCount = 0;
    const failedDeletionsInfo = [];

    for (const faceId of idsToDelete) {
        const deleteUrl = `${FACE_REC_API_URL}/faces/delete/${faceId}`;
        try {
            console.log(`[PROXY DELETE BY NAME] Deleting face ID: ${faceId} from ${deleteUrl}`);
            await axios.delete(deleteUrl, {
                headers: { 'Authentication': uid },
                timeout: 15000, // Shorter timeout for individual deletes
            });
            deletedCount++;
        } catch (error) {
            console.error(`[PROXY DELETE BY NAME] Failed to delete face ID: ${faceId}:`, error.message);
            failedDeletionsInfo.push({
                id: faceId,
                status: error.response?.status || 500,
                error: error.response?.data?.error || error.response?.data || error.message,
            });
        }
    }

    if (failedDeletionsInfo.length === 0) {
        return res.status(200).json({ message: `Successfully deleted ${deletedCount} entries for name '${personNameToDelete}'.` });
    } else {
        return res.status(207).json({ // Multi-Status
            message: `Deletion attempt for name '${personNameToDelete}' completed with some issues.`,
            successfully_deleted_count: deletedCount,
            failed_deletions_count: failedDeletionsInfo.length,
            failures: failedDeletionsInfo,
        });
    }
});


// --- Create Server and Listen (existing code) ---
if (useHttps) {
    const httpsServer = https.createServer(serverCredentials, app);
    httpsServer.listen(PORT, () => {
        console.log(`Node.js HTTPS proxy server listening on https://localhost:${PORT}`);
        console.log(`Proxying to Face Rec API: ${FACE_REC_API_URL}`);
        console.log(`Accepting requests from origin: ${process.env.CORS_ORIGIN || 'https://identify.mavistech.cloud'}`);
    });
} else {
    app.listen(PORT, () => {
        console.warn(`Node.js HTTP proxy server listening on http://localhost:${PORT} (HTTPS setup failed or not configured)`);
        console.log(`Proxying to Face Rec API: ${FACE_REC_API_URL}`);
        console.log(`Accepting requests from origin: ${process.env.CORS_ORIGIN || 'https://identify.mavistech.cloud'}`);
    });
}