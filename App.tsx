
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { StoryGeneratorForm } from './components/StoryGeneratorForm';
import { StorybookView } from './components/StorybookView';
import LoadingIndicator from './components/LoadingIndicator';
import { generateTitleFromPlot, generateStoryContent, generateImage, generateSpeech, generateStoryVideo } from './services/geminiService';
import type { StoryPageData, GenerationStatus, UploadedImage } from './types';

function App() {
  const [storyPages, setStoryPages] = useState<StoryPageData[]>([]);
  const [storyTitle, setStoryTitle] = useState<string>('');
  const [characterImageForStory, setCharacterImageForStory] = useState<UploadedImage | null>(null);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
    isLoading: false,
    message: ''
  });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoGenerationStatus, setVideoGenerationStatus] = useState<GenerationStatus>({
    isLoading: false,
    message: ''
  });
  const [error, setError] = useState<string | null>(null);

  // Efeito para limpar a URL do objeto de vídeo para evitar vazamentos de memória
  useEffect(() => {
    const currentVideoUrl = videoUrl;
    return () => {
      if (currentVideoUrl && currentVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentVideoUrl);
      }
    };
  }, [videoUrl]);

  const handleGenerateStory = async (plot: string, numPages: number, characterImage: UploadedImage | null) => {
    setGenerationStatus({ isLoading: true, message: 'Invocando um título encantado...' });
    setError(null);
    setStoryPages([]);
    setStoryTitle('');
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl); // Limpa a URL do vídeo anterior
    }
    setVideoUrl(null);
    setVideoGenerationStatus({ isLoading: false, message: '' });
    setCharacterImageForStory(characterImage);

    try {
      // 1. Generate title from plot
      const title = await generateTitleFromPlot(plot, characterImage);
      setStoryTitle(title);
      
      setGenerationStatus({ isLoading: true, message: 'Tecendo os fios da sua aventura...' });

      // 2. Generate story text and image prompts from plot
      const storyContent = await generateStoryContent(plot, numPages, characterImage);
      
      const pagesWithPrompts: Omit<StoryPageData, 'imageUrl' | 'audioData'>[] = storyContent.map((page, index) => ({
        pageNumber: index + 1,
        text: page.storyText,
        imagePrompt: page.imagePrompt
      }));

      const generatedPages: StoryPageData[] = [];
      for (let i = 0; i < pagesWithPrompts.length; i++) {
        const page = pagesWithPrompts[i];
        
        // 3. Generate image
        setGenerationStatus({ 
          isLoading: true, 
          message: `Pintando a magia na página ${i + 1} de ${numPages}...` 
        });
        const imageUrl = await generateImage(page.imagePrompt, characterImage);

        // 4. Generate audio
         setGenerationStatus({ 
          isLoading: true, 
          message: `Dando voz à história na página ${i + 1} de ${numPages}...` 
        });
        const audioData = await generateSpeech(page.text);

        generatedPages.push({ ...page, imageUrl, audioData });
        setStoryPages([...generatedPages]); // Update state incrementally
      }

      setGenerationStatus({ isLoading: false, message: '' });
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao gerar a história. Por favor, tente novamente.');
      setGenerationStatus({ isLoading: false, message: '' });
    }
  };

  const handleGenerateVideo = async () => {
    if (!storyPages.length) return;
    
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
    setError(null);

    try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
            // Fix: Per guidelines, assume key selection was successful and proceed.
            // If user cancels or key is invalid, the API call will fail and be caught by the catch block.
        }

        setVideoGenerationStatus({ isLoading: true, message: 'Preparando a animação mágica...' });
        
        const aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const url = await generateStoryVideo(
            aiInstance,
            storyTitle,
            storyPages[0],
            (message: string) => setVideoGenerationStatus({ isLoading: true, message })
        );
        
        setVideoUrl(url);
        setVideoGenerationStatus({ isLoading: false, message: 'Seu desenho animado está pronto!' });
    } catch (err: any) {
        console.error("Erro ao gerar vídeo:", err);
        const errorString = JSON.stringify(err);
        if (errorString.includes("Requested entity was not found")) {
            setError("Sua chave de API pode não ter acesso ao Veo. Por favor, selecione uma chave diferente e tente novamente. Visite ai.google.dev/gemini-api/docs/billing para mais informações.");
            // Per guidelines, prompt the user to select a new key.
            window.aistudio.openSelectKey();
        } else {
            setError('Ocorreu um erro ao gerar o vídeo. Por favor, tente novamente.');
        }
        setVideoGenerationStatus({ isLoading: false, message: '' });
    }
};


  const handleUpdatePage = (updatedPage: StoryPageData) => {
    setStoryPages(prevPages => 
      prevPages.map(p => p.pageNumber === updatedPage.pageNumber ? updatedPage : p)
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8 font-nunito">
      <header className="w-full max-w-5xl text-center mb-10">
        <h1 className="text-5xl sm:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 font-lora">
          Fábula Mágica AI
        </h1>
        <p className="mt-4 text-lg text-gray-300">
          Onde a imaginação dos seus filhos ganha vida. Crie, ilustre e narre fábulas mágicas e personalizadas em minutos.
        </p>
      </header>
      
      <main className="w-full max-w-5xl flex-grow">
        <div className="glass-card p-6 sm:p-8 rounded-2xl mb-8">
          <StoryGeneratorForm onGenerate={handleGenerateStory} isLoading={generationStatus.isLoading} />
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center mb-8">
            <p>{error}</p>
          </div>
        )}

        {generationStatus.isLoading && <LoadingIndicator message={generationStatus.message} />}

        {storyPages.length > 0 && (
          <div id="storybook-container">
            <StorybookView 
              title={storyTitle} 
              pages={storyPages} 
              onUpdatePage={handleUpdatePage}
              characterImage={characterImageForStory}
              videoUrl={videoUrl}
              videoGenerationStatus={videoGenerationStatus}
              onGenerateVideo={handleGenerateVideo}
            />
          </div>
        )}
      </main>
      <footer className="w-full max-w-4xl text-center mt-12 text-gray-500 text-sm">
        <p>Desenvolvido com Google Gemini</p>
      </footer>
    </div>
  );
}

export default App;