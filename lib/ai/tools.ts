// Agent/tool execution remains independent from model transports. No tools are advertised
// to a model until an executor, permission policy and provider tool loop are implemented.
export interface ToolContext { userId: string; conversationId: string; signal: AbortSignal }
export interface AITool<Input = unknown, Output = unknown> {
  name: string; description: string; parameters: Record<string, unknown>;
  validate(input: unknown): Input;
  requiresConfirmation: boolean;
  execute(input: Input, context: ToolContext): Promise<Output>;
}
export interface RepositoryToolResult { path: string; originalHash: string; proposedContent: string; patch?: string }
export const registeredTools: ReadonlyMap<string, AITool> = new Map();
