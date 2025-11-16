import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { StoryGeneratorForm } from './components/StoryGeneratorForm';
import { StorybookView } from './components/StorybookView';
import LoadingIndicator from './components/LoadingIndicator';
import { generateStoryContent, generateImage, generateSpeech, generateStoryVideo } from './services/geminiService';
import type { StoryPageData, GenerationStatus, UploadedImage } from './types';

function App() {
  const [storyPages, setStoryPages] = useState<StoryPageData[]>([]);
  const [storyTitle, setStoryTitle] = useState<string>('');
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

  const handleGenerateStory = async (title: string, numPages: number, characterImage: UploadedImage | null) => {
    setGenerationStatus({ isLoading: true, message: 'Criando a estrutura da sua história...' });
    setError(null);
    setStoryPages([]);
    setStoryTitle('');
    setVideoUrl(null);
    setVideoGenerationStatus({ isLoading: false, message: '' });

    try {
      setStoryTitle(title);
      // 1. Generate story text and image prompts
      const storyContent = await generateStoryContent(title, numPages, characterImage);
      
      const pagesWithPrompts: Omit<StoryPageData, 'imageUrl' | 'audioData'>[] = storyContent.map((page, index) => ({
        pageNumber: index + 1,
        text: page.storyText,
        imagePrompt: page.imagePrompt
      }));

      const generatedPages: StoryPageData[] = [];
      for (let i = 0; i < pagesWithPrompts.length; i++) {
        const page = pagesWithPrompts[i];
        
        // 2. Generate image
        setGenerationStatus({ 
          isLoading: true, 
          message: `Gerando imagem para a página ${i + 1} de ${numPages}...` 
        });
        const imageUrl = await generateImage(page.imagePrompt, characterImage);

        // 3. Generate audio
         setGenerationStatus({ 
          isLoading: true, 
          message: `Gerando narração para a página ${i + 1} de ${numPages}...` 
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
    
    setVideoUrl(null);
    setError(null);

    try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
            setError("Por favor, selecione uma chave de API para o Veo e tente novamente. A geração de vídeo pode ter custos associados. Consulte ai.google.dev/gemini-api/docs/billing.");
            return;
        }

        setVideoGenerationStatus({ isLoading: true, message: 'Iniciando a geração do vídeo...' });
        
        const aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const url = await generateStoryVideo(
            aiInstance,
            storyTitle,
            storyPages[0],
            (message: string) => setVideoGenerationStatus({ isLoading: true, message })
        );
        
        setVideoUrl(url);
        setVideoGenerationStatus({ isLoading: false, message: 'Vídeo pronto!' });
    } catch (err: any) {
        console.error("Erro ao gerar vídeo:", err);
        if (err.message && err.message.includes("Requested entity was not found")) {
            setError("Sua chave de API pode não ter acesso ao Veo. Por favor, selecione uma chave diferente e tente novamente. Visite ai.google.dev/gemini-api/docs/billing para mais informações.");
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
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <header className="w-full max-w-4xl text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          Gerador de Livros de Histórias Gemini
        </h1>
        <p className="mt-2 text-gray-400">
          Dê vida às suas histórias. Envie a imagem de um personagem, escolha um título e deixe o Gemini criar um livro de histórias único.
        </p>
      </header>
      
      <main className="w-full max-w-4xl flex-grow">
        <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl mb-8">
          <StoryGeneratorForm onGenerate={handleGenerateStory} isLoading={generationStatus.isLoading} />
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center">
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
              videoUrl={videoUrl}
              videoGenerationStatus={videoGenerationStatus}
              onGenerateVideo={handleGenerateVideo}
            />
          </div>
        )}
      </main>
      <footer className="w-full max-w-4xl text-center mt-8 text-gray-500 text-sm">
        <p>Desenvolvido com Google Gemini</p>
      </footer>
    </div>
  );
}

export default App;