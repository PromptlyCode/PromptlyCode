import * as vscode from 'vscode';

export class ResizableQuickInput {
    private quickPick: vscode.QuickPick<vscode.QuickPickItem>;
    private dimension: { width: number; height: number } = { width: 800, height: 600 };
    private position: { x: number; y: number } = { x: 100, y: 600 };

    constructor() {
        this.quickPick = vscode.window.createQuickPick();
        this.quickPick.placeholder = 'Edit, refactor, or add code (/ for commands)';
        
        // Add custom styling through VS Code API
        this.quickPick.buttons = [
            {
                iconPath: new vscode.ThemeIcon('gripper'),
                tooltip: 'Resize'
            }
        ];
    }

    public async show(): Promise<string | undefined> {
        return new Promise((resolve) => {
            // Style the QuickPick through the VS Code API
            const quickPickOptions: vscode.QuickPickOptions = {
                placeHolder: 'Edit, refactor, or add code (/ for commands)',
                ignoreFocusOut: true
            };

            // Handle input submission
            this.quickPick.onDidAccept(() => {
                const value = this.quickPick.value;
                this.quickPick.hide();
                resolve(value);
            });

            this.quickPick.onDidHide(() => {
                resolve(undefined);
            });

            // Handle window resizing through VS Code commands
            this.quickPick.onDidTriggerButton(async (button) => {
                if (button.tooltip === 'Resize') {
                    // Use VS Code's native resize command
                    await vscode.commands.executeCommand('workbench.action.toggleMaximizedPanel');
                }
            });

            this.quickPick.show();
        });
    }

    public dispose() {
        this.quickPick.dispose();
    }
}