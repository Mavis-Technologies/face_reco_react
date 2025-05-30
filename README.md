# React Face Recognition Portal

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)

A web portal built with React (frontend) and Node.js/Express (proxy backend) to interact with a separate Face Recognition API. This portal allows users to register new faces, detect/recognize faces from a live camera stream, and manage registered face entries.

**Repository:** [Mavis-Technologies/face_reco_react](https://github.com/Mavis-Technologies/face_reco_react)

## Features

*   **Multi-Mode Operation:**
    *   **Register:** Capture multiple face images (Center, Look Left, Look Right, Smile) for a person under a specific UID and Name.
    *   **Detect:** Capture a face image and send it for recognition against registered faces for a UID.
    *   **Manage Faces:** List all registered faces for a UID (grouped by name) and delete all entries associated with a specific name.
*   **Live Camera Stream:** Utilizes the browser's camera for capturing images.
*   **Dynamic Results Display:** Shows responses from the backend API, including:
    *   JSON data for registration/detection results.
    *   Text-based messages.
    *   Audio playback for audio responses (e.g., voice confirmation).
*   **Status Updates:** Provides real-time feedback to the user on operations.
*   **UID and Name Input:** Allows specifying a User/Device ID (UID) and Person Name for operations.
*   **Proxy Backend:** The Node.js backend serves as a secure proxy to the actual Face Recognition API, handling authentication (via UID) and request forwarding.

## Tech Stack

**Frontend (`face-portal-frontend`):**
*   React
*   Axios (for API calls)
*   Vite (for development and build)
*   Standard HTML5/CSS/JavaScript

**Backend (Proxy Server - `face-portal-backend`):**
*   Node.js
*   Express.js
*   Axios (for forwarding requests)
*   Multer (for handling image uploads)
*   CORS (for cross-origin resource sharing)
*   Dotenv (for environment variable management)

## Prerequisites

1.  **Node.js and npm (or yarn):**
    *   Node.js (v16.x or later recommended)
    *   npm (usually comes with Node.js) or yarn
2.  **A running Face Recognition Backend API:** This portal is a *client* and *proxy*. It requires a separate backend service that actually performs the face registration, recognition, and management. The URL of this service must be configured.
3.  **SSL Certificates (Optional but Recommended for HTTPS):** If you plan to run the Node.js proxy backend over HTTPS (especially if your frontend is on HTTPS to use the camera securely), you will need SSL certificate files (`privkey.pem`, `fullchain.pem`).

## Project Structure

```
.
├── face-portal-backend         # Node.js Proxy Backend
│   ├── node_modules/
│   ├── .env.example            # Example environment file
│   ├── package.json
│   ├── server.js               # Main backend server file
│   └── ...
└── face-portal-frontend        # React Frontend
    ├── node_modules/
    ├── public/
    ├── src/
    │   ├── App.css
    │   ├── App.jsx             # Main React component
    │   ├── index.css
    │   └── main.jsx            # React entry point
    ├── .eslintrc.cjs
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── ...
```

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Mavis-Technologies/face_reco_react.git
    cd face_reco_react
    ```

2.  **Setup Backend (`face-portal-backend`):**
    ```bash
    cd face-portal-backend
    npm install
    ```
    *   Create a `.env` file by copying `.env.example` (if provided, otherwise create it manually):
        ```bash
        cp .env.example .env
        ```
    *   Edit the `.env` file with your specific configurations (see [Environment Variables](#environment-variables) section below).

3.  **Setup Frontend (`face-portal-frontend`):**
    ```bash
    cd ../face-portal-frontend
    npm install
    ```
    *   The frontend is configured in `src/App.jsx` to connect to the Node.js proxy backend at `http://localhost:8004/api/proxy`. If your backend runs on a different port or host, update `API_BASE_URL` in `src/App.jsx`.

## Environment Variables (for `face-portal-backend/.env`)

The backend proxy server requires the following environment variables:

| Variable                  | Description                                                                                                | Example                               |
| :------------------------ | :--------------------------------------------------------------------------------------------------------- | :------------------------------------ |
| `PORT`                    | The port on which the Node.js proxy backend will run.                                                      | `8004`                                |
| `FACE_REC_API_URL`        | **Required.** The base URL of your actual Face Recognition backend API.                                      | `http://your-face-api-domain.com:5005` |
| `CORS_ORIGIN`             | The origin URL of your React frontend. Used for CORS configuration.                                        | `https://identify.mavistech.cloud` or `http://localhost:5173` (Vite default) |
| `SSL_PRIVATE_KEY_PATH`    | Absolute path to your SSL private key file (e.g., `privkey.pem`). Only needed if running backend on HTTPS. | `/etc/letsencrypt/live/yourdomain.com/privkey.pem` |
| `SSL_FULLCHAIN_CERT_PATH` | Absolute path to your SSL fullchain certificate file (e.g., `fullchain.pem`). Only for HTTPS.              | `/etc/letsencrypt/live/yourdomain.com/fullchain.pem` |

**Example `.env` for `face-portal-backend`:**
```env
PORT=8004
FACE_REC_API_URL=http://20.68.131.221:5005
CORS_ORIGIN=http://localhost:5173

# Optional for HTTPS
# SSL_PRIVATE_KEY_PATH=/path/to/your/privkey.pem
# SSL_FULLCHAIN_CERT_PATH=/path/to/your/fullchain.pem
```

## Running the Application

You need to run both the backend proxy server and the frontend development server.

1.  **Start the Backend Proxy Server (`face-portal-backend`):**
    Open a terminal, navigate to the `face-portal-backend` directory:
    ```bash
    cd face-portal-backend
    npm start
    # or node server.js
    ```
    The backend server will start, typically on `http://localhost:8004` (or HTTPS if configured).

2.  **Start the Frontend Development Server (`face-portal-frontend`):**
    Open another terminal, navigate to the `face-portal-frontend` directory:
    ```bash
    cd face-portal-frontend
    npm run dev
    ```
    The Vite development server will start, typically on `http://localhost:5173`.

3.  **Access the Portal:**
    Open your browser and navigate to the frontend URL (e.g., `http://localhost:5173`).

## Proxy API Endpoints (Node.js Backend)

The React frontend communicates with these endpoints on the Node.js proxy server:

*   **`POST /api/proxy/register`**: For registering new faces.
    *   Expects `FormData` with `uid`, `name`, and `image` file.
    *   Forwards to `FACE_REC_API_URL/register`.
*   **`POST /api/proxy/recognize`**: For detecting/recognizing faces.
    *   Expects `FormData` with `uid` and `image` file.
    *   Forwards to `FACE_REC_API_URL/recognize`.
*   **`GET /api/proxy/faces/list`**: For listing registered faces.
    *   Requires `X-Portal-UID` header.
    *   Forwards to `FACE_REC_API_URL/faces/list`.
*   **`DELETE /api/proxy/faces/deletebyname`**: For deleting all face entries associated with a name.
    *   Requires `X-Portal-UID` header.
    *   Expects JSON body: `{ "name": "person_to_delete" }`.
    *   Orchestrates deletion by first listing faces, then deleting individual entries via `FACE_REC_API_URL/faces/delete/:id`.

## Potential Future Enhancements

*   Delete individual face entries (by ID) from the management UI.
*   More granular error display and user feedback.
*   Enhanced UI/UX for loading states, empty states, and pagination for large lists.
*   Option to upload an image file for detection/registration (in addition to camera capture).
*   User authentication for the portal itself (if different UIDs represent distinct portal users).
*   Internationalization (i18n) support.
