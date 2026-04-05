import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (_client) return _client;
  _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}
