import type { ProviderAdapterId } from '../types';
import type { ProviderAdapter } from './types';
import { openAIChatAdapter } from './openai-chat';
import { openAIAdapter } from './openai';
import { geminiAdapter } from './gemini';
export declare function getProviderAdapter(id: ProviderAdapterId): ProviderAdapter;
export { geminiAdapter, openAIAdapter, openAIChatAdapter };
export type { ProviderAdapter };
