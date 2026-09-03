export interface LLMRequest {
    prompt: string;
    options?: AIRequestOptions;
}

export interface LLMResponse {
    provider?: string;
    model?: string;
    content: string;
    usage?: AIUsage;
}

export interface AIRequestOptions {
    timeoutMs?: number;
}

export interface AIUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
}

export interface LLMProvider {
    generate(
        request: LLMRequest
    ): Promise<LLMResponse>;
}