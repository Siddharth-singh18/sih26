import axios from 'axios';

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqChatOptions {
  responseFormatJson?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface GroqChatResult {
  success: boolean;
  content: string;
  parsedJson?: any;
  modelUsed: string;
  fallback: boolean;
  fallbackReason?: string;
}

const DEFAULT_MODEL = 'qwen/qwen3.8-27b';
const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export function isGroqConfigured(): boolean {
  const key = process.env.GROQ_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_MODEL;
}

/**
 * Execute a chat completion call to Groq LLM with medical-grade determinism,
 * timeout protection, and structured JSON parsing.
 */
export async function callGroqChat(
  messages: GroqChatMessage[],
  options: GroqChatOptions = {}
): Promise<GroqChatResult> {
  const model = getGroqModel();
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      content: '',
      modelUsed: model,
      fallback: true,
      fallbackReason: 'GROQ_API_KEY_NOT_CONFIGURED'
    };
  }

  const temperature = options.temperature ?? 0.1;
  const maxTokens = options.maxTokens ?? 1024;
  const timeoutMs = options.timeoutMs ?? 8000;

  try {
    const payload: Record<string, any> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (options.responseFormatJson) {
      payload.response_format = { type: 'json_object' };
    }

    const response = await axios.post(
      GROQ_API_ENDPOINT,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: timeoutMs
      }
    );

    const rawChoice = response.data?.choices?.[0]?.message?.content || '';
    let parsedJson: any = undefined;

    if (options.responseFormatJson && rawChoice) {
      try {
        parsedJson = JSON.parse(rawChoice);
      } catch (err) {
        const match = rawChoice.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsedJson = JSON.parse(match[0]);
          } catch {
            // Json parse failed
          }
        }
      }
    }

    return {
      success: true,
      content: rawChoice,
      parsedJson,
      modelUsed: response.data?.model || model,
      fallback: false
    };
  } catch (error: any) {
    const reason = error.code === 'ECONNABORTED'
      ? 'GROQ_TIMEOUT'
      : error.response?.status
      ? `GROQ_HTTP_${error.response.status}`
      : error.message || 'GROQ_ERROR';

    return {
      success: false,
      content: '',
      modelUsed: model,
      fallback: true,
      fallbackReason: reason
    };
  }
}
