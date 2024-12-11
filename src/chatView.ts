import * as vscode from 'vscode';
import { ChatProvider } from './chatProvider';

export class ChatView {
    private panel: vscode.WebviewPanel | undefined;
    private chatProvider: ChatProvider;

    constructor(context: vscode.ExtensionContext) {
        this.chatProvider = new ChatProvider();
        
        context.subscriptions.push(
            vscode.commands.registerCommand('aiChat.openChatWindow', () => {
                this.createChatPanel(context);
            })
        );
    }

    private createChatPanel(context: vscode.ExtensionContext) {
        this.panel = vscode.window.createWebviewPanel(
            'aiChatView',
            'AI Chat',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    try {
                        const reply = await this.chatProvider.sendMessage(message.text);
                        this.panel?.webview.postMessage({ 
                            command: 'receiveMessage', 
                            text: reply 
                        });
                    } catch (error) {
                        this.panel?.webview.postMessage({
                            command: 'error',
                            text: 'Failed to send message'
                        });
                    }
                    break;
                case 'resetConversation':
                    this.chatProvider.resetConversation();
                    break;
            }
        }, undefined, context.subscriptions);
    }

    private getWebviewContent(): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; }
                #chatContainer { height: 500px; overflow-y: scroll; }
                #messageInput { width: 100%; padding: 10px; }
            </style>
        </head>
        <body>
            <div id="chatContainer"></div>
            <input type="text" id="messageInput" placeholder="Type your message...">
            <button id="sendButton">Send</button>
            <button id="resetButton">Reset Conversation</button>

            <script>
                const vscode = acquireVsCodeApi();
                const chatContainer = document.getElementById('chatContainer');
                const messageInput = document.getElementById('messageInput');
                const sendButton = document.getElementById('sendButton');
                const resetButton = document.getElementById('resetButton');

                sendButton.addEventListener('click', () => {
                    const message = messageInput.value;
                    if (message.trim()) {
                        vscode.postMessage({ command: 'sendMessage', text: message });
                        appendMessage('user', message);
                        messageInput.value = '';
                    }
                });

                resetButton.addEventListener('click', () => {
                    vscode.postMessage({ command: 'resetConversation' });
                    chatContainer.innerHTML = '';
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'receiveMessage':
                            appendMessage('assistant', message.text);
                            break;
                        case 'error':
                            appendMessage('error', message.text);
                            break;
                    }
                });

                function appendMessage(role, text) {
                    const messageElement = document.createElement('div');
                    messageElement.className = role;
                    messageElement.textContent = text;
                    chatContainer.appendChild(messageElement);
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            </script>
        </body>
        </html>
        `;
    }
}