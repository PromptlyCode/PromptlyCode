// This interface defines the structure of our completion items
interface CompletionItem {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
}

// Sample completion items - you can expand this list
export const completionItems: CompletionItem[] = [
  {
    label: "console.log",
    detail: "Print to console",
    documentation: "Outputs a message to the console",
    insertText: "console.log($1);",
  },
  {
    label: "if",
    detail: "If statement",
    documentation: "Conditional if statement",
    insertText: "if ($1) {\n\t$2\n}",
  },
  {
    label: "function",
    detail: "Function declaration",
    documentation: "Creates a new function",
    insertText: "function $1($2) {\n\t$3\n}",
  },
];
//-----

  // // --- tab
  // // Register the completion provider
  // const provider3 = vscode.languages.registerCompletionItemProvider(
  //   // Define which file types to provide completions for
  //   { scheme: "file", language: "javascript" },
  //   {
  //     provideCompletionItems(
  //       document: vscode.TextDocument,
  //       position: vscode.Position
  //     ) {
  //       // Create array for completion items
  //       const completions: vscode.CompletionItem[] = [];

  //       // Get the current line text and position
  //       const linePrefix = document
  //         .lineAt(position)
  //         .text.substr(0, position.character);

  //       // Add completion items
  //       completionItems.forEach((item) => {
  //         const completion = new vscode.CompletionItem(item.label);
  //         completion.kind = vscode.CompletionItemKind.Snippet;
  //         completion.detail = item.detail;
  //         completion.documentation = new vscode.MarkdownString(
  //           item.documentation
  //         );

  //         // Use a snippet for insert text
  //         completion.insertText = new vscode.SnippetString(item.insertText);

  //         completions.push(completion);
  //       });

  //       return completions;
  //     },
  //   }
  // );

  // // Push the provider to subscriptions
  // context.subscriptions.push(provider3);

  // //--- inline comp
  // // Register the inline completion provider with specific trigger characters
  // const provider4 = vscode.languages.registerCompletionItemProvider(
  //   { scheme: "file", language: "python" },
  //   {
  //     provideCompletionItems(
  //       document: vscode.TextDocument,
  //       position: vscode.Position,
  //       token: vscode.CancellationToken,
  //       context: vscode.CompletionContext
  //     ) {
  //       const linePrefix = document
  //         .lineAt(position)
  //         .text.substring(0, position.character);

  //       // If we detect 'def' being typed
  //       if (
  //         linePrefix.trim() === "def" ||
  //         linePrefix.trim().startsWith("def ")
  //       ) {
  //         const functionDefinitions: vscode.CompletionItem[] = [];

  //         // Scan the document for existing function definitions
  //         for (let i = 0; i < document.lineCount; i++) {
  //           const line = document.lineAt(i).text;
  //           const funcMatch = line.match(/def\s+(\w+)\s*\((.*?)\):/);
  //           if (funcMatch) {
  //             const [_, functionName, params] = funcMatch;
  //             const completionItem = new vscode.CompletionItem(
  //               functionName,
  //               vscode.CompletionItemKind.Function
  //             );

  //             // Set the text to be inserted
  //             completionItem.insertText = new vscode.SnippetString(
  //               `${functionName}():\n    $0`
  //             );

  //             // Add documentation
  //             completionItem.documentation = new vscode.MarkdownString(
  //               `Function signature: def ${functionName}(${params})`
  //             );

  //             // Set sort text to ensure it appears at the top
  //             completionItem.sortText = "0" + functionName;

  //             // Make it preselected
  //             completionItem.preselect = true;

  //             functionDefinitions.push(completionItem);
  //           }
  //         }

  //         return functionDefinitions;
  //       }

  //       return undefined;
  //     },
  //   },
  //   // Trigger on space after 'def'
  //   " "
  // );

  // // Register another provider for function name completion
  // const functionNameProvider = vscode.languages.registerCompletionItemProvider(
  //   { scheme: "file", language: "python" },
  //   {
  //     provideCompletionItems(
  //       document: vscode.TextDocument,
  //       position: vscode.Position
  //     ) {
  //       const linePrefix = document
  //         .lineAt(position)
  //         .text.substring(0, position.character);

  //       // If we're in a function definition line
  //       if (linePrefix.trim().startsWith("def ")) {
  //         const functionDefinitions: vscode.CompletionItem[] = [];

  //         // Scan document for existing functions
  //         for (let i = 0; i < document.lineCount; i++) {
  //           const line = document.lineAt(i).text;
  //           const funcMatch = line.match(/def\s+(\w+)\s*\((.*?)\):/);
  //           if (funcMatch) {
  //             const [_, functionName, params] = funcMatch;
  //             const completionItem = new vscode.CompletionItem(
  //               functionName,
  //               vscode.CompletionItemKind.Function
  //             );

  //             completionItem.insertText = new vscode.SnippetString(
  //               `${functionName}($1):\n    $0`
  //             );

  //             completionItem.documentation = new vscode.MarkdownString(
  //               `Existing function: ${functionName}(${params})`
  //             );

  //             // Show immediately without requiring additional typing
  //             completionItem.preselect = true;
  //             completionItem.sortText = "0" + functionName;

  //             functionDefinitions.push(completionItem);
  //           }
  //         }

  //         return functionDefinitions;
  //       }

  //       return undefined;
  //     },
  //   }
  // );

  // // Enable the inline suggestions setting
  // vscode.workspace
  //   .getConfiguration("editor")
  //   .update("inlineSuggestions.enabled", true, true);
  // vscode.workspace.getConfiguration("editor").update(
  //   "quickSuggestions",
  //   {
  //     other: true,
  //     comments: false,
  //     strings: false,
  //   },
  //   true
  // );

  // // Add both providers to subscriptions
  // context.subscriptions.push(provider4, functionNameProvider);
