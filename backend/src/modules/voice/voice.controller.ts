import { Request, Response } from 'express';
import { transcribeAudio } from './sarvam_stt.service';
import { synthesizeSpeech } from './sarvam_tts.service';
import { SUPPORTED_LANGUAGES, getLanguageDefinition, getVoiceCapabilities } from '../i18n/languages';

export async function handleTranscribe(req: Request, res: Response) {
  try {
    const { audioBase64, languageCode, mode } = req.body;

    const result = await transcribeAudio({
      audioBase64,
      languageCode,
      mode
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Speech-to-text failure' });
  }
}

export async function handleSpeak(req: Request, res: Response) {
  try {
    const { text, languageCode, speakerGender } = req.body;

    if (!text || !languageCode) {
      return res.status(400).json({
        error: 'Missing required parameters: text and languageCode are required.'
      });
    }

    const result = await synthesizeSpeech({
      text,
      languageCode,
      speakerGender
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Text-to-speech failure' });
  }
}

export function handleGetCapabilities(req: Request, res: Response) {
  const languageCode = (req.query.languageCode as string) || (req.query.code as string);

  if (languageCode) {
    const def = getLanguageDefinition(languageCode);
    const caps = getVoiceCapabilities(languageCode);
    return res.status(200).json({
      language: def,
      speechInputSupported: caps.stt,
      speechOutputSupported: caps.tts,
      provider: 'SARVAM_AI'
    });
  }

  const matrix = SUPPORTED_LANGUAGES.map(lang => ({
    code: lang.code,
    englishName: lang.englishName,
    nativeName: lang.nativeName,
    stt: lang.speechInputSupported,
    tts: lang.speechOutputSupported
  }));

  return res.status(200).json({
    total: matrix.length,
    matrix
  });
}

