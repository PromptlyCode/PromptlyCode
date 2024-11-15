import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { getWebviewContent } from "../codeChat";
import { exec } from "child_process";
import { promisify } from "util";
import { model, modelUrl, systemDefaultPrompt } from "../config";

// Webview panel for chat
// let chatPanel: vscode.WebviewPanel | undefined = undefined;

interface ChatMessage {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_calls?: any[];
  name?: string;
  tool_call_id?: string;
}

export function createChatPanel(
  chatPanel: any,
  context: vscode.ExtensionContext,
  apiKey: string
) {
  chatPanel = vscode.window.createWebviewPanel(
    "aiChat",
    "AI Chat",
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  // Handle messages from the webview
  chatPanel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case "sendMessage":
          const response = await handleChatMessage(message.text, apiKey);
          // Send response back to webview
          chatPanel?.webview.postMessage({
            command: "response",
            text: response,
          });
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

async function handleChatMessage(
  message: string,
  apiKey: string
): Promise<any> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    const tools = [
      {
        type: "function",
        function: {
          name: "read_file",
          description: "Read the contents of a file",
          parameters: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "Path to the file to read",
              },
            },
            required: ["file_path"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "write_file",
          description: "Write content to a file",
          parameters: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "Path to the file to write",
              },
              content: {
                type: "string",
                description: "Content to write to the file",
              },
            },
            required: ["file_path", "content"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "search_code",
          description: "Search code using silver searcher (ag)",
          parameters: {
            type: "object",
            properties: {
              search_term: {
                type: "string",
                description: "Term to search for in the codebase",
              },
            },
            required: ["search_term"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "list_directory",
          description: "List contents of a directory",
          parameters: {
            type: "object",
            properties: {
              directory_path: {
                type: "string",
                description: "Path to the directory",
              },
            },
            required: ["directory_path"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_file_info",
          description: "Get detailed information about a file",
          parameters: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "Path to the file",
              },
            },
            required: ["file_path"],
          },
        },
      },
    ];

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: systemDefaultPrompt,
      },
      { role: "user", content: message },
    ];

    let finalResponse = "";
    let continueConversation = true;

    while (continueConversation) {
      const response = await fetch(`${modelUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: model,
          messages,
          tools,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(data);
      const assistantMessage = data.choices[0].message;
      messages.push(assistantMessage);

      if (assistantMessage.tool_calls) {
        for (const toolCall of assistantMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          let toolResult;

          switch (toolCall.function.name) {
            case "read_file":
              toolResult = await readFile(args.file_path);
              break;
            case "write_file":
              toolResult = await writeFile(args.file_path, args.content);
              break;
            case "search_code":
              toolResult = await searchCode(args.search_term);
              break;
            case "list_directory":
              toolResult = await listDirectory(args.directory_path);
              break;
            case "get_file_info":
              toolResult = await getFileInfo(args.file_path);
              break;
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(toolResult),
          });
        }
      } else {
        finalResponse = assistantMessage.content;
        continueConversation = false;
      }
    }

    return finalResponse;
  } catch (error) {
    console.error("Error in chat:", error);
    return `Error: +++++ {error.message}`;
  }
}

async function readFile(filePath: string): Promise<string> {
  try {
    // Handle both absolute paths and workspace-relative paths
    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workspacePath || "", filePath);

    return fs.readFileSync(fullPath, "utf-8");
  } catch (error) {
    throw new Error(`Failed to read file: ____ {error.message}`);
  }
}

async function listDirectory(directoryPath: string): Promise<string[]> {
  try {
    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    const fullPath = path.isAbsolute(directoryPath)
      ? directoryPath
      : path.join(workspacePath || "", directoryPath);

    return fs.readdirSync(fullPath);
  } catch (error) {
    throw new Error(`Failed to list directory: --- {error.message}`);
  }
}

async function getFileInfo(filePath: string): Promise<any> {
  try {
    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workspacePath || "", filePath);

    const stats = fs.statSync(fullPath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
    };
  } catch (error) {
    throw new Error(`Failed to get file info: === {error.message}`);
  }
}

async function writeFile(filePath: string, content: string): Promise<string> {
  try {
    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workspacePath || "", filePath);

    fs.writeFileSync(fullPath, content, "utf-8");
    return `Successfully wrote to file: ${filePath}`;
  } catch (error) {
    throw new Error(`Failed to write file: ==== {error.message}`);
  }
}

async function searchCode(searchTerm: string): Promise<string> {
  const execAsync = promisify(exec);

  try {
    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspacePath) {
      throw new Error("No workspace folder found");
    }

    // Execute ag command and capture output
    const { stdout, stderr } = await execAsync(
      `ag "${searchTerm}" ${workspacePath}`
    );

    if (stderr) {
      console.warn("Search warning:", stderr);
    }

    return stdout || "No results found";
  } catch (error) {
    if (error.code === 1 && !error.stdout) {
      return "No matches found";
    }
    throw new Error(`Search failed: ---- {error.message}`);
  }
}
