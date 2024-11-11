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
