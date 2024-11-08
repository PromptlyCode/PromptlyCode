import * as vscode from 'vscode';
import axios from 'axios';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}


async function promptForApiKey(): Promise<string | undefined> {
    const result = await vscode.window.showInputBox({
        prompt: 'Please enter your OpenRouter API key',
        placeHolder: 'sk-or-...',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value: string) => {
            if (!value.startsWith('sk-or-')) {
                return 'OpenRouter API key should start with "sk-or-"';
            }
            if (value.length < 20) {
                return 'API key seems too short';
            }
            return null;
        }
    });

    if (result) {
        const config = vscode.workspace.getConfiguration('openaiHelper');
        await config.update('apiKey', result, true);
        vscode.window.showInformationMessage('API key saved successfully!');
        return result;
    }
    return undefined;
}


function extractCodeFromResponse(response: string): string {
    // Try to find code between markdown code blocks
    const markdownMatch = response.match(/```(?:\w+)?\n([\s\S]+?)\n```/);
    if (markdownMatch) {
        return markdownMatch[1].trim();
    }

    // If no markdown blocks found, attempt to extract just the code section
    const codeMatch = response.match(/(?:Here's the code:|Here is the code:)\n*([\s\S]+)$/i);
    if (codeMatch) {
        return codeMatch[1].trim();
    }

    // If no specific markers found, return the whole response
    return response.trim();
}

async function askAI(apiKey: string, question: string, code: string): Promise<string> {
    try {
        const fullPrompt = `I have this code:

${code}

${question}

Please provide only the modified code without any explanation or markdown tags. Do not include \`\`\` markers. Just return the code that should replace the current selection.`;

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'anthropic/claude-3.5-sonnet',
                messages: [
                    {
                        role: 'user',
                        content: fullPrompt
                    }
                ],
                top_p: 1,
                temperature: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
                repetition_penalty: 1,
                top_k: 0,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const responseContent = response.data.choices[0].message.content;
        return extractCodeFromResponse(responseContent);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            if (error.response.status === 401) {
                throw new Error('Invalid API key');
            }
            throw new Error(`API error: ${error.response.data.error.message}`);
        }
        throw error;
    }
}

// ---- help 

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _messages: ChatMessage[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {}

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
                    await this.handleMessage(data.message);
                    break;
                case 'createFile':
                    await vscode.commands.executeCommand('promptly-code.createFile', data.content, data.language);
                    break;
            }
        });
    }

    private async handleMessage(message: string) {
        const config = vscode.workspace.getConfiguration('openaiHelper');
        let apiKey = config.get<string>('apiKey');

        if (!apiKey) {
            apiKey = await promptForApiKey();
            if (!apiKey) {
                return;
            }
        }

        this.addMessage('user', message);

        try {
            const response = await askAI(apiKey, message, '');
            this.addMessage('assistant', response);
        } catch (error) {
            vscode.window.showErrorMessage('Error: Failed to get AI response');
        }
    }

    private addMessage(role: 'user' | 'assistant', content: string) {
        this._messages.push({
            role,
            content,
            timestamp: Date.now()
        });

        if (this._view) {
            this._view.webview.postMessage({
                type: 'addMessage',
                message: {
                    role,
                    content,
                    timestamp: Date.now()
                }
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        padding: 10px;
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-editor-foreground);
                    }
                    .message {
                        margin-bottom: 10px;
                        padding: 8px;
                        border-radius: 4px;
                    }
                    .user {
                        background-color: var(--vscode-editor-inactiveSelectionBackground);
                    }
                    .assistant {
                        background-color: var(--vscode-editor-selectionBackground);
                    }
                    #input-container {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        padding: 10px;
                        background: var(--vscode-editor-background);
                    }
                    #message-input {
                        width: 100%;
                        padding: 5px;
                        margin-bottom: 5px;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                    }
                    #chat-container {
                        margin-bottom: 60px;
                    }
                    .code-block {
                        background-color: var(--vscode-editor-background);
                        padding: 8px;
                        margin: 5px 0;
                    }
                    .create-file-btn {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 4px 8px;
                        cursor: pointer;
                        margin-top: 5px;
                    }
                </style>
            </head>
            <body>
                <div id="chat-container"></div>
                <div id="input-container">
                    <textarea id="message-input" rows="3" placeholder="Type your message..."></textarea>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const chatContainer = document.getElementById('chat-container');
                    const messageInput = document.getElementById('message-input');

                    function createCodeBlock(code, language) {
                        const container = document.createElement('div');
                        container.className = 'code-block';

                        const pre = document.createElement('pre');
                        pre.textContent = code;
                        container.appendChild(pre);

                        const button = document.createElement('button');
                        button.className = 'create-file-btn';
                        button.textContent = 'Create File';
                        button.onclick = () => {
                            vscode.postMessage({
                                type: 'createFile',
                                content: code,
                                language: language || 'plaintext'
                            });
                        };
                        container.appendChild(button);

                        return container;
                    }

                    function addMessage(message) {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = 'message ' + message.role;

                        // Check for code blocks
                        const codeBlockRegex = /\`\`\`([\w-]*)\n([\s\S]+?)\`\`\`/g;
                        let lastIndex = 0;
                        let match;

                        while ((match = codeBlockRegex.exec(message.content)) !== null) {
                            // Add text before code block
                            const textBefore = message.content.slice(lastIndex, match.index);
                            if (textBefore) {
                                const textDiv = document.createElement('div');
                                textDiv.textContent = textBefore;
                                messageDiv.appendChild(textDiv);
                            }

                            // Add code block
                            const language = match[1] || 'plaintext';
                            const code = match[2];
                            messageDiv.appendChild(createCodeBlock(code, language));

                            lastIndex = match.index + match[0].length;
                        }

                        // Add remaining text
                        const textAfter = message.content.slice(lastIndex);
                        if (textAfter) {
                            const textDiv = document.createElement('div');
                            textDiv.textContent = textAfter;
                            messageDiv.appendChild(textDiv);
                        }

                        chatContainer.appendChild(messageDiv);
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }

                    messageInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            const message = messageInput.value.trim();
                            if (message) {
                                vscode.postMessage({
                                    type: 'sendMessage',
                                    message: message
                                });
                                messageInput.value = '';
                            }
                        }
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'addMessage':
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
