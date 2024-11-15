import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getWebviewContent } from "../codeChat";

// Webview panel for chat
// let chatPanel: vscode.WebviewPanel | undefined = undefined;

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_calls?: any[];
  name?: string;
  tool_call_id?: string;
}


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
      {
        role: "system",
        content: "You are an experienced programmer named Steve, an AI programmer assistant created by PromptlyCode",
      },
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

