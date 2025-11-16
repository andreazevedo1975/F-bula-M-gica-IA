import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { StoryPageData } from '../types';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import PrinterIcon from './icons/PrinterIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';

interface StorybookViewProps {
  title: string;
  pages: StoryPageData[];
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


export const StorybookView: React.FC<StorybookViewProps> = ({ title, pages }) => {
  const [currentPage, setCurrentPage] = useState(0); // 0 = Capa, 1 = Página 1, etc.
  const [copyStatus, setCopyStatus] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const isCover = currentPage === 0;
  const page = isCover ? null : pages[currentPage - 1];
  const totalPages = pages.length;
  const imageToShow = isCover ? pages[0].imageUrl : page!.imageUrl;
  const imagePromptToShow = isCover ? "Imagem da capa" : page!.imagePrompt;

  useEffect(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    audioBufferRef.current = null;

    const pageForAudio = pages[currentPage - 1];
    if (pageForAudio?.audioData) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      decodeAudioData(decode(pageForAudio.audioData), ctx, 24000, 1)
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
  }, [currentPage, pages]);

  const goToPrevious = () => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : totalPages));
  };

  const goToNext = useCallback(() => {
    setCurrentPage((prev) => (prev < totalPages ? prev + 1 : 0));
  }, [totalPages]);

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
    if (!audioContextRef.current || !audioBufferRef.current || isCover) return;

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

  if (pages.length === 0) return null;

  return (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-2xl relative">
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

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/2 flex-shrink-0 relative">
          <img src={imageToShow} alt={imagePromptToShow} className="w-full aspect-[4/3] object-cover rounded-lg shadow-lg" />
           {isCover && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-8 rounded-lg">
                <h1 className="text-4xl sm:text-5xl text-white font-bold text-center" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}>
                    {title}
                </h1>
            </div>
           )}
        </div>
        <div className="lg:w-1/2 flex items-start">
            {!isCover && (
                <>
                <button onClick={handlePlayPause} disabled={!audioBufferRef.current} className="mr-4 mt-1 flex-shrink-0 p-2 bg-gray-700 rounded-full hover:bg-purple-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed self-start">
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <p className="text-gray-300 leading-relaxed flex-grow text-lg">
                    {page?.text}
                </p>
                </>
            )}
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700 no-print">
         <div className="flex items-center space-x-2">
            <button onClick={handlePrint} className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">
                <PrinterIcon />
                <span>Imprimir</span>
            </button>
            <button onClick={handleCopyAllText} className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">
                <ClipboardIcon />
                <span>{copyStatus ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>
        </div>

        <div className="flex items-center space-x-4">
          <button onClick={goToPrevious} className="p-2 bg-gray-700 rounded-full hover:bg-purple-500 transition duration-200" aria-label="Página anterior">
            <ChevronLeftIcon />
          </button>
          <span className="font-mono text-lg text-gray-400 w-16 text-center">{isCover ? 'Capa' : `${currentPage} / ${totalPages}`}</span>
          <button onClick={goToNext} className="p-2 bg-gray-700 rounded-full hover:bg-purple-500 transition duration-200" aria-label="Próxima página">
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
};