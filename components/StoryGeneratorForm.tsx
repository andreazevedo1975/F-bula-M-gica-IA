import React, { useState, useRef } from 'react';
import type { UploadedImage } from '../types';
import UploadIcon from './icons/UploadIcon';
import XIcon from './icons/XIcon';
import SparklesIcon from './icons/SparklesIcon';
import { generateTitle } from '../services/geminiService';

interface StoryGeneratorFormProps {
  onGenerate: (title: string, numPages: number, characterImage: UploadedImage | null) => void;
  isLoading: boolean;
}

const fileToUrlAndBase64 = (file: File): Promise<{ url: string; base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve({ url: dataUrl, base64, mimeType: file.type });
    };
    reader.onerror = (error) => reject(error);
  });
};


export const StoryGeneratorForm: React.FC<StoryGeneratorFormProps> = ({ onGenerate, isLoading }) => {
  const [title, setTitle] = useState('As aventuras de Quindim, a quokka feliz');
  const [numPages, setNumPages] = useState(5);
  const [characterImage, setCharacterImage] = useState<{ url: string; base64: string; mimeType: string } | null>(null);
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSuggestTitle = async () => {
    setIsSuggestingTitle(true);
    try {
      const imageToPass = characterImage ? { base64: characterImage.base64, mimeType: characterImage.mimeType } : null;
      const suggestedTitle = await generateTitle(imageToPass);
      setTitle(suggestedTitle);
    } catch (error) {
      console.error("Falha ao sugerir título", error);
    } finally {
      setIsSuggestingTitle(false);
    }
  };
  
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageData = await fileToUrlAndBase64(file);
      setCharacterImage(imageData);
      
      setIsSuggestingTitle(true);
      try {
        const suggestedTitle = await generateTitle({ base64: imageData.base64, mimeType: imageData.mimeType });
        setTitle(suggestedTitle);
      } catch (error) {
        console.error("Falha ao auto-sugerir título", error);
        setTitle('Uma aventura com Quindim');
      } finally {
        setIsSuggestingTitle(false);
      }
    }
  };

  const removeImage = () => {
    setCharacterImage(null);
    setTitle('As aventuras de Quindim, a quokka feliz');
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && numPages > 0) {
      const imageToPass = characterImage ? { base64: characterImage.base64, mimeType: characterImage.mimeType } : null;
      onGenerate(title, numPages, imageToPass);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="relative">
        <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
          Título da História
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: A Jornada da Montanha Cintilante"
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 pr-12 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200"
          required
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={handleSuggestTitle}
          disabled={isLoading || isSuggestingTitle}
          className="absolute right-3 top-[38px] text-gray-400 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Sugerir Título"
          title="Sugerir Título"
        >
          {isSuggestingTitle ? (
             <div className="w-5 h-5 border-2 border-t-purple-400 border-gray-600 rounded-full animate-spin"></div>
          ) : <SparklesIcon />}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <label htmlFor="character-upload" className="block text-sm font-medium text-gray-300 mb-2">
            Personagem (Opcional)
          </label>
           <div 
                className="relative mt-1 flex justify-center items-center h-40 w-full px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md cursor-pointer hover:border-purple-500 transition-colors"
                onClick={() => !characterImage && fileInputRef.current?.click()}
            >
                <input
                    id="character-upload"
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleImageChange}
                    disabled={isLoading}
                />
                {characterImage ? (
                    <div className="relative group h-full">
                        <img src={characterImage.url} alt="Pré-visualização do personagem" className="h-full w-auto object-contain rounded-md" />
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeImage();
                            }}
                            className="absolute top-0 right-0 -mt-2 -mr-8 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            aria-label="Remover imagem"
                            disabled={isLoading}
                        >
                            <XIcon />
                        </button>
                    </div>
                ) : (
                    <div className="space-y-1 text-center">
                        <UploadIcon />
                        <p className="text-sm text-gray-400">
                            <span className="font-semibold text-purple-400">Clique para enviar</span>
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG, WEBP</p>
                    </div>
                )}
            </div>
        </div>
        <div>
          <label htmlFor="numPages" className="block text-sm font-medium text-gray-300 mb-2">
            Número de Páginas
          </label>
          <input
            id="numPages"
            type="number"
            value={numPages}
            onChange={(e) => setNumPages(Math.max(1, parseInt(e.target.value, 10)) || 1)}
            min="1"
            max="10"
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200 mt-1"
            required
            disabled={isLoading}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={isLoading || !title.trim()}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg"
      >
        {isLoading ? 'Gerando...' : 'Criar Meu Livro de Histórias'}
      </button>
    </form>
  );
};