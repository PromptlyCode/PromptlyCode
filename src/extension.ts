// src/extension.ts
import * as vscode from "vscode";
import axios from "axios";
import { getWebviewContent } from "./codeChat";
import { updateGraphVisualization } from "./parse_typescript/show_graph";
import { completionItems } from "./tab_auto_complete/yasnippet";
import { createChatPanel, handleChatMessage } from "./function_calling/tools";
import { exec } from "child_process";
import { promisify } from "util";
import { systemDefaultPrompt } from "./config";
import { ResizableQuickInput } from "./poc/cmd_i";
import { ChatView } from './chatView';

const execAsync = promisify(exec);
let currentPanel: vscode.WebviewPanel | undefined = undefined;

//
interface PromptlyCodeConfig {
  apiKey: string;
  apiUrl: string;
  apiModel: string;
  ragPyEnv: string;
}

const DEFAULT_CONFIG: PromptlyCodeConfig = {
  apiKey: "",
  apiUrl: "https://openrouter.ai/api",
  apiModel: "anthropic/claude-3.5-sonnet",
  ragPyEnv:
    "source /opt/anaconda3/etc/profile.d/conda.sh &&  conda activate rag-code-sorting-search && cd /Users/clojure/Desktop/rag-code-sorting-search && PYTHONPATH='.:/Users/clojure/Desktop/rag-code-sorting-search' /Users/clojure/.local/bin/poetry run ",
};

export function getSettingsWebviewContent(
  currentConfig: PromptlyCodeConfig
): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PromptlyCode Settings</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                padding: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            .form-group {
                margin-bottom: 20px;
            }
            label {
                display: block;
                margin-bottom: 5px;
                color: var(--vscode-input-foreground);
            }
            input[type="text"],
            input[type="password"] {
                width: 100%;
                padding: 8px;
                margin-bottom: 10px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
            }
            .hint {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                margin-top: 4px;
            }
            button {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
            }
            button:hover {
                background: var(--vscode-button-hoverBackground);
            }
            .error {
                color: var(--vscode-errorForeground);
                margin-top: 4px;
                display: none;
            }
        </style>
    </head>
    <body>
        <h2>PromptlyCode Configuration</h2>
        <form id="settingsForm">
            <div class="form-group">
                <label for="apiKey">LLM API Key</label>
                <input type="password" style="background:#e5ebf1;" id="apiKey" name="apiKey" value="${currentConfig.apiKey}" required>
                <div class="hint">Your API key should start with 'sk-or-'</div>
                <div class="error" id="apiKeyError">Invalid API key format</div>
            </div>

            <div class="form-group">
                <label for="apiUrl">API URL</label>
                <input type="text" style="background:#e5ebf1;" id="apiUrl" name="apiUrl" value="${currentConfig.apiUrl}" required>
                <div class="hint">Default: https://openrouter.ai/api</div>
                <div class="error" id="apiUrlError">Please enter a valid URL</div>
            </div>

            <div class="form-group">
                <label for="apiModel">AI Model</label>
                <input type="text" style="background:#e5ebf1;" id="apiModel" name="apiModel" value="${currentConfig.apiModel}" required>
                <div class="hint">Example: anthropic/claude-3.5-sonnet, openai/gpt-4o-2024-08-06</div>
            </div>

            <div class="form-group">
                <label for="ragPyEnv">RAG Configuration</label>
                <input type="text" style="background:#e5ebf1;" id="ragPyEnv" name="ragPyEnv" value="${currentConfig.ragPyEnv}" required>
                <div class="hint">If you need to configure rag, please check https://github.com/PromptlyCode/rag-code-sorting-search/</div>
            </div>

            <button type="submit">Save Settings</button>
        </form>

        <script>
            const vscode = acquireVsCodeApi();
            const form = document.getElementById('settingsForm');
            const apiKeyInput = document.getElementById('apiKey');
            const apiUrlInput = document.getElementById('apiUrl');
            const apiModelInput = document.getElementById('apiModel');
            const ragPyEnvInput = document.getElementById('ragPyEnv');
            const apiKeyError = document.getElementById('apiKeyError');
            const apiUrlError = document.getElementById('apiUrlError');

            function validateApiKey(value) {
                return value.startsWith('sk-or-') && value.length >= 20;
            }

            function validateUrl(value) {
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            }

            apiKeyInput.addEventListener('input', () => {
                if (!validateApiKey(apiKeyInput.value)) {
                    apiKeyError.style.display = 'block';
                } else {
                    apiKeyError.style.display = 'none';
                }
            });

            apiUrlInput.addEventListener('input', () => {
                if (!validateUrl(apiUrlInput.value)) {
                    apiUrlError.style.display = 'block';
                } else {
                    apiUrlError.style.display = 'none';
                }
            });

            form.addEventListener('submit', (e) => {
                e.preventDefault();

                const apiKey = apiKeyInput.value;
                const apiUrl = apiUrlInput.value;
                const apiModel = apiModelInput.value.trim();
                const ragPyEnv = ragPyEnvInput.value.trim();


                if (!validateApiKey(apiKey)) {
                    apiKeyError.style.display = 'block';
                    return;
                }

                if (!validateUrl(apiUrl)) {
                    apiUrlError.style.display = 'block';
                    return;
                }

                if (!apiModel) {
                    return;
                }

                vscode.postMessage({
                    command: 'saveSettings',
                    apiKey,
                    apiUrl,
                    apiModel,
                    ragPyEnv
                });
            });
        </script>
    </body>
    </html>`;
}

export async function showSettingsWebview(
  context: vscode.ExtensionContext
): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    "promptlyCodeSettings",
    "PromptlyCode Settings",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
    }
  );

  const config = vscode.workspace.getConfiguration("promptlyCode");
  const currentConfig: PromptlyCodeConfig = {
    apiKey: config.get("apiKey", DEFAULT_CONFIG.apiKey),
    apiUrl: config.get("apiUrl", DEFAULT_CONFIG.apiUrl),
    apiModel: config.get("apiModel", DEFAULT_CONFIG.apiModel),
    ragPyEnv: config.get("ragPyEnv", DEFAULT_CONFIG.apiModel),
  };

  panel.webview.html = getSettingsWebviewContent(currentConfig);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case "saveSettings":
          try {
            await config.update("apiKey", message.apiKey, true);
            await config.update("apiUrl", message.apiUrl, true);
            await config.update("apiModel", message.apiModel, true);
            await config.update("ragPyEnv", message.ragPyEnv, true);
            vscode.window.showInformationMessage(
              "Settings saved successfully!"
            );
            panel.dispose();
          } catch (error) {
            // console.log(error) // Fixed: CodeExpectedError: Unable to write to User Settings because promptlyCode.apiKey is not a registered configuration.
            vscode.window.showErrorMessage("Failed to save settings");
          }
          break;
      }
    },
    undefined,
    context.subscriptions
  );
}

// Package.json configuration
const packageJsonConfig = {
  contributes: {
    configuration: {
      title: "PromptlyCode",
      properties: {
        "promptlyCode.apiKey": {
          type: "string",
          default: "",
          description: "LLM API key",
        },
        "promptlyCode.apiUrl": {
          type: "string",
          default: "https://openrouter.ai/api",
          description: "LLM API endpoint URL",
        },
        "promptlyCode.apiModel": {
          type: "string",
          default: "anthropic/claude-3.5-sonnet",
          description:
            "LLM AI model identifier (e.g., anthropic/claude-3.5-sonnet, openai/gpt-4o-2024-08-06)",
        },
        "promptlyCode.ragPyEnv": {
          type: "string",
          default:
            "source /opt/anaconda3/etc/profile.d/conda.sh &&  conda activate rag-code-sorting-search && cd /Users/clojure/Desktop/rag-code-sorting-search && PYTHONPATH='.:/Users/clojure/Desktop/rag-code-sorting-search' /Users/clojure/.local/bin/poetry run ",
          description:
            "If you need to configure rag, please check https://github.com/PromptlyCode/rag-code-sorting-search/",
        },
      },
    },
    commands: [
      {
        command: "promptlyCode.openSettings",
        title: "Open PromptlyCode Settings",
      },
    ],
  },
};
//

export function activate(context: vscode.ExtensionContext) {
  //
  // Register settings command
  let disposable0 = vscode.commands.registerCommand(
    "promptlyCode.openSettings",
    () => {
      showSettingsWebview(context);
    }
  );

  context.subscriptions.push(disposable0);

  // Check if API key is configured
  const config = vscode.workspace.getConfiguration("promptlyCode");
  const apiKey = config.get<string>("apiKey");

  if (!apiKey) {
    showSettingsWebview(context);
  }
  //

  let disposable = vscode.commands.registerCommand(
    "promptlyCode.askOpenAI",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      // Get the selected text
      const selection = editor.selection;
      const selectedCode = editor.document.getText(selection);
      const languageId = editor.document.languageId;

      if (!selectedCode) {
        vscode.window.showErrorMessage("Please select some code first");
        return;
      }

      // Get the API key from settings
      const config = vscode.workspace.getConfiguration("promptlyCode");
      let apiKey = config.get<string>("apiKey");
      const apiModel = config.get<string>("apiModel");
      const apiUrl = config.get<string>("apiUrl");

      // Show input box for the question: TODO: addr
      const question = await vscode.window.showInputBox({
        placeHolder: "What would you like to ask about this code?",
        prompt: "Enter your question",
      });

      if (!question) {
        return;
      }

      // Show progress indicator
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Processing with PromptlyCode...",
          cancellable: false,
        },
        async (progress) => {
          try {
            const newCode = await askAI(
              apiKey!,
              apiModel!,
              apiUrl!,
              question,
              selectedCode,
              languageId
            );

            // Replace the selected text with the new code
            await editor.edit((editBuilder) => {
              editBuilder.replace(selection, newCode);
            });

            // Show success message
            vscode.window.showInformationMessage("Code updated successfully!");
          } catch (error) {
            if (error instanceof Error) {
              // If API key is invalid, prompt for a new one
              if (error.message.includes("API key")) {
                vscode.window.showErrorMessage(
                  "Invalid API key. Please enter a new one. Please cmd/ctrl+shif+p input promptlyCode.openSettings to set key"
                );
              } else {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
              }
            } else {
              vscode.window.showErrorMessage("An unknown error occurred");
            }
          }
        }
      );
    }
  );

  context.subscriptions.push(disposable);

  //------ cmd-l -------------
  let currentPanel: vscode.WebviewPanel | undefined = undefined;

  let disposable2 = vscode.commands.registerCommand(
    "promptlyCode.startChat",
    () => {
      const currentChatSessionId = `session_${Date.now()}`;
      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Two);
      } else {
        currentPanel = vscode.window.createWebviewPanel(
          "PromptlyCodeAIChat",
          "PromptlyCode AI Chat",
          vscode.ViewColumn.Two,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        currentPanel.webview.html = getWebviewContent();


        // Handle messages from the webview
        currentPanel.webview.onDidReceiveMessage(
          async (message) => {
            switch (message.command) {
              case "sendMessage":
                try {
                  const config =
                    vscode.workspace.getConfiguration("promptlyCode");
                  let apiKey = config.get<string>("apiKey");
                  const apiModel = config.get<string>("apiModel");
                  const apiUrl = config.get<string>("apiUrl");
                  const response = await axios.post(
                    `${apiUrl}/v1/chat/completions`,
                    {
                      model: apiModel,
                      messages: [
                        { role: "system", content: systemDefaultPrompt },
                        { role: "user", content: message.text },
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
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  currentPanel?.webview.postMessage({
                    command: "receiveMessage",
                    text: response.data.choices[0].message.content,
                  });
                } catch (error) {
                  vscode.window.showErrorMessage(
                    "Error connecting to AI service"
                  );
                  console.error(error);
                }
                break;
            }
          },
          undefined,
          context.subscriptions
        );

        currentPanel.onDidDispose(
          () => {
            currentPanel = undefined;
          },
          null,
          context.subscriptions
        );
      }
    }
  );

  context.subscriptions.push(disposable2);

  // cmd-e
  // Register keyboard shortcut
  context.subscriptions.push(
    vscode.commands.registerCommand("promptlyCode.showGraphVisualization", () => {
      if (currentPanel) {
        currentPanel.reveal();
      } else {
        currentPanel = vscode.window.createWebviewPanel(
          "graphVisualization",
          "Graph Visualization",
          vscode.ViewColumn.Two,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        // Handle panel disposal
        currentPanel.onDidDispose(
          () => {
            currentPanel = undefined;
          },
          null,
          context.subscriptions
        );

        // Handle messages from webview
        currentPanel.webview.onDidReceiveMessage(
          (message) => {
            switch (message.command) {
              case "refresh":
                updateGraphVisualization(currentPanel, execAsync);
                break;
            }
          },
          undefined,
          context.subscriptions
        );

        updateGraphVisualization(currentPanel, execAsync);
      }
    })
  );

  //
  // Register the chat command (cmd+l)
  let openChat = vscode.commands.registerCommand(
    "promptlyCode.openChat",
    () => {
      const config = vscode.workspace.getConfiguration("promptlyCode");
      const apiKey = config.get<string>("apiKey");
      const apiModel = config.get<string>("apiModel");
      const apiUrl = config.get<string>("apiUrl");

      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Two);
      } else {
        createChatPanel(
          currentPanel,
          context,
          `${apiKey}`,
          `${apiModel}`,
          `${apiUrl}`
        );
      }
    }
  );

  context.subscriptions.push(openChat);

  // rag
  // Create output channel
  // TODO: rust rewrite it
  const outputChannel = vscode.window.createOutputChannel("RAG Search");

  // Register build command
  let buildDisposable = vscode.commands.registerCommand(
    "promptlyCode.ragSearchBuild",
    async () => {
      try {
        // Get workspace folder path
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          throw new Error("No workspace folder open");
        }
        const path = workspaceFolders[0].uri.fsPath;

        const config = vscode.workspace.getConfiguration("promptlyCode");
        let pyenv = config.get<string>("ragPyEnv");

        // Show progress indicator
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Building RAG index...",
            cancellable: false,
          },
          async () => {
            // Execute build command
            const { stdout, stderr } = await execAsync(
              `${pyenv} python rag_search_code.py build "${path}"`
            );

            if (stderr) {
              throw new Error(stderr);
            }

            // Show output
            outputChannel.show(true);
            outputChannel.appendLine("Build Results:");
            outputChannel.appendLine(stdout);

            vscode.window.showInformationMessage(
              "RAG index built successfully!"
            );
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to build RAG index: ${error}`);
      }
    }
  );

  // Register search command
  let searchDisposable = vscode.commands.registerCommand(
    "promptlyCode.ragSearchCode",
    async () => {
      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          throw new Error("No workspace folder open");
        }
        const path = workspaceFolders[0].uri.fsPath;

        const config = vscode.workspace.getConfiguration("promptlyCode");
        let pyenv = config.get<string>("ragPyEnv");

        // Get search query from user
        const query = await vscode.window.showInputBox({
          placeHolder: "Enter search query",
          prompt: "Search codebase using RAG",
        });

        if (!query) {
          return;
        }

        // Show progress indicator
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Searching...",
            cancellable: false,
          },
          async () => {
            // Execute search command
            const { stdout, stderr } = await execAsync(
              `${pyenv} python rag_search_code.py search "${path}" "${query}"`
            );

            if (stderr) {
              throw new Error(stderr);
            }

            // Show results in output channel
            outputChannel.show(true);
            outputChannel.appendLine(`\nSearch Results for: ${query}`);
            outputChannel.appendLine(stdout);
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Search failed: ${error}`);
      }
    }
  );

  context.subscriptions.push(buildDisposable, searchDisposable);

  //
  let disposable3 = vscode.commands.registerCommand(
    "promptlyCode.runPOC",
    async () => {
      // Get the current workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found");
        return;
      }

      // Get user input for the question
      const inputQuestion = await vscode.window.showInputBox({
        prompt: "Input requirements, generate Python prototype for verification and testing",
        placeHolder: "Type your requirements here",
      });

      if (!inputQuestion) {
        vscode.window.showErrorMessage("No input requirements provided");
        return;
      }

      // Show quick pick for POC type
      const pocType = await vscode.window.showQuickPick(
        ["poc python", "poc web",  "poc shell"],
        {
          placeHolder: "Select POC type",
        }
      );

      if (!pocType) {
        return;
      }

      // Get current working directory
      const currentPwd = workspaceFolder.uri.fsPath;

      // Construct command based on POC type
      let command = "";

      // TODO: refactor
      const pyenv = config.get<string>("ragPyEnv")!.replace(/rag-code-sorting-search/g, 'ai-automatic-env-build');

      const apiKey = config.get<string>("apiKey");

      if (pocType === "poc python") {
        command = `${pyenv} poetry run python poc_python.py -r "${inputQuestion}" -w "${currentPwd}" --api-key "${apiKey}"`;
      } else if (pocType === "poc web") {
        command = `${pyenv} poetry run python poc_web.py -r "${inputQuestion}" -w "${currentPwd}" --api-key "${apiKey}"`;
      } else {
        command = `${pyenv} poetry run python poc_shell.py "${inputQuestion}" "${currentPwd}"`;
      }

      // Create and show output channel
      const outputChannel = vscode.window.createOutputChannel("POC Runner");
      outputChannel.show();

      // Execute command
      const terminal = vscode.window.createTerminal("POC Runner");
      terminal.show();
      terminal.sendText(command);

      // Execute in background and show output
      exec(command, { cwd: currentPwd }, (error, stdout, stderr) => {
        if (error) {
          outputChannel.appendLine(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          outputChannel.appendLine(`stderr: ${stderr}`);
        }
        outputChannel.appendLine(stdout);
      });
    }
  );

  context.subscriptions.push(disposable3);
  //

  const chatView = new ChatView(context);

  // Add a keybinding for Ctrl+Y to open the chat view
  context.subscriptions.push(
      vscode.commands.registerCommand('aiChat.openChatWindowShortcut', () => {
          vscode.commands.executeCommand('aiChat.openChatWindow');
      })
  );
  
}

function extractCodeFromResponse(response: string): string {
  // Try to find code between markdown code blocks
  const markdownMatch = response.match(/```(?:\w+)?\n([\s\S]+?)\n```/);
  if (markdownMatch) {
    return markdownMatch[1].trim();
  }

  // If no markdown blocks found, attempt to extract just the code section
  const codeMatch = response.match(
    /(?:Here's the code:|Here is the code:)\n*([\s\S]+)$/i
  );
  if (codeMatch) {
    return codeMatch[1].trim();
  }

  // If no specific markers found, return the whole response
  return response.trim();
}

async function askAI(
  apiKey: string,
  model: string,
  modelUrl: string,
  question: string,
  code: string,
  languageId: string
): Promise<string> {
  try {
    const fullPrompt = `I have this code, use language ${languageId}:

${code}

${question}

Please provide only the modified code without any explanation or markdown tags. Do not include \`\`\` markers. Just return the code that should replace the current selection.`;

    const response = await axios.post(
      `${modelUrl}/v1/chat/completions`,
      {
        model: model,
        messages: [
          {
            role: "system",
            content: systemDefaultPrompt,
          },
          {
            role: "user",
            content: fullPrompt,
          },
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
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responseContent = response.data.choices[0].message.content;
    return extractCodeFromResponse(responseContent);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 401) {
        throw new Error("Invalid API key");
      }
      throw new Error(`API error: ${error.response.data.error.message}`);
    }
    throw error;
  }
}

export function deactivate() {}
