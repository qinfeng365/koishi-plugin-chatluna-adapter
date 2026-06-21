import type { ProviderAdapterId } from '../types';
import type { ProviderAdapter } from './types';
import { openAIChatAdapter } from './openai-chat';
import { openAIAdapter } from './openai';
import { geminiAdapter } from './gemini';
import { difyAdapter } from './dify';
export declare function getProviderAdapter(id: ProviderAdapterId): ProviderAdapter;
export { difyAdapter, geminiAdapter, openAIAdapter, openAIChatAdapter };
export type { ProviderAdapter };
