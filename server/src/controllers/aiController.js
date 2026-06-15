import { detectScriptures, generateSermonNotes, resetContext } from '../services/geminiService.js';

export async function detect(req, res) {
  const { transcriptChunk, customApiKey } = req.body;

  if (transcriptChunk === undefined) {
    return res.status(400).json({ error: 'transcriptChunk is required' });
  }

  try {
    const results = await detectScriptures(transcriptChunk, customApiKey);
    
    if (results.error) {
      if (results.error === 'INVALID_KEY') {
        return res.status(401).json({ error: 'Gemini API key is invalid or unauthorized' });
      }
      if (results.error === 'QUOTA_EXCEEDED') {
        return res.status(429).json({ error: 'Gemini API quota exceeded' });
      }
      if (results.error === 'SERVICE_UNAVAILABLE') {
        return res.status(503).json({ error: 'Gemini AI service temporarily unavailable (high demand). Please retry shortly.' });
      }
      return res.status(500).json({ error: `AI processing failed: ${results.error}` });
    }
    
    res.json(results);
  } catch (err) {
    console.error('AI Scripture detection error:', err);
    res.status(500).json({ error: 'Failed to process transcript' });
  }
}

export async function getNotes(req, res) {
  const { fullTranscript, customApiKey } = req.body;

  if (!fullTranscript || typeof fullTranscript !== 'string') {
    return res.status(400).json({ error: 'fullTranscript is required as a string' });
  }

  try {
    const notes = await generateSermonNotes(fullTranscript, customApiKey);
    if (!notes) {
      return res.status(500).json({ error: 'Failed to generate sermon notes' });
    }
    res.json(notes);
  } catch (err) {
    console.error('AI Notes generation error:', err);
    res.status(500).json({ error: 'Failed to generate sermon notes' });
  }
}

export function resetAiContext(req, res) {
  try {
    resetContext();
    res.json({ success: true, message: 'AI context window reset successfully' });
  } catch (err) {
    console.error('AI context reset error:', err);
    res.status(500).json({ error: 'Failed to reset context' });
  }
}
