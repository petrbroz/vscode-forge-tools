import * as vscode from 'vscode';

const BASE_PROMPT = `You are a programming assistant specializing in Autodesk Platform Services (APS).
Your goal is to help developers understand concepts related to APS and provide practical programming
solutions using the official Autodesk Platform Services SDK.`;

// TODO: include an external (DAS-maintained?) vector store for RAG
// TODO: consider using @vscode/chat-extension-utils when it's more stable

export const chatRequestHandler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
    // Prepare initial set of messages
    let messages = [vscode.LanguageModelChatMessage.User(BASE_PROMPT)];
    for (const turn of context.history) {
        if (turn instanceof vscode.ChatResponseTurn) {
            const message = turn.response.filter(r => r instanceof vscode.ChatResponseMarkdownPart).reduce((acc, part) => acc + part.value.value, '');
            messages.push(vscode.LanguageModelChatMessage.Assistant(message));
        }
    }

    // Make sure we have a model that supports tools
    let model = request.model;
    if (model.vendor === 'copilot' && model.family.startsWith('o1')) {
        // The o1 models do not currently support tools
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
        model = models[0];
    }

    // Recursively send requests to Copilot and process tool calls
    const tools = vscode.lm.tools.filter(tool => tool.tags.includes('sample'));
    const runWithTools = async (): Promise<void> => {
        const toolCalls: vscode.LanguageModelToolCallPart[] = [];
        const chatResponse = await model.sendRequest(messages.concat([vscode.LanguageModelChatMessage.User(request.prompt)]), { tools }, token);
        for await (const part of chatResponse.stream) {
            if (part instanceof vscode.LanguageModelTextPart) {
                stream.markdown(part.value);
            } else if (part instanceof vscode.LanguageModelToolCallPart) {
                toolCalls.push(part);
            }
        }
        if (toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
                const toolResponse = await vscode.lm.invokeTool(toolCall.name, {
                    input: toolCall.input,
                    toolInvocationToken: request.toolInvocationToken,
                }, token);
                messages.push(vscode.LanguageModelChatMessage.Assistant([toolCall]));
                messages.push(vscode.LanguageModelChatMessage.User([new vscode.LanguageModelToolResultPart(toolCall.callId, toolResponse.content)]));
            }
            return runWithTools();
        }
    };
    await runWithTools();
};
