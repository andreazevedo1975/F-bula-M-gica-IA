import React, { useState, useRef } from 'react';
import type { UploadedImage } from '../types';
import UploadIcon from './icons/UploadIcon';
import XIcon from './icons/XIcon';
import SparklesIcon from './icons/SparklesIcon';
import FileUploadIcon from './icons/FileUploadIcon';
import { suggestPlot } from '../services/geminiService';

interface StoryGeneratorFormProps {
  onGenerate: (plot: string, numPages: number, characterImage: UploadedImage | null) => void;
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
  const [plot, setPlot] = useState('Quindim, uma quokka curiosa, encontra um mapa cintilante que leva a uma cachoeira escondida. No caminho, ele ajuda um passarinho com a asa machucada e compartilha suas nozes com um esquilo faminto. Ao chegar à cachoeira, ele descobre que a verdadeira magia não estava no destino, mas na bondade que ele espalhou pelo caminho.');
  const [numPages, setNumPages] = useState(5);
  const [characterImage, setCharacterImage] = useState<{ url: string; base64: string; mimeType: string } | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  
  const characterFileInputRef = useRef<HTMLInputElement>(null);
  const scriptFileInputRef = useRef<HTMLInputElement>(null);

  const handleSuggestPlot = async () => {
    setIsSuggesting(true);
    try {
      const imageToPass = characterImage ? { base64: characterImage.base64, mimeType: characterImage.mimeType } : null;
      const suggestedPlot = await suggestPlot(imageToPass);
      setPlot(suggestedPlot);
    } catch (error) {
      console.error("Falha ao sugerir enredo", error);
      alert("Não foi possível sugerir um enredo. Por favor, verifique sua conexão ou tente novamente.");
    } finally {
      setIsSuggesting(false);
    }
  };
  
  const handleCharacterImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageData = await fileToUrlAndBase64(file);
      setCharacterImage(imageData);
      
      setIsSuggesting(true);
      try {
        const suggestedPlot = await suggestPlot({ base64: imageData.base64, mimeType: imageData.mimeType });
        setPlot(suggestedPlot);
      } catch (error) {
        console.error("Falha ao auto-sugerir enredo", error);
        alert("Não foi possível sugerir um enredo para a imagem. Por favor, insira um manualmente.");
        setPlot('Uma aventura com o personagem da imagem.');
      } finally {
        setIsSuggesting(false);
      }
    }
  };

  const removeCharacterImage = () => {
    setCharacterImage(null);
    if (characterFileInputRef.current) {
        characterFileInputRef.current.value = "";
    }
  };

  const handleScriptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (event) => {
            setPlot(event.target?.result as string);
        };
        reader.readAsText(file);
    } else if (file.name.endsWith('.docx')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const arrayBuffer = event.target?.result;
            if (arrayBuffer) {
                window.mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                    .then((result: { value: string; }) => {
                        setPlot(result.value);
                    })
                    .catch((err: any) => {
                        console.error("Erro ao ler docx:", err);
                        alert("Não foi possível ler o arquivo .docx.");
                    });
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        alert("Formato de arquivo não suportado. Por favor, envie .txt ou .docx.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (plot.trim() && numPages > 0) {
      const imageToPass = characterImage ? { base64: characterImage.base64, mimeType: characterImage.mimeType } : null;
      onGenerate(plot, numPages, imageToPass);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="relative">
        <label htmlFor="plot" className="block text-sm font-medium text-gray-300 mb-2">
          Enredo da História
        </label>
        <textarea
          id="plot"
          value={plot}
          onChange={(e) => setPlot(e.target.value)}
          placeholder="Comece a escrever sua aventura aqui... ou peça uma sugestão à IA!"
          className="w-full h-32 bg-gray-700 border border-gray-600 text-white rounded-lg p-3 pr-12 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200 resize-none"
          required
          disabled={isLoading}
        />
        <div className="absolute right-3 top-[38px] flex flex-col space-y-2">
            <button
              type="button"
              onClick={handleSuggestPlot}
              disabled={isLoading || isSuggesting}
              className="text-gray-400 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Sugerir Enredo"
              title="Sugerir Enredo"
            >
              {isSuggesting ? (
                 <div className="w-5 h-5 border-2 border-t-purple-400 border-gray-600 rounded-full animate-spin"></div>
              ) : <SparklesIcon />}
            </button>
             <button
              type="button"
              onClick={() => scriptFileInputRef.current?.click()}
              disabled={isLoading}
              className="text-gray-400 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Carregar Roteiro"
              title="Carregar Roteiro (.txt, .docx)"
            >
              <FileUploadIcon />
            </button>
            <input
                type="file"
                ref={scriptFileInputRef}
                className="sr-only"
                accept=".txt,.docx"
                onChange={handleScriptFileChange}
            />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <label htmlFor="character-upload" className="block text-sm font-medium text-gray-300 mb-2">
            Personagem (Opcional)
          </label>
           <div 
                className="relative mt-1 flex justify-center items-center h-40 w-full px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md cursor-pointer hover:border-purple-500 transition-colors"
                onClick={() => !characterImage && characterFileInputRef.current?.click()}
            >
                <input
                    id="character-upload"
                    ref={characterFileInputRef}
                    type="file"
                    className="sr-only"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleCharacterImageChange}
                    disabled={isLoading}
                />
                {characterImage ? (
                    <div className="relative group h-full">
                        <img src={characterImage.url} alt="Pré-visualização do personagem" className="h-full w-auto object-contain rounded-md" />
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeCharacterImage();
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
            max="50"
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200 mt-1"
            required
            disabled={isLoading}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={isLoading || !plot.trim()}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg"
      >
        {isLoading ? 'Gerando...' : 'Criar Meu Livro de Histórias'}
      </button>
    </form>
  );
};