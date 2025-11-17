
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { StoryPageData, PrebuiltVoice, GenerationStatus, UploadedImage } from '../types';
import { generateSpeech, generateImage, generateCoverAudio } from '../services/geminiService';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import PrinterIcon from './icons/PrinterIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import VideoIcon from './icons/VideoIcon';
import DownloadIcon from './icons/DownloadIcon';
import RefreshIcon from './icons/RefreshIcon';
import SpeakerIcon from './icons/SpeakerIcon';

interface StorybookViewProps {
  title: string;
  pages: StoryPageData[];
  onUpdatePage: (updatedPage: StoryPageData) => void;
  characterImage: UploadedImage | null;
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


export const StorybookView: React.FC<StorybookViewProps> = ({ title, pages, onUpdatePage, characterImage, videoUrl, videoGenerationStatus, onGenerateVideo }) => {
  const [currentViewIndex, setCurrentViewIndex] = useState(0); // 0: Capa, 1: Imagem P1, 2: Texto P1, 3: Imagem P2, ...
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null);
  const [copyStatus, setCopyStatus] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<PrebuiltVoice>('Kore');
  const [isRegeneratingAudio, setIsRegeneratingAudio] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState<number | null>(null);

  // Áudio da capa
  const [coverAudioData, setCoverAudioData] = useState<string | null>(null);
  const [isGeneratingCoverAudio, setIsGeneratingCoverAudio] = useState(false);
  const [isCoverAudioPlaying, setIsCoverAudioPlaying] = useState(false);
  
  // Refs de áudio da página
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  
  // Refs de áudio da capa
  const coverAudioContextRef = useRef<AudioContext | null>(null);
  const coverAudioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const coverAudioBufferRef = useRef<AudioBuffer | null>(null);

  // Efeito para limpar o AudioContext ao desmontar o componente para evitar vazamentos de recursos
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      if (coverAudioContextRef.current && coverAudioContextRef.current.state !== 'closed') {
        coverAudioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  const totalPages = pages.length;
  const totalViews = 1 + totalPages * 2;

  const isCover = currentViewIndex === 0;
  const isImageView = !isCover && currentViewIndex % 2 !== 0;
  const isTextView = !isCover && currentViewIndex % 2 === 0;
  const pageIndex = isCover ? -1 : Math.floor((currentViewIndex - 1) / 2);
  const page = pages[pageIndex] ?? null;

  // Efeito para redefinir o áudio da capa quando uma nova história é carregada
  useEffect(() => {
    setCoverAudioData(null);
    setIsCoverAudioPlaying(false);
    if (coverAudioSourceNodeRef.current) {
      coverAudioSourceNodeRef.current.stop();
      coverAudioSourceNodeRef.current = null;
    }
    coverAudioBufferRef.current = null;
  }, [pages]);

  useEffect(() => {
    // Para qualquer mudança de visualização, pare o áudio
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    audioBufferRef.current = null;
    
    // Para o áudio da capa se não estivermos na capa
    if (!isCover && coverAudioSourceNodeRef.current) {
        coverAudioSourceNodeRef.current.stop();
    }

    // Se for uma visualização de texto, prepare o novo áudio
    if (isTextView && page?.audioData) {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      decodeAudioData(decode(page.audioData), ctx, 24000, 1)
        .then(buffer => {
          audioBufferRef.current = buffer;
        })
        .catch(err => console.error("Falha ao decodificar áudio", err));
    }

  }, [currentViewIndex, page, isCover]);

  const goToPrevious = useCallback(() => {
    setDirection('prev');
    setCurrentViewIndex((prev) => (prev > 0 ? prev - 1 : totalViews - 1));
  }, [totalViews]);

  const goToNext = useCallback(() => {
    setDirection('next');
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
  
  const handleGenerateCoverAudio = async () => {
    setIsGeneratingCoverAudio(true);
    try {
        const audioData = await generateCoverAudio(title);
        setCoverAudioData(audioData);
        if (!coverAudioContextRef.current || coverAudioContextRef.current.state === 'closed') {
            coverAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const buffer = await decodeAudioData(decode(audioData), coverAudioContextRef.current, 24000, 1);
        coverAudioBufferRef.current = buffer;
    } catch (error) {
        console.error("Falha ao gerar áudio da capa", error);
        alert("Ocorreu um erro ao gerar a narração da capa.");
    } finally {
        setIsGeneratingCoverAudio(false);
    }
  };

  const handlePlayPauseCoverAudio = () => {
      if (!coverAudioContextRef.current || !coverAudioBufferRef.current) return;

      if (isCoverAudioPlaying) {
          if (coverAudioSourceNodeRef.current) {
              coverAudioSourceNodeRef.current.stop();
          }
      } else {
          const source = coverAudioContextRef.current.createBufferSource();
          source.buffer = coverAudioBufferRef.current;
          source.connect(coverAudioContextRef.current.destination);
          source.start();

          source.onended = () => {
              setIsCoverAudioPlaying(false);
              if (coverAudioSourceNodeRef.current === source) {
                  coverAudioSourceNodeRef.current.disconnect();
                  coverAudioSourceNodeRef.current = null;
              }
          };
          coverAudioSourceNodeRef.current = source;
          setIsCoverAudioPlaying(true);
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
        alert("Ocorreu um erro ao alterar a voz da narração. Por favor, tente novamente.");
      } finally {
        setIsRegeneratingAudio(false);
      }
    }
  };
  
  const handleRegenerateNarration = async () => {
    if (isTextView && page) {
      setIsRegeneratingAudio(true);
      try {
        const newAudioData = await generateSpeech(page.text, selectedVoice);
        onUpdatePage({ ...page, audioData: newAudioData });
      } catch (error) {
        console.error("Falha ao regenerar narração", error);
        alert("Ocorreu um erro ao regenerar a narração. Por favor, tente novamente.");
      } finally {
        setIsRegeneratingAudio(false);
      }
    }
  };

  const handleRegenerateImage = async () => {
    if (!page) return;

    setIsRegeneratingImage(page.pageNumber);
    try {
      const newImageUrl = await generateImage(page.imagePrompt, characterImage);
      onUpdatePage({ ...page, imageUrl: newImageUrl });
    } catch (error) {
      console.error("Falha ao regenerar imagem", error);
      alert("Ocorreu um erro ao regenerar a imagem. Por favor, tente novamente.");
    } finally {
      setIsRegeneratingImage(null);
    }
  };

  if (pages.length === 0) return null;

  const renderContent = () => {
    if (isCover) {
      if (videoUrl) {
        return (
          <div className="w-full h-full relative flex flex-col items-center justify-center text-center rounded-lg overflow-hidden bg-black">
            <video key={videoUrl} controls autoPlay className="w-full h-full object-contain">
              <source src={videoUrl} type="video/mp4" />
              Seu navegador não suporta a tag de vídeo.
            </video>
          </div>
        );
      }
      return (
        <div className="w-full h-full relative flex flex-col items-center justify-end text-center rounded-lg overflow-hidden group">
          <img src={pages[0].imageUrl} alt="Imagem da capa" className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 ease-in-out group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"></div>
          <div className="relative p-8 sm:p-12 z-10 flex flex-col items-center">
            <h1 className="text-4xl sm:text-6xl text-white font-lora font-bold" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.9)' }}>
              {title}
            </h1>
             <div className="flex items-center space-x-4 mt-8">
                <button
                    onClick={goToNext}
                    className="bg-white/20 backdrop-blur-sm text-white font-semibold py-3 px-8 rounded-full border border-white/30 hover:bg-white/30 transition duration-300 transform hover:scale-105"
                >
                    Abrir o Livro Mágico
                </button>
                
                {!coverAudioData && (
                  <button
                    onClick={handleGenerateCoverAudio}
                    disabled={isGeneratingCoverAudio}
                    className="w-12 h-12 flex items-center justify-center bg-white/20 backdrop-blur-sm text-white rounded-full border border-white/30 hover:bg-white/30 transition duration-300 transform hover:scale-105 disabled:opacity-50"
                    title="Ouvir a Introdução Mágica"
                  >
                    {isGeneratingCoverAudio ? <div className="w-5 h-5 border-2 border-t-white border-gray-400 rounded-full animate-spin"></div> : <SpeakerIcon />}
                  </button>
                )}

                {coverAudioData && (
                  <button
                    onClick={handlePlayPauseCoverAudio}
                    className="w-12 h-12 flex items-center justify-center bg-white/20 backdrop-blur-sm text-white rounded-full border border-white/30 hover:bg-white/30 transition duration-300 transform hover:scale-105"
                  >
                    {isCoverAudioPlaying ? <PauseIcon /> : <PlayIcon />}
                  </button>
                )}
            </div>
          </div>
        </div>
      );
    }
    if (isImageView && page) {
      return (
        <div className="relative w-full h-full group">
          <img src={page.imageUrl} alt={page.imagePrompt} className="w-full h-full object-cover" />
           <button
            onClick={handleRegenerateImage}
            disabled={isRegeneratingImage === page.pageNumber}
            className="absolute bottom-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-purple-600 transition-opacity opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Regenerar Imagem"
          >
            {isRegeneratingImage === page.pageNumber ? (
              <div className="w-5 h-5 border-2 border-t-white border-gray-400 rounded-full animate-spin"></div>
            ) : (
              <RefreshIcon />
            )}
          </button>
        </div>
      );
    }
    if (isTextView && page) {
      return (
        <div 
          className="w-full h-full flex flex-col items-center justify-center text-center p-4 sm:p-8 bg-gradient-to-br from-[#1a1a2e] to-[#161625]"
        >
           <button onClick={handlePlayPause} disabled={!audioBufferRef.current || isRegeneratingAudio} className="mb-6 flex-shrink-0 w-14 h-14 flex items-center justify-center bg-gray-700/50 rounded-full hover:bg-purple-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600">
              {isRegeneratingAudio ? <div className="w-6 h-6 border-2 border-t-purple-400 border-gray-500 rounded-full animate-spin"></div> : (isPlaying ? <PauseIcon /> : <PlayIcon />)}
          </button>
          <p className="text-gray-200 leading-relaxed text-xl sm:text-2xl max-w-3xl font-lora">
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
        <>
          <button
            onClick={() => {
              setDirection(currentViewIndex > 0 ? 'prev' : null);
              setCurrentViewIndex(0);
            }}
            className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
          >
            <VideoIcon />
            <span>Assistir ao Desenho</span>
          </button>
          <a
            href={videoUrl}
            download={`${title.replace(/\s/g, '_') || 'storybook_video'}.mp4`}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
          >
            <DownloadIcon />
            <span>Baixar o Desenho</span>
          </a>
        </>
      );
    }
    return (
       <button onClick={onGenerateVideo} className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">
          <VideoIcon />
          <span>Transformar em Desenho Animado</span>
      </button>
    );
  }

  const animationClass = direction === 'next' ? 'page-turn-next' : direction === 'prev' ? 'page-turn-prev' : '';

  return (
    <div className="glass-card p-4 sm:p-6 rounded-2xl relative flex flex-col">
      <div id="printable-area" className="hidden print:block">
        <div className="w-full h-screen p-8 flex flex-col justify-center items-center page-break text-center bg-white text-black">
            <h1 className="text-6xl font-bold font-lora mb-8">{title}</h1>
            <img src={pages[0].imageUrl} alt="Imagem da capa" className="w-full max-w-3xl aspect-video object-cover rounded-lg shadow-2xl" />
            <p className="mt-auto text-lg">Uma história gerada por Fábula Mágica AI</p>
        </div>
        {pages.map((p, index) => (
          <div key={index} className="w-full h-screen p-8 flex flex-col page-break bg-white text-black">
            <img src={p.imageUrl} alt={p.imagePrompt} className="w-full aspect-[4/3] object-cover rounded-lg mb-6 shadow-lg" />
            <div className="flex-grow">
                <p className="text-2xl leading-relaxed">{p.text}</p>
            </div>
            <p className="text-right text-lg font-bold mt-4">{p.pageNumber} / {totalPages}</p>
          </div>
        ))}
      </div>

      <div className="w-full aspect-video flex-grow rounded-lg overflow-hidden">
        <div key={currentViewIndex} className={`w-full h-full ${animationClass}`}>
          {renderContent()}
        </div>
      </div>
      
      <div className="flex flex-wrap items-center justify-between mt-6 pt-4 border-t border-white/10 no-print gap-4">
         <div className="flex items-center space-x-2 flex-wrap gap-2">
            <button onClick={handlePrint} className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">
                <PrinterIcon />
                <span>Imprimir a Fábula</span>
            </button>
            <button onClick={handleCopyAllText} className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">
                <ClipboardIcon />
                <span>{copyStatus ? 'Copiado!' : 'Copiar a História'}</span>
            </button>
             {renderVideoButton()}
            {isTextView && (
              <div className="flex items-center space-x-2">
                <select 
                  value={selectedVoice} 
                  onChange={handleVoiceChange}
                  disabled={isRegeneratingAudio}
                  className="bg-gray-700 border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full p-2.5"
                  aria-label="Voz do Narrador Mágico"
                >
                  {availableVoices.map(voice => (
                    <option key={voice} value={voice}>{voiceNames[voice]}</option>
                  ))}
                </select>
                <button
                  onClick={handleRegenerateNarration}
                  disabled={isRegeneratingAudio}
                  className="p-2.5 bg-gray-700 rounded-lg hover:bg-purple-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Regenerar Narração"
                >
                  {isRegeneratingAudio ? (
                    <div className="w-5 h-5 border-2 border-t-white border-gray-400 rounded-full animate-spin"></div>
                  ) : (
                    <RefreshIcon />
                  )}
                </button>
              </div>
            )}
        </div>

        <div className="flex items-center space-x-4">
          <button onClick={goToPrevious} className="p-2 bg-gray-700 rounded-full hover:bg-purple-500 transition duration-200" aria-label="Página anterior">
            <ChevronLeftIcon />
          </button>
          <span className="font-mono text-lg text-gray-400 w-24 text-center">
            {isCover ? 'Capa Mágica' : `${Math.ceil(currentViewIndex / 2)} / ${totalPages}`}
          </span>
          <button onClick={goToNext} className="p-2 bg-gray-700 rounded-full hover:bg-purple-500 transition duration-200" aria-label="Próxima página">
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
};