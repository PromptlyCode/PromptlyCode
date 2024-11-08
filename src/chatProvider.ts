import * as vscode from 'vscode';
import { OpenAI } from 'openai';

export class ChatProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private openai?: OpenAI;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {}

    public setOpenAIClient(client: OpenAI) {
        this.openai = client;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    if (!this.openai) {
                        vscode.window.showErrorMessage('OpenAI client not initialized');
                        return;
                    }

                    try {
                        const completion = await this.openai.chat.completions.create({
                            messages: [{ role: "user", content: data.message }],
                            model: "gpt-4",
                        });

                        const response = completion.choices[0].message.content;

                        // Check if response contains code
                        const codeMatch = response?.match(/```[\s\S]*?```/g);
                        if (codeMatch) {
                            // Extract code and create files
                            for (const codeBlock of codeMatch) {
                                const code = codeBlock.replace(/```.*\n/, '').replace(/```$/, '');
                                const fileName = `generated_${Date.now()}.txt`;

                                const wsEdit = new vscode.WorkspaceEdit();
                                const filePath = vscode.Uri.file(fileName);
                                wsEdit.createFile(filePath, { ignoreIfExists: true });
                                wsEdit.insert(filePath, new vscode.Position(0, 0), code);

                                await vscode.workspace.applyEdit(wsEdit);
                            }
                        }

                        this._view?.webview.postMessage({
                            type: 'response',
                            message: response
                        });
                    } catch (error) {
                        vscode.window.showErrorMessage('Error communicating with OpenAI');
                    }
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>OpenAI Chat</title>
                <style>
                    body {
                        padding: 10px;
                    }
                    #chat-container {
                        display: flex;
                        flex-direction: column;
                        height: calc(100vh - 20px);
                    }
                    #messages {
                        flex: 1;
                        overflow-y: auto;
                        margin-bottom: 10px;
                        padding: 10px;
                        background: var(--vscode-editor-background);
                    }
                    .message {
                        margin-bottom: 10px;
                        padding: 8px;
                        border-radius: 4px;
                    }
                    .user-message {
                        background: var(--vscode-editor-selectionBackground);
                    }
                    .ai-message {
                        background: var(--vscode-editor-inactiveSelectionBackground);
                    }
                    #input-container {
                        display: flex;
                    }
                    #message-input {
                        flex: 1;
                        margin-right: 10px;
                        padding: 5px;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                    }
                    button {
                        padding: 5px 10px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <div id="chat-container">
                    <div id="messages"></div>
                    <div id="input-container">
                        <input type="text" id="message-input" placeholder="Type your message...">
                        <button id="send-button">Send</button>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const messagesContainer = document.getElementById('messages');
                    const messageInput = document.getElementById('message-input');
                    const sendButton = document.getElementById('send-button');

                    function addMessage(content, isUser = false) {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = \`message \${isUser ? 'user-message' : 'ai-message'}\`;
                        messageDiv.textContent = content;
                        messagesContainer.appendChild(messageDiv);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }

                    sendButton.addEventListener('click', () => {
                        const message = messageInput.value;
                        if (message) {
                            addMessage(message, true);
                            vscode.postMessage({
                                type: 'sendMessage',
                                message: message
                            });
                            messageInput.value = '';
                        }
                    });

                    messageInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            sendButton.click();
                        }
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'response':
                                addMessage(message.message);
                                break;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}
