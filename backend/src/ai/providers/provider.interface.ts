import type { LLMRequest, LLMResponse } from "../../services/llm.service";

export interface AIProvider {
  name: string;
  generate(request: LLMRequest): Promise<LLMResponse>;
}
