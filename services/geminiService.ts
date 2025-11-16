import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { StoryContentResponse, UploadedImage } from '../types';
import type { Part } from '@google/genai';

if (!process.env.API_KEY) {
    throw new Error("A variável de ambiente API_KEY não foi definida");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateTitle(characterImage: UploadedImage | null): Promise<string> {
  const parts: Part[] = [];
  let prompt: string;

  if (characterImage) {
    parts.push({
      inlineData: {
        mimeType: characterImage.mimeType,
        data: characterImage.base64,
      },
    });
    prompt = `Sugira um título curto, criativo e cativante em português brasileiro para um livro de histórias infantil. A história é sobre o personagem na imagem. O título deve ter no máximo 10 palavras, estar em uma única linha e não conter aspas.`;
  } else {
    prompt = `Sugira um título curto, criativo e cativante em português brasileiro para um livro de histórias infantil. O título deve ter no máximo 10 palavras, estar em uma única linha e não conter aspas.`;
  }
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        temperature: 0.9,
      },
    });
    return response.text.trim().replace(/"/g, '');
  } catch (error) {
    console.error("Erro ao gerar título:", error);
    throw new Error("Falha ao sugerir um título.");
  }
}

const storyGenerationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      storyText: {
        type: Type.STRING,
        description: 'O conteúdo de texto para esta página da história. Deve ser envolvente para o leitor e em português brasileiro.',
      },
      imagePrompt: {
        type: Type.STRING,
        description: 'Um prompt detalhado e descritivo para um gerador de imagens de IA criar uma ilustração visualmente deslumbrante e relevante para o texto desta página. Descreva a cena, personagens, cores e o clima. Se um personagem foi fornecido na imagem inicial, garanta que o prompt instrua o gerador a manter a consistência visual com esse personagem.',
      },
    },
    required: ["storyText", "imagePrompt"]
  },
};

export async function generateStoryContent(
  title: string,
  numPages: number,
  characterImage: UploadedImage | null
): Promise<StoryContentResponse[]> {
  
  const parts: Part[] = [];
  let finalPrompt: string;

  if (characterImage) {
    parts.push({
      inlineData: {
        mimeType: characterImage.mimeType,
        data: characterImage.base64,
      },
    });
    finalPrompt = `
      Gere um enredo para um livro de histórias infantil em português brasileiro com base no título "${title}", estrelando o personagem da imagem fornecida.
      O livro de histórias deve ter exatamente ${numPages} páginas.
      Para cada página, forneça o texto da história e um prompt de imagem detalhado. O prompt de imagem deve instruir o gerador de imagens a recriar o personagem da imagem original de forma consistente na cena descrita.
      Garanta que a história flua logicamente e seja apropriada para o título.
      A saída final deve ser um array JSON com ${numPages} objetos, seguindo o schema fornecido.`;
  } else {
    finalPrompt = `
      Gere um enredo para um livro de histórias infantil em português brasileiro com base no título "${title}".
      O livro de histórias deve ter exatamente ${numPages} páginas.
      Para cada página, forneça o texto da história e um prompt detalhado para gerar uma imagem correspondente.
      Garanta que a história flua logicamente de uma página para a outra e seja apropriada para o título.
      A saída final deve ser um array JSON com ${numPages} objetos, seguindo o schema fornecido.`;
  }
  parts.push({ text: finalPrompt });


  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: storyGenerationSchema,
        temperature: 0.8,
      },
    });

    const jsonText = response.text.trim();
    const parsedResponse = JSON.parse(jsonText);

    if (!Array.isArray(parsedResponse) || parsedResponse.length === 0) {
      throw new Error("Formato de resposta inválido da API.");
    }

    return parsedResponse as StoryContentResponse[];

  } catch (error) {
    console.error("Erro ao gerar conteúdo da história:", error);
    throw new Error("Falha ao gerar conteúdo da história a partir da API Gemini.");
  }
}

export async function generateImage(prompt: string, characterImage: UploadedImage | null): Promise<string> {
    const parts: Part[] = [];

    if (characterImage) {
        parts.push({
            inlineData: {
                mimeType: characterImage.mimeType,
                data: characterImage.base64,
            },
        });
        parts.push({
            text: `Usando o personagem da primeira imagem como referência principal, crie uma nova imagem baseada na seguinte descrição: "${prompt}"`,
        });
    } else {
        parts.push({ text: prompt });
    }
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

        if (imagePart?.inlineData) {
            const base64ImageBytes = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType;
            return `data:${mimeType};base64,${base64ImageBytes}`;
        } else {
            throw new Error("Nenhuma imagem foi gerada.");
        }
    } catch (error) {
        console.error("Erro ao gerar imagem:", error);
        throw new Error("Falha ao gerar imagem a partir da API Gemini.");
    }
}

export async function generateSpeech(text: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Nenhum dado de áudio foi gerado.");
    }
    return base64Audio;
  } catch (error) {
    console.error("Erro ao gerar fala:", error);
    throw new Error("Falha ao gerar fala a partir da API Gemini.");
  }
}