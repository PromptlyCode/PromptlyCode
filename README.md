# [Promptly Code](http://www.promptlycode.com)
* Promptly Code, AI automatic programming vscode extension, Inspired by [cursor](https://www.cursor.com/)
* VSCode plugin search [PromptlyCode](https://marketplace.visualstudio.com/items?itemName=PromptlyCode.promptlycode): https://marketplace.visualstudio.com/items?itemName=PromptlyCode.promptlycode

[![Watch the video](./youtube_cover.png)](https://youtu.be/pFg-tJSIFnI)

## Features

* For more information, please visit http://www.promptlycode.com

- [x] Cmd+k code question modification
- [x] Cmd+l chat for code
- [x] Chat markdown render, code highlight
- [x] View the graphviz diagram of the function relationship
- [x] AI reads local files, writes files, obtains file status, etc. 
- [x] Support RAG code search by ollama nomic-embed-text: https://github.com/PromptlyCode/rag-code-sorting-search  `rag_search_code.py build path & rag_search_code.py search 'query'`
- [x] Multi-agent technology encapsulates a Docker automatic environment verification,and uses ReAct for environment feedback and error correction, and AI automatic environment construction and repair: https://github.com/PromptlyCode/ai-automatic-env-build
- [x] Support rapid prototyping verification POC AI programming
- [ ] Tab automatically complete code and predict code use vscode inline completion: https://github.com/PromptlyCode/inline-completion-model
- [ ] Support voice wake-up interactive programming

## Usage

* VSCode plugin search `PromptlyCode` and install

![](./PromptlyCode_in_VSCode.png)

* `cmd+k` for code question

![](./select-ask.gif)

* `cmd+l` chat for code

![](./ai-chat.gif)

* `cmd-e` show function relationship

![](./show_fun_refs.gif)

## Develop

```sh
cd PromptlyCode && yarn
vscode PromptlyCode
```

* 1. Inside the editor, open `src/extension.ts` and press `F5` or run the command `Debug: Start Debugging from the Command Palette` (⇧⌘P). This will compile and run the extension in a new `Extension Development Host window`.

* 2. Select some code and then press `cmd+k`

* 3. Press `cmd+l` and input content to chat

