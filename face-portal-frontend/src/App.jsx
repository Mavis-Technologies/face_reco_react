// face-portal-frontend/src/App.jsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'http://localhost:8004/api/proxy'; // Ensure this matches your Node.js proxy
const DEFAULT_UID_FALLBACK = "1E.28.79.62.68.AC";

function App() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const audioPlayerRef = useRef(null);

    // --- State Variables ---
    const [currentMode, setCurrentMode] = useState('register'); // 'register', 'detect', 'manage'
    const [uid, setUid] = useState(DEFAULT_UID_FALLBACK);
    const [personName, setPersonName] = useState('');
    const [status, setStatus] = useState({ message: 'Please select mode, enter details, and start camera.', type: 'info' });
    const [currentStream, setCurrentStream] = useState(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);

    const [resultsData, setResultsData] = useState({
        headers: null, body: null, contentType: null, isError: false
    });
    const [audioSrc, setAudioSrc] = useState(null);
    const [audioObjectURL, setAudioObjectURL] = useState(null);

    const registrationSteps = ['Center', 'Look Left', 'Look Right', 'Smile'];
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [registrationProgress, setRegistrationProgress] = useState({});

    // --- NEW: Management State ---
    const [managedFaces, setManagedFaces] = useState([]); // [{ name: string, count: number, ids: string[] }]
    const [managementStatus, setManagementStatus] = useState({ message: '', type: 'info', visible: false });
    const [isLoadingManagedFaces, setIsLoadingManagedFaces] = useState(false);


    // --- Utility Functions (existing updateStatus, clearResultsDisplay, processAndDisplayData) ---
    const updateStatus = (message, type = 'info', target = 'main') => {
        if (target === 'main') {
            setStatus({ message, type });
        } else if (target === 'management') {
            setManagementStatus({ message, type, visible: true });
        }
    };
    const hideManagementStatus = () => setManagementStatus(prev => ({ ...prev, visible: false }));


    const clearResultsDisplay = () => {
        setResultsData({ headers: null, body: null, contentType: null, isError: false });
        if (audioObjectURL) {
            URL.revokeObjectURL(audioObjectURL);
            setAudioObjectURL(null);
        }
        setAudioSrc(null);
    };

    const processAndDisplayData = (responseHeaders, responseBody, responseContentType, isError = false) => {
        // ... (keep your existing implementation)
        clearResultsDisplay(); 

        const relayedHeaders = {
            responseType: responseHeaders['x-response-type'] || 'N/A',
            resultCode: responseHeaders['result'] || 'N/A',
            originalText: responseHeaders['x-response-text'] || 'N/A',
        };

        let bodyToDisplay = responseBody;

        if (responseContentType && responseContentType.includes('audio/x-raw') && responseBody instanceof Blob) {
            const audioUrl = URL.createObjectURL(responseBody);
            setAudioSrc(audioUrl);
            setAudioObjectURL(audioUrl);
            updateStatus('Audio received. Press play on the audio player.', 'info');
        } else if (responseContentType && responseContentType.includes('application/json')) {
            // bodyToDisplay is already an object if axios parsed it
        } else if (responseBody instanceof Blob) { 
            responseBody.text().then(text => {
                 setResultsData({ headers: relayedHeaders, body: text, contentType: responseContentType || 'text/plain', isError });
            }).catch(e => {
                console.error("Error reading blob as text:", e);
                setResultsData({ headers: relayedHeaders, body: "Could not read blob content.", contentType: responseContentType, isError });
            });
            return; 
        }
        setResultsData({ headers: relayedHeaders, body: bodyToDisplay, contentType: responseContentType, isError });
    };


    const handleModeChange = (newMode) => {
        setCurrentMode(newMode);
        clearResultsDisplay();
        hideManagementStatus();
        setManagedFaces([]);
        stopCamera();

        if (newMode === 'register') {
            updateStatus('Enter UID and Name, then Start Camera for Registration.', 'info');
            setCurrentStepIndex(0);
            setRegistrationProgress({});
            setPersonName('');
        } else if (newMode === 'detect') {
            updateStatus('Enter UID, then Start Camera for Detection.', 'info');
        } else if (newMode === 'manage') {
            updateStatus('Enter UID, then click "List My Faces".', 'info');
        }
    };

    // --- Camera Handling (existing startCamera, stopCamera, captureImageToBlob) ---
    const startCamera = async () => {
        // ... (keep your existing implementation)
        if (currentStream) stopCamera();
        updateStatus('Starting camera...', 'info');
        try {
            const constraints = { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setCurrentStream(stream);
            setIsCameraOn(true);

            if (currentMode === 'register') {
                updateStatus(`Camera started. Pose: ${registrationSteps[currentStepIndex]}. Click Capture.`, 'info');
            } else if (currentMode === 'detect') {
                updateStatus('Camera started. Click Capture to detect faces.', 'info');
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            updateStatus(`Error accessing camera: ${err.name}. Check permissions.`, 'error');
            setIsCameraOn(false);
        }
    };

    const stopCamera = () => {
        // ... (keep your existing implementation)
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCurrentStream(null);
        setIsCameraOn(false);
        // Avoid overwriting an error status with 'Camera stopped'
        if (status.type !== 'error' && managementStatus.type !== 'error') {
             if (currentMode !== 'manage') { // Only update main status if not in manage mode
                updateStatus('Camera stopped.', 'info');
             }
        }
    };

    const captureImageToBlob = () => {
        // ... (keep your existing implementation)
        return new Promise((resolve, reject) => {
            if (!videoRef.current || !canvasRef.current || !isCameraOn) {
                reject(new Error("Camera or canvas not ready."));
                return;
            }
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error("Failed to create blob from canvas."));
            }, 'image/jpeg', 0.9);
        });
    };

    // --- Capture & API Call Logic (existing handleCapture) ---
    const handleCapture = async () => {
        // ... (keep your existing implementation)
        setIsCapturing(true);
        updateStatus('Capturing and processing...', 'info');
        clearResultsDisplay();

        let imageBlob;
        try {
            imageBlob = await captureImageToBlob();
        } catch (error) {
            updateStatus(`Failed to capture image: ${error.message}`, 'error');
            setIsCapturing(false);
            return;
        }

        const trimmedUid = uid.trim();
        if (!trimmedUid) {
            updateStatus('UID cannot be empty.', 'error');
            setIsCapturing(false);
            return;
        }

        const formData = new FormData();
        formData.append('uid', trimmedUid);
        formData.append('image', imageBlob, `capture-${Date.now()}.jpg`);

        let targetUrl = '';
        const isRegistration = currentMode === 'register';

        if (isRegistration) {
            const trimmedPersonName = personName.trim();
            if (!trimmedPersonName) {
                updateStatus('Person Name cannot be empty for registration.', 'error');
                setIsCapturing(false);
                return;
            }
            formData.append('name', trimmedPersonName);
            targetUrl = `${API_BASE_URL}/register`;
            updateStatus(`Registering face for ${trimmedPersonName} (Step: ${registrationSteps[currentStepIndex]})...`, 'info');
        } else { // detect mode
            targetUrl = `${API_BASE_URL}/recognize`;
            updateStatus(`Sending image for recognition...`, 'info');
        }

        try {
            const response = await axios.post(targetUrl, formData, {
                responseType: isRegistration ? 'json' : 'blob',
            });

            const responseContentType = response.headers['content-type'];
            let responseBody = response.data; 

            processAndDisplayData(response.headers, responseBody, responseContentType);


            if (isRegistration) { 
                const message = response.data?.message || response.data?.details || 'Success';
                setRegistrationProgress(prev => ({
                    ...prev,
                    [registrationSteps[currentStepIndex]]: { success: true, message: message }
                }));
                const nextStep = currentStepIndex + 1;
                if (nextStep < registrationSteps.length) {
                    setCurrentStepIndex(nextStep);
                    updateStatus(`Success! Next pose: ${registrationSteps[nextStep]}. Click Capture.`, 'success');
                } else {
                    updateStatus('Registration Complete! All steps successful.', 'success');
                }
            } else { 
                const xResponseType = response.headers['x-response-type'];
                if (xResponseType && xResponseType.toLowerCase().includes('audio')) {
                    updateStatus('Detection complete. Audio response received.', 'success');
                } else {
                    updateStatus('Detection complete. Text/JSON response received.', 'success');
                }
            }

        } catch (error) {
            console.error('API Call Error:', error);
            let errorMsg = "An error occurred.";
            let errorDetails = error.message;
            let errorBodyForDisplay = { error: errorMsg, details: errorDetails };
            let errorHeaders = error.response?.headers || {};
            let errorContentType = error.response?.headers['content-type'] || 'application/json';

            if (error.response) { 
                errorMsg = error.response.data?.error || `API Error (${error.response.status})`;
                errorDetails = error.response.data?.details || (typeof error.response.data === 'string' ? error.response.data : error.message);
                errorBodyForDisplay = error.response.data || { error: errorMsg, details: errorDetails };
            } else if (error.request) { 
                errorMsg = 'Network error or no response from server.';
            }
            
            updateStatus(`${errorMsg}${errorDetails ? ` - ${errorDetails}` : ''}`, 'error');
            processAndDisplayData(errorHeaders, errorBodyForDisplay, errorContentType, true);

            if (isRegistration) {
                setRegistrationProgress(prev => ({
                    ...prev,
                    [registrationSteps[currentStepIndex]]: { success: false, message: `${errorMsg} ${errorDetails || ''}` }
                }));
                updateStatus(`Registration Step Failed: ${errorMsg}. Try capturing again.`, 'error');
            }
        } finally {
            setIsCapturing(false);
        }
    };

    // --- NEW: Management Functions ---
    const listManagedFaces = async () => {
        const trimmedUid = uid.trim();
        if (!trimmedUid) {
            updateStatus('UID cannot be empty to list faces.', 'error', 'management');
            return;
        }
        setIsLoadingManagedFaces(true);
        updateStatus('Fetching face list...', 'info', 'management');
        setManagedFaces([]); // Clear previous list

        try {
            const response = await axios.get(`${API_BASE_URL}/faces/list`, {
                headers: { 'X-Portal-UID': trimmedUid }
            });
            
            const rawFaces = response.data?.registered_face_entries || response.data?.registered_persons || [];

            if (rawFaces.length === 0) {
                updateStatus(response.data?.message || 'No faces registered for this UID.', 'success', 'management');
                setManagedFaces([{ name: 'No faces registered for this UID.', count: 0, isPlaceholder: true }]);
                return;
            }

            // Group faces by name
            const facesByName = rawFaces.reduce((acc, face) => {
                const name = face.name || "Unnamed";
                if (!acc[name]) {
                    acc[name] = { count: 0, ids: [] }; // ids might be useful later
                }
                acc[name].count++;
                if (face.id) acc[name].ids.push(face.id);
                return acc;
            }, {});

            const groupedFaces = Object.keys(facesByName).map(name => ({
                name: name,
                count: facesByName[name].count,
                ids: facesByName[name].ids
            }));

            setManagedFaces(groupedFaces);
            updateStatus(response.data?.message || 'Faces listed successfully.', 'success', 'management');

        } catch (error) {
            console.error('Error listing faces:', error);
            const errorMsg = error.response?.data?.error || error.message;
            updateStatus(`Error listing faces: ${errorMsg}`, 'error', 'management');
            setManagedFaces([]);
        } finally {
            setIsLoadingManagedFaces(false);
        }
    };

    const handleDeleteAllFacesByName = async (personName) => {
        const trimmedUid = uid.trim();
        if (!trimmedUid) {
            updateStatus('UID cannot be empty to delete faces.', 'error', 'management');
            return;
        }
        
        const faceGroup = managedFaces.find(f => f.name === personName);
        const entryCount = faceGroup ? faceGroup.count : 'multiple';

        if (!window.confirm(`Are you sure you want to delete ALL ${entryCount} entries for name: "${personName}"?`)) {
            return;
        }

        updateStatus(`Deleting all entries for name: "${personName}"...`, 'info', 'management');
        try {
            const response = await axios.delete(`${API_BASE_URL}/faces/deletebyname`, {
                headers: { 'X-Portal-UID': trimmedUid },
                data: { name: personName } // Axios DELETE request body is in 'data'
            });
            updateStatus(response.data.message || `Successfully processed deletion for name: "${personName}".`, 'success', 'management');
            listManagedFaces(); // Refresh the list
        } catch (error) {
            console.error('Error deleting faces by name:', error);
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
            updateStatus(`Error deleting faces for "${personName}": ${errorMsg}`, 'error', 'management');
        }
    };


    // Effects (existing useEffect for camera cleanup and audio object URL)
    useEffect(() => {
        return () => { stopCamera(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        return () => { if (audioObjectURL) URL.revokeObjectURL(audioObjectURL); };
    }, [audioObjectURL]);

    useEffect(() => {
        handleModeChange(currentMode);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps


    const isCaptureButtonDisabled = !isCameraOn || isCapturing || (currentMode === 'register' && currentStepIndex >= registrationSteps.length);

    // --- Render Logic for Results (existing renderResultsContent) ---
    const renderResultsContent = () => {
        // ... (keep your existing implementation)
        if (!resultsData.body && !audioSrc) return null; 

        const { body, contentType } = resultsData;

        if (audioSrc) { 
            return (
                <div id="audioContentResults">
                    <h3>Audio Content:</h3>
                    <audio ref={audioPlayerRef} id="audioPlayer" src={audioSrc} controls />
                    <p><small>If audio does not play, check browser console for errors. Raw PCM might need conversion.</small></p>
                </div>
            );
        }
        if (contentType && contentType.includes('application/json')) {
            return (<div id="jsonContentResults"><h3>JSON Content:</h3><pre>{JSON.stringify(body, null, 2)}</pre></div>);
        }
        if (contentType && contentType.includes('text/plain')) {
            return (<div id="textContentResults"><h3>Text Content:</h3><pre>{typeof body === 'string' ? body : JSON.stringify(body)}</pre></div>);
        }
        if (typeof body === 'string') {
            return (<div id="textContentResults"><h3>Content (Unknown Type: {contentType || 'N/A'}):</h3><pre>{body.substring(0,1000)}</pre></div>);
        }
         if (body) { 
             return (<div id="jsonContentResults"><h3>Raw Content (Unknown Type: {contentType || 'N/A'}):</h3><pre>{JSON.stringify(body, null, 2)}</pre></div>);
         }
        return <p>No displayable content or content type not recognized.</p>;
    };

    return (
        <div className="container">
            <h1>Face Registration & Detection Portal (React)</h1>

            <div className="mode-selector">
                <label>
                    <input type="radio" name="mode" value="register" checked={currentMode === 'register'} onChange={() => handleModeChange('register')} /> Register
                </label>
                <label>
                    <input type="radio" name="mode" value="detect" checked={currentMode === 'detect'} onChange={() => handleModeChange('detect')} /> Detect
                </label>
                <label>
                    <input type="radio" name="mode" value="manage" checked={currentMode === 'manage'} onChange={() => handleModeChange('manage')} /> Manage Faces
                </label>
            </div>

            <div className="controls">
                <div className="input-group">
                    <label htmlFor="uid">UID (Device/User ID):</label>
                    <input type="text" id="uid" name="uid" value={uid} onChange={(e) => setUid(e.target.value)} />
                </div>
                {currentMode === 'register' && (
                    <div className="input-group" id="name-group">
                        <label htmlFor="personName">Person Name:</label>
                        <input type="text" id="personName" name="personName" value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Enter name for registration" />
                    </div>
                )}
            </div>

            {(currentMode === 'register' || currentMode === 'detect') && (
                <div className="camera-section">
                    <video ref={videoRef} id="video" width="640" height="480" autoPlay playsInline style={{ display: isCameraOn ? 'block' : 'none', backgroundColor: '#eee' }} />
                    <canvas ref={canvasRef} id="canvas" width="640" height="480" style={{ display: 'none' }} />
                    <div className="button-group">
                        <button onClick={startCamera} disabled={isCameraOn}>Start Camera</button>
                        <button onClick={handleCapture} disabled={isCaptureButtonDisabled}>
                            {isCapturing ? 'Processing...' : 'Capture'}
                        </button>
                        <button onClick={stopCamera} disabled={!isCameraOn}>Stop Camera</button>
                    </div>
                </div>
            )}

            {status.message && (currentMode !== 'manage' || !managementStatus.visible) && ( // Show main status if not in manage or manage status not active
                 <div id="status" className={`status-message ${status.type}`}>
                    {status.message}
                </div>
            )}


            {currentMode === 'manage' && (
                <div className="management-section">
                    <h2>Manage Registered Faces</h2>
                    <button onClick={listManagedFaces} disabled={isLoadingManagedFaces}>
                        {isLoadingManagedFaces ? 'Loading...' : 'List My Faces'}
                    </button>
                    {managementStatus.visible && (
                        <div className={`status-message api-call ${managementStatus.type}`} style={{marginTop: '15px'}}>
                            {managementStatus.message}
                        </div>
                    )}
                    <ul id="faceList">
                        {managedFaces.length === 0 && !isLoadingManagedFaces && managementStatus.type !== 'error' && (
                            <li>No faces to display. Click "List My Faces".</li>
                        )}
                        {managedFaces.map((face, index) => (
                            <li key={face.name + index}>
                                {face.isPlaceholder ? (
                                    <span>{face.name}</span>
                                ) : (
                                    <>
                                        <span>Name: {face.name} (Entries: {face.count})</span>
                                        <button 
                                            onClick={() => handleDeleteAllFacesByName(face.name)}
                                            className="delete-button" /* Add class for specific styling */
                                        >
                                            Delete All for this Name
                                        </button>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}


            {(resultsData.body || audioSrc || resultsData.headers) && (currentMode === 'register' || currentMode === 'detect') && (
                <div id="results" className="results-area">
                    <h2>Results</h2>
                    {/* ... existing results rendering ... */}
                    {resultsData.headers && (
                        <>
                            <p><strong>Response Type:</strong> <span>{resultsData.headers.responseType}</span></p>
                            <p><strong>Result Code:</strong> <span>{resultsData.headers.resultCode}</span></p>
                            <p><strong>Original Text (if audio):</strong> <span>{resultsData.headers.originalText}</span></p>
                        </>
                    )}
                    {renderResultsContent()}
                </div>
            )}

            {currentMode === 'register' && (
                <div id="registration-progress" className="registration-progress">
                    <h2>Registration Progress</h2>
                    {/* ... existing registration progress rendering ... */}
                    <ul id="progressList">
                        {registrationSteps.map((step, index) => {
                            const progress = registrationProgress[step];
                            let className = '';
                            let statusText = '';
                            if (progress) {
                                className = progress.success ? 'completed' : 'failed';
                                statusText = progress.success ? ` (Success: ${progress.message || ''})` : ` (Failed: ${progress.message || 'Error'})`;
                            } else if (index === currentStepIndex && isCameraOn) {
                                className = 'pending';
                                statusText = ' (Current Step)';
                            }
                            return <li key={step} className={className}>{step}{statusText}</li>;
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default App;