export interface UploadedImage {
  base64: string;
  mimeType: string;
}

export type PrebuiltVoice = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface StoryPageData {
  pageNumber: number;
  text: string;
  imagePrompt: string;
  imageUrl: string;
  audioData: string;
}

export interface StoryContentResponse {
    storyText: string;
    imagePrompt: string;
}

export interface GenerationStatus {
  isLoading: boolean;
  message: string;
}

// Fix: Create a named interface for `aistudio` to resolve declaration conflicts.
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

// Adiciona aistudio ao objeto global window para verificação da chave de API do Veo
declare global {
  interface Window {
    aistudio: AIStudio;
  }
}
