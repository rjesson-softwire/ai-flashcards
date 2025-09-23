export interface LLMConfig {
  baseUrl: string
  model: string
  defaultApiKey: string
}

export const getLLMConfig = (): LLMConfig => {
  return {
    baseUrl: process.env.INFERENCE_SERVER_URL || 'http://localhost:1234/v1',
    model: process.env.MODEL_NAME || 'llama-3.2-1b-instruct',
    defaultApiKey: process.env.LLM_API_KEY || 'local_server'
  }
}
