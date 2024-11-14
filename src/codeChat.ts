export function getWebviewContent() {
    return `<!DOCTYPE html>
        <html>
        <head>
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
            <link href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.css" rel="stylesheet" />
            <style>
                body {
                    margin: 0;
                    padding: 10px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                #chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                #messages {
                    flex: 1;
                    overflow-y: auto;
                    margin-bottom: 10px;
                    padding: 10px;
                }
                .message {
                    margin: 5px 0;
                    padding: 8px;
                    border-radius: 5px;
                }
                .user-message {
                    background-color: var(--vscode-editor-selectionBackground);
                    margin-left: 20%;
                    white-space: pre-wrap;
                }
                .assistant-message {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    margin-right: 20%;
                }
                .assistant-message pre {
                    background-color: var(--vscode-editor-background);
                    padding: 1em;
                    border-radius: 4px;
                    overflow-x: auto;
                }
                .assistant-message code {
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                }
                .assistant-message p {
                    margin: 0.5em 0;
                }
                .assistant-message ul, .assistant-message ol {
                    margin: 0.5em 0;
                    padding-left: 2em;
                }
                .assistant-message table {
                    border-collapse: collapse;
                    margin: 1em 0;
                }
                .assistant-message th, .assistant-message td {
                    border: 1px solid var(--vscode-editor-foreground);
                    padding: 6px 13px;
                }
                #input-container {
                    display: flex;
                    padding: 10px;
                }
                #message-input {
                    flex: 1;
                    margin-right: 10px;
                    padding: 5px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    min-height: 2.5em;
                    resize: vertical;
                }
                button {
                    padding: 5px 10px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                /* Loading Spinner */
                #loading-spinner {
                    display: none;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 50px;
                    height: 50px;
                }
                /* SVG Spinner */
                .spinner {
                    animation: spin 1s linear infinite;
                    width: 100%;
                    height: 100%;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div id="chat-container">
                <div id="messages"></div>
                <div id="loading-spinner"> 
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" class="spinner">
                        <circle cx="25" cy="25" r="20" stroke="var(--vscode-editor-foreground)" stroke-width="5" fill="none" stroke-linecap="round"/>
                    </svg>
                </div>
                <div id="input-container">
                    <textarea id="message-input" placeholder="Type your question..." style="background:#e5ebf1;margin-bottom: 5px;" autofocus></textarea>
                    <button id="send-button" style="margin-bottom: 10px;border-radius: 3px;">Send</button>
                </div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const messagesContainer = document.getElementById('messages');
                const messageInput = document.getElementById('message-input');
                const sendButton = document.getElementById('send-button');
                const loadingSpinner = document.getElementById('loading-spinner'); // Loading spinner element

                // Configure marked options
                marked.setOptions({
                    highlight: function(code, lang) {
                        if (Prism.languages[lang]) {
                            return Prism.highlight(code, Prism.languages[lang], lang);
                        }
                        return code;
                    }
                });

                function sendMessage() {
                    const text = messageInput.value.trim();
                    if (text) {
                        appendMessage(text, 'user');
                        showLoading(true); // Show loading spinner
                        vscode.postMessage({
                            command: 'sendMessage',
                            text: text
                        });
                        messageInput.value = '';
                    }
                }

                function appendMessage(text, sender) {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'message ' + sender + '-message';
                    
                    if (sender === 'assistant') {
                        messageDiv.innerHTML = marked.parse(text);
                        // Apply syntax highlighting to code blocks
                        messageDiv.querySelectorAll('pre code').forEach((block) => {
                            Prism.highlightElement(block);
                        });
                    } else {
                        messageDiv.textContent = text;
                    }
                    
                    messagesContainer.appendChild(messageDiv);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    if (sender === 'assistant') {
                        showLoading(false); // Hide loading spinner once response is received
                    }
                }

                function showLoading(isLoading) {
                    if (isLoading) {
                        loadingSpinner.style.display = 'block'; // Show spinner
                    } else {
                        loadingSpinner.style.display = 'none'; // Hide spinner
                    }
                }

                sendButton.addEventListener('click', sendMessage);
                
                messageInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'receiveMessage':
                            appendMessage(message.text, 'assistant');
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
}
