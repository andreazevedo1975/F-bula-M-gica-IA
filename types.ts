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

// Adiciona aistudio ao objeto global window para verificação da chave de API do Veo
// Fix: Defined a global `AIStudio` interface to resolve conflicting type declarations for `window.aistudio`.

// FIX: Moved the `AIStudio` interface out of `declare global` to prevent name collisions.
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    aistudio: AIStudio;
    mammoth: any;
  }
}
