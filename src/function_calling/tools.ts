import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Webview panel for chat
// let chatPanel: vscode.WebviewPanel | undefined = undefined;

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  name?: string;
  tool_call_id?: string;
}

// export function activate(context: vscode.ExtensionContext) {
//   // Register the chat command (cmd+l)
//   let openChat = vscode.commands.registerCommand('aitools.openChat', () => {
//     if (chatPanel) {
//       chatPanel.reveal(vscode.ViewColumn.Two);
//     } else {
//       createChatPanel(context);
//     }
//   });

//   context.subscriptions.push(openChat);
// }

export function createChatPanel(chatPanel: any, context: vscode.ExtensionContext, apiKey: string) {
  chatPanel = vscode.window.createWebviewPanel(
    'aiChat',
    'AI Chat',
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  // Handle messages from the webview
  chatPanel.webview.onDidReceiveMessage(
    async message => {
      switch (message.command) {
        case 'sendMessage':
          const response = await handleChatMessage(message.text, apiKey);
          // Send response back to webview
          chatPanel?.webview.postMessage({ command: 'response', text: response });
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  // Set webview content
  chatPanel.webview.html = getWebviewContent();

  chatPanel.onDidDispose(
    () => {
      chatPanel = undefined;
    },
    null,
    context.subscriptions
  );
}

async function handleChatMessage(message: string, apiKey: string): Promise<any> {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  try {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read the contents of a file',
          parameters: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Path to the file to read'
              }
            },
            required: ['file_path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_directory',
          description: 'List contents of a directory',
          parameters: {
            type: 'object',
            properties: {
              directory_path: {
                type: 'string',
                description: 'Path to the directory'
              }
            },
            required: ['directory_path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_file_info',
          description: 'Get detailed information about a file',
          parameters: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Path to the file'
              }
            },
            required: ['file_path']
          }
        }
      }
    ];

    const messages: ChatMessage[] = [
      { role: 'user', content: message }
    ];

    let finalResponse = '';
    let continueConversation = true;

    while (continueConversation) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'openai/gpt-4-0125-preview',
          messages,
          tools,
          tool_choice: 'auto'
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();      
      console.log(data)
      const assistantMessage = data.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.tool_calls) {
        for (const toolCall of assistantMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          let toolResult;

          switch (toolCall.function.name) {
            case 'read_file':
              toolResult = await readFile(args.file_path);
              break;
            case 'list_directory':
              toolResult = await listDirectory(args.directory_path);
              break;
            case 'get_file_info':
              toolResult = await getFileInfo(args.file_path);
              break;
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(toolResult)
          });
        }
      } else {
        finalResponse = assistantMessage.content;
        continueConversation = false;
      }
    }

    return finalResponse;

  } catch (error) {
    console.error('Error in chat:', error);
    return `Error: +++++ {error.message}`;
  }
}

async function readFile(filePath: string): Promise<string> {
  try {
    // Handle both absolute paths and workspace-relative paths
    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    const fullPath = path.isAbsolute(filePath) ? 
      filePath : 
      path.join(workspacePath || '', filePath);
    
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file: ____ {error.message}`);
  }
}

async function listDirectory(directoryPath: string): Promise<string[]> {
  try {
    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    const fullPath = path.isAbsolute(directoryPath) ? 
      directoryPath : 
      path.join(workspacePath || '', directoryPath);
    
    return fs.readdirSync(fullPath);
  } catch (error) {
    throw new Error(`Failed to list directory: --- {error.message}`);
  }
}

async function getFileInfo(filePath: string): Promise<any> {
  try {
    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    const fullPath = path.isAbsolute(filePath) ? 
      filePath : 
      path.join(workspacePath || '', filePath);
    
    const stats = fs.statSync(fullPath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile()
    };
  } catch (error) {
    throw new Error(`Failed to get file info: === {error.message}`);
  }
}

function getWebviewContent() {
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
      const messagesDiv = document.getElementById('messages');
      const messageInput = document.getElementById('message-input');
      const sendButton = document.getElementById('send-button');

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
          vscode.postMessage({
            command: 'sendMessage',
            text: text
          });
          messageInput.value = '';
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
            break;
        }
      });
    </script>
  </body>
  </html>`;
}

