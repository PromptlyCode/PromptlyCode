// src/extension.ts
import * as vscode from "vscode";
import axios from "axios";
import { getWebviewContent } from "./codeChat";
import { updateGraphVisualization } from "./parse_typescript/show_graph";
import { completionItems } from './tab_auto_complete/yasnippet'
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
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
          title: "Processing with Claude...",
          cancellable: false,
        },
        async (progress) => {
          try {
            const newCode = await askAI(apiKey!, question, selectedCode);

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
                    "https://openrouter.ai/api/v1/chat/completions",
                    {
                      model: "anthropic/claude-3.5-sonnet",
                      messages: [{ role: "user", content: message.text }],
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

  // --- tab
  // Register the completion provider
  const provider3 = vscode.languages.registerCompletionItemProvider(
    // Define which file types to provide completions for
    { scheme: "file", language: "javascript" },
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        // Create array for completion items
        const completions: vscode.CompletionItem[] = [];

        // Get the current line text and position
        const linePrefix = document
          .lineAt(position)
          .text.substr(0, position.character);

        // Add completion items
        completionItems.forEach((item) => {
          const completion = new vscode.CompletionItem(item.label);
          completion.kind = vscode.CompletionItemKind.Snippet;
          completion.detail = item.detail;
          completion.documentation = new vscode.MarkdownString(
            item.documentation
          );

          // Use a snippet for insert text
          completion.insertText = new vscode.SnippetString(item.insertText);

          completions.push(completion);
        });

        return completions;
      },
    }
  );

  // Push the provider to subscriptions
  context.subscriptions.push(provider3);
  //---
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
  code: string
): Promise<string> {
  try {
    const fullPrompt = `I have this code:

${code}

${question}

Please provide only the modified code without any explanation or markdown tags. Do not include \`\`\` markers. Just return the code that should replace the current selection.`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "anthropic/claude-3.5-sonnet",
        messages: [
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
