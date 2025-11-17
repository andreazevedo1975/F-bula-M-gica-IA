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
// FIX: Inlining the type definition for `window.aistudio` to resolve conflicting type declarations.
// This avoids potential name collisions with other `AIStudio` interfaces.
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
    mammoth: any;
  }
}
