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
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // FIX: Added `readonly` modifier to resolve conflict with another global declaration of 'aistudio'.
    readonly aistudio: AIStudio;
    mammoth: any;
  }
}