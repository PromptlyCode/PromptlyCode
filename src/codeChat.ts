export function getWebviewContent() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI Chat</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 10px;
          color: var(--vscode-editor-foreground);
          background-color: var(--vscode-editor-background);
        }
        #chat-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 20px);
        }
        #messages {
          flex-grow: 1;
          overflow-y: auto;
          margin-bottom: 10px;
          padding: 10px;
          border: 1px solid var(--vscode-input-border);
        }
        .message {
          margin-bottom: 10px;
          padding: 8px;
          border-radius: 4px;
        }
        .user-message {
          background-color: var(--vscode-editor-selectionBackground);
        }
        .assistant-message {
          background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        #input-container {
          display: flex;
          gap: 10px;
        }
        #message-input {
          flex-grow: 1;
          padding: 8px;
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
        }
        button {
          padding: 8px 16px;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          cursor: pointer;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        #loading-spinner {
            display: none;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 50px;
            height: 50px;
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
        const messagesDiv = document.getElementById('messages');
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        const loadingSpinner = document.getElementById('loading-spinner');

        function addMessage(text, isUser) {
          const messageDiv = document.createElement('div');
          messageDiv.className = \`message \${isUser ? 'user-message' : 'assistant-message'}\`;
          messageDiv.textContent = text;
          messagesDiv.appendChild(messageDiv);
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function sendMessage() {
          const text = messageInput.value.trim();
          if (text) {
            addMessage(text, true);
            messageInput.value = '';
            loadingSpinner.style.display = 'block';  // Show loading spinner

            vscode.postMessage({
              command: 'sendMessage',
              text: text
            });
          }
        }

        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            sendMessage();
          }
        });

        window.addEventListener('message', event => {
          const message = event.data;
          switch (message.command) {
            case 'response':
              addMessage(message.text, false);
              loadingSpinner.style.display = 'none';  // Hide loading spinner once response is received
              break;
          }
        });
      </script>
    </body>
    </html>`;
}
