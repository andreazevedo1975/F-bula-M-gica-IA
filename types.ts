export interface UploadedImage {
  base64: string;
  mimeType: string;
}

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