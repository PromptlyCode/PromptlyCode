// src/extension.ts
import * as vscode from "vscode";
import axios from "axios";
import { getWebviewContent } from "./codeChat";
import { updateGraphVisualization } from "./parse_typescript/show_graph";
import { completionItems } from "./tab_auto_complete/yasnippet";
import { createChatPanel } from "./function_calling/tools";
import { exec } from "child_process";
import { promisify } from "util";
import { model, modelUrl, systemDefaultPrompt } from "./config";

const execAsync = promisify(exec);
let currentPanel: vscode.WebviewPanel | undefined = undefined;

//
interface PromptlyCodeConfig {
  apiKey: string;
  apiUrl: string;
  apiModel: string;
}

const DEFAULT_CONFIG: PromptlyCodeConfig = {
  apiKey: '',
  apiUrl: 'https://openrouter.ai/api',
  apiModel: 'anthropic/claude-3.5-sonnet',
};

export function getSettingsWebviewContent(currentConfig: PromptlyCodeConfig): string {
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
                <label for="apiKey">OpenRouter API Key</label>
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

            <button type="submit">Save Settings</button>
        </form>

        <script>
            const vscode = acquireVsCodeApi();
            const form = document.getElementById('settingsForm');
            const apiKeyInput = document.getElementById('apiKey');
            const apiUrlInput = document.getElementById('apiUrl');
            const apiModelInput = document.getElementById('apiModel');
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
                    apiModel
                });
            });
        </script>
    </body>
    </html>`;
}

export async function showSettingsWebview(context: vscode.ExtensionContext): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'promptlyCodeSettings',
    'PromptlyCode Settings',
    vscode.ViewColumn.One,
    {
      enableScripts: true
    }
  );

  const config = vscode.workspace.getConfiguration('promptlyCode');
  const currentConfig: PromptlyCodeConfig = {
    apiKey: config.get('apiKey', DEFAULT_CONFIG.apiKey),
    apiUrl: config.get('apiUrl', DEFAULT_CONFIG.apiUrl),
    apiModel: config.get('apiModel', DEFAULT_CONFIG.apiModel)
  };

  panel.webview.html = getSettingsWebviewContent(currentConfig);

  panel.webview.onDidReceiveMessage(
    async message => {
      switch (message.command) {
        case 'saveSettings':
          try {
            await config.update('apiKey', message.apiKey, true);
            await config.update('apiUrl', message.apiUrl, true);
            await config.update('apiModel', message.apiModel, true);
            vscode.window.showInformationMessage('Settings saved successfully!');
            panel.dispose();
          } catch (error) {
            vscode.window.showErrorMessage('Failed to save settings');
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
  "contributes": {
    "configuration": {
      "title": "PromptlyCode",
      "properties": {
        "promptlyCode.apiKey": {
          "type": "string",
          "default": "",
          "description": "LLM API key"
        },
        "promptlyCode.apiUrl": {
          "type": "string",
          "default": "https://openrouter.ai/api",
          "description": "LLM API endpoint URL"
        },
        "promptlyCode.apiModel": {
          "type": "string",
          "default": "anthropic/claude-3.5-sonnet",
          "description": "LLM AI model identifier (e.g., anthropic/claude-3.5-sonnet, openai/gpt-4o-2024-08-06)"
        }
      }
    },
    "commands": [
      {
        "command": "promptlyCode.openSettings",
        "title": "Open PromptlyCode Settings"
      }
    ]
  }
};
//

export function activate(context: vscode.ExtensionContext) {
  //
    // Register settings command
    let disposable0 = vscode.commands.registerCommand('promptlyCode.openSettings', () => {
      showSettingsWebview(context);
    });
  
    context.subscriptions.push(disposable0);
  
    // Check if API key is configured
    const config = vscode.workspace.getConfiguration('promptlyCode');
    const apiKey = config.get<string>('apiKey');
    
    if (!apiKey) {
      showSettingsWebview(context);
    }  
  //

  let disposable = vscode.commands.registerCommand(
    "promptly-code.askOpenAI",
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
      const config = vscode.workspace.getConfiguration("openaiHelper");
      let apiKey = config.get<string>("apiKey");

      // If API key is not set, prompt for it
      if (!apiKey) {
        apiKey = await promptForApiKey();
        if (!apiKey) {
          return; // User cancelled the input
        }
      }

      // Show input box for the question
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
            const newCode = await askAI(apiKey!, question, selectedCode, languageId);

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
                  "Invalid API key. Please enter a new one."
                );
                await promptForApiKey();
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
    "promptly-code.startChat",
    () => {
      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Two);
      } else {
        currentPanel = vscode.window.createWebviewPanel(
          "openaiChat",
          "AI Chat",
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
                    vscode.workspace.getConfiguration("openaiHelper");
                  let apiKey = config.get<string>("apiKey");
                  const response = await axios.post(
                    `${modelUrl}/v1/chat/completions`,
                    {
                      model: model,
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
    vscode.commands.registerCommand("extension.showGraphVisualization", () => {
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
    "promptly-code.openChat",
    () => {
      const config = vscode.workspace.getConfiguration("openaiHelper");
      let apiKey = config.get<string>("apiKey");

      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Two);
      } else {
        createChatPanel(currentPanel, context, `${apiKey}`);
      }
    }
  );

  context.subscriptions.push(openChat);
}

async function promptForApiKey(): Promise<string | undefined> {
  const result = await vscode.window.showInputBox({
    prompt: "Please enter your OpenRouter API key",
    placeHolder: "sk-or-...",
    password: true,
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      if (!value.startsWith("sk-or-")) {
        return 'OpenRouter API key should start with "sk-or-"';
      }
      if (value.length < 20) {
        return "API key seems too short";
      }
      return null;
    },
  });

  if (result) {
    const config = vscode.workspace.getConfiguration("openaiHelper");
    await config.update("apiKey", result, true);
    vscode.window.showInformationMessage("API key saved successfully!");
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
