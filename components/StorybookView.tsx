import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { StoryPageData, PrebuiltVoice, GenerationStatus } from '../types';
import { generateSpeech } from '../services/geminiService';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import PrinterIcon from './icons/PrinterIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import VideoIcon from './icons/VideoIcon';
import DownloadIcon from './icons/DownloadIcon';

interface StorybookViewProps {
  title: string;
  pages: StoryPageData[];
  onUpdatePage: (updatedPage: StoryPageData) => void;
  videoUrl: string | null;
  videoGenerationStatus: GenerationStatus;
  onGenerateVideo: () => void;
}

const availableVoices: PrebuiltVoice[] = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
const voiceNames: Record<PrebuiltVoice, string> = {
  Kore: 'Coreia',
  Puck: 'Puck',
  Charon: 'Caronte',
  Fenrir: 'Fenrir',
  Zephyr: 'Zéfiro',
}

// Helpers para decodificar áudio
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


export const StorybookView: React.FC<StorybookViewProps> = ({ title, pages, onUpdatePage, videoUrl, videoGenerationStatus, onGenerateVideo }) => {
  const [currentViewIndex, setCurrentViewIndex] = useState(0); // 0: Capa, 1: Imagem P1, 2: Texto P1, 3: Imagem P2, ...
  const [copyStatus, setCopyStatus] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<PrebuiltVoice>('Kore');
  const [isRegeneratingAudio, setIsRegeneratingAudio] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const totalPages = pages.length;
  const totalViews = 1 + totalPages * 2;

  const isCover = currentViewIndex === 0;
  const isImageView = !isCover && currentViewIndex % 2 !== 0;
  const isTextView = !isCover && currentViewIndex % 2 === 0;
  const pageIndex = isCover ? -1 : Math.floor((currentViewIndex - 1) / 2);
  const page = pages[pageIndex] ?? null;

  useEffect(() => {
    // Para qualquer mudança de visualização, pare o áudio
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    audioBufferRef.current = null;

    // Se for uma visualização de texto, prepare o novo áudio
    if (isTextView && page?.audioData) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      decodeAudioData(decode(page.audioData), ctx, 24000, 1)
        .then(buffer => {
          audioBufferRef.current = buffer;
        })
        .catch(err => console.error("Falha ao decodificar áudio", err));
    }

    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
    };
  }, [currentViewIndex, pages, isTextView, page]);

  const goToPrevious = () => {
    setCurrentViewIndex((prev) => (prev > 0 ? prev - 1 : totalViews - 1));
  };

  const goToNext = useCallback(() => {
    setCurrentViewIndex((prev) => (prev < totalViews - 1 ? prev + 1 : 0));
  }, [totalViews]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyAllText = () => {
    const header = `Título: ${title}\n\n---\n\n`;
    const allText = pages.map(p => `Página ${p.pageNumber}\n\n${p.text}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(header + allText).then(() => {
        setCopyStatus(true);
        setTimeout(() => setCopyStatus(false), 2000);
    });
  };

  const handlePlayPause = () => {
    if (!audioContextRef.current || !audioBufferRef.current || !isTextView) return;

    if (isPlaying) {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
    } else {
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(audioContextRef.current.destination);
      source.start();

      source.onended = () => {
        setIsPlaying(false);
        if (sourceNodeRef.current === source) {
           sourceNodeRef.current.disconnect();
           sourceNodeRef.current = null;
        }
      };

      sourceNodeRef.current = source;
      setIsPlaying(true);
    }
  };

  const handleVoiceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVoice = e.target.value as PrebuiltVoice;
    setSelectedVoice(newVoice);

    if (isTextView && page) {
      setIsRegeneratingAudio(true);
      try {
        const newAudioData = await generateSpeech(page.text, newVoice);
        onUpdatePage({ ...page, audioData: newAudioData });
      } catch (error) {
        console.error("Falha ao regenerar áudio com nova voz", error);
      } finally {
        setIsRegeneratingAudio(false);
      }
    }
  };

  if (pages.length === 0) return null;

  const renderContent = () => {
    if (isCover) {
      return (
        <div className="w-full h-full relative flex items-center justify-center">
          <img src={pages[0].imageUrl} alt="Imagem da capa" className="absolute inset-0 w-full h-full object-cover rounded-lg" />
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-8 rounded-lg">
            <h1 className="text-4xl sm:text-5xl text-white font-bold text-center" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}>
              {title}
            </h1>
          </div>
        </div>
      );
    }
    if (isImageView && page) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <img src={page.imageUrl} alt={page.imagePrompt} className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
        </div>
      );
    }
    if (isTextView && page) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 sm:p-8">
           <button onClick={handlePlayPause} disabled={!audioBufferRef.current || isRegeneratingAudio} className="mb-6 flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-700 rounded-full hover:bg-purple-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {isRegeneratingAudio ? <div className="w-6 h-6 border-2 border-t-purple-400 border-gray-500 rounded-full animate-spin"></div> : (isPlaying ? <PauseIcon /> : <PlayIcon />)}
          </button>
          <p className="text-gray-300 leading-relaxed text-xl sm:text-2xl max-w-2xl">
            {page.text}
          </p>
        </div>
      );
    }
    return null;
  }
  
  const renderVideoButton = () => {
    if (videoGenerationStatus.isLoading) {
      return (
        <div className="flex items-center space-x-2 bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg">
           <div className="w-5 h-5 border-2 border-t-purple-400 border-gray-600 rounded-full animate-spin"></div>
           <span className="text-sm">{videoGenerationStatus.message}</span>
        </div>
      );
    }
    if (videoUrl) {
      return (
         <a href={videoUrl} download={`${title.replace(/\s/g, '_')}.mp4`} className="flex items-center space-x-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">
            <DownloadIcon />
            <span>Baixar Vídeo</span>
        </a>
      );
    }
    return (
       <button onClick={onGenerateVideo} className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">
          <VideoIcon />
          <span>Salvar como Vídeo</span>
      </button>
    );
  }


  return (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-2xl relative flex flex-col">
      <div id="printable-area" className="hidden print:block">
        <div className="w-full h-screen p-8 flex flex-col justify-center items-center page-break text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-8">{title}</h1>
            <img src={pages[0].imageUrl} alt="Imagem da capa" className="w-full max-w-2xl aspect-video object-cover rounded-lg shadow-lg" />
        </div>
        {pages.map((p, index) => (
          <div key={index} className="w-full h-screen p-8 flex flex-col page-break">
            <img src={p.imageUrl} alt={p.imagePrompt} className="w-full aspect-[4/3] object-cover rounded-lg mb-4" />
            <div className="text-gray-900 flex-grow">
                <p className="text-lg">{p.text}</p>
            </div>
            <p className="text-right text-lg font-bold text-gray-900">{p.pageNumber} / {totalPages}</p>
          </div>
        ))}
      </div>

      <div className="w-full aspect-[4/3] flex-grow">
        {renderContent()}
      </div>
      
      <div className="flex flex-wrap items-center justify-between mt-6 pt-4 border-t border-gray-700 no-print gap-4">
         <div className="flex items-center space-x-2 flex-wrap gap-2">
            <button onClick={handlePrint} className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">
                <PrinterIcon />
                <span>Imprimir</span>
            </button>
            <button onClick={handleCopyAllText} className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">
                <ClipboardIcon />
                <span>{copyStatus ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>
             {renderVideoButton()}
            {isTextView && (
              <div>
                <select 
                  value={selectedVoice} 
                  onChange={handleVoiceChange}
                  disabled={isRegeneratingAudio}
                  className="bg-gray-700 border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full p-2.5"
                  aria-label="Selecionar voz do narrador"
                >
                  {availableVoices.map(voice => (
                    <option key={voice} value={voice}>{voiceNames[voice]}</option>
                  ))}
                </select>
              </div>
            )}
        </div>

        <div className="flex items-center space-x-4">
          <button onClick={goToPrevious} className="p-2 bg-gray-700 rounded-full hover:bg-purple-500 transition duration-200" aria-label="Página anterior">
            <ChevronLeftIcon />
          </button>
          <span className="font-mono text-lg text-gray-400 w-24 text-center">
            {isCover ? 'Capa' : `${pageIndex + 1} / ${totalPages}`}
          </span>
          <button onClick={goToNext} className="p-2 bg-gray-700 rounded-full hover:bg-purple-500 transition duration-200" aria-label="Próxima página">
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
};