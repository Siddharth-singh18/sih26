import { Request, Response } from 'express';
import { translateText } from './sarvam.service';
import { SUPPORTED_LANGUAGES, getLanguageDefinition, getVoiceCapabilities } from './languages';

export async function handleTranslate(req: Request, res: Response) {
  try {
    const { text, sourceLanguage, targetLanguage, contextType } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({
        error: 'Missing required parameters: text and targetLanguage are mandatory.'
      });
    }

    const result = await translateText({
      text,
      sourceLanguage,
      targetLanguage,
      contextType
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal translation failure' });
  }
}

export function handleGetLanguages(req: Request, res: Response) {
  return res.status(200).json({
    total: SUPPORTED_LANGUAGES.length,
    languages: SUPPORTED_LANGUAGES
  });
}

export function handleGetLanguageCapabilities(req: Request, res: Response) {
  const code = (req.query.code as string) || 'en-IN';
  const def = getLanguageDefinition(code);
  const voiceCaps = getVoiceCapabilities(code);

  return res.status(200).json({
    language: def,
    capabilities: {
      text: def.textSupported,
      stt: voiceCaps.stt,
      tts: voiceCaps.tts
    }
  });
}

