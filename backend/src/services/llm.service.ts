export interface LLMRequest {
    prompt: string;
}

export interface LLMResponse {
    content: string;
}

export interface LLMProvider {
    generate(
        request: LLMRequest
    ): Promise<LLMResponse>;
}