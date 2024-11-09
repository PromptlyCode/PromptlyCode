import * as ts from "typescript";
import * as fs from "fs";

// Function to parse TypeScript source code and return the AST
function getSourceFile(fileName: string): ts.SourceFile | undefined {
    const program = ts.createProgram([fileName], {});
    return program.getSourceFile(fileName);
}

// Function to traverse the AST and find function call relationships
function extractFunctionCalls(sourceFile: ts.SourceFile) {
    const functionCalls: { [key: string]: string[] } = {};
    let currentFunction: string | null = null;

    function visit(node: ts.Node) {
        // Log the node for debugging
        console.log("Visiting node:", ts.SyntaxKind[node.kind]);

        // Check if the node is a function declaration and has a valid name
        if (ts.isFunctionDeclaration(node) && node.name) {
            currentFunction = node.name.getText(sourceFile);
            if (!functionCalls[currentFunction]) {
                functionCalls[currentFunction] = [];
            }
        }

        // Check if the node is a call expression and if it has a valid expression (function name)
        else if (ts.isCallExpression(node) && node.expression) {
            const functionName = node.expression.getText(sourceFile);
            if (currentFunction && functionName) {
                functionCalls[currentFunction].push(functionName);
            }
        }

        // Recursively visit child nodes
        ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    return functionCalls;
}

// Function to generate Graphviz DOT format from the function call relationships
function generateGraphviz(functionCalls: { [key: string]: string[] }): string {
    let graph = "digraph G {\n";
    for (const caller in functionCalls) {
        const callees = functionCalls[caller];
        for (const callee of callees) {
            graph += `    "${caller}" -> "${callee}";\n`;
        }
    }
    graph += "}";
    return graph;
}

// Main function to parse TypeScript file and output the Graphviz DOT format
export function parseFileTs(fileName: string) {
    const sourceFile = getSourceFile(fileName);
    
    if (!sourceFile) {
        console.error(`Could not read source file: ${fileName}`);
        return;
    }

    console.log(`Parsing file: ${fileName}`);
    
    const functionCalls = extractFunctionCalls(sourceFile);
    const graphvizOutput = generateGraphviz(functionCalls);

    // Write the DOT file
    const outputFileName = fileName.replace(".ts", ".dot");
    fs.writeFileSync(outputFileName, graphvizOutput);
    console.log(`Graphviz DOT output written to ${outputFileName}`);
}
