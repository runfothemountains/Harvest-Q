// --- Translator Agent tools ---
const tools = [
  // …keep existing tools…

  {
    type: 'function',
    function: {
      name: 'detectLanguage',
      description: 'Detect the primary language of a text sample.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Input text to detect language from.' }
        },
        required: ['text']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'translateText',
      description: 'Translate text from a specified source language to a target language.',
      parameters: {
        type: 'object',
        properties: {
          text:        { type: 'string' },
          sourceLang:  { type: 'string', description: 'Source language code (e.g., en, fr, es).' },
          targetLang:  { type: 'string', description: 'Target language code (e.g., ha, sw, en).' }
        },
        required: ['text','sourceLang','targetLang']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'autoTranslate',
      description: 'Detect language automatically, then translate to a target language.',
      parameters: {
        type: 'object',
        properties: {
          text:       { type: 'string' },
          targetLang: { type: 'string' }
        },
        required: ['text','targetLang']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'preserveFields',
      description: 'Protect specific words or tokens (like prices or units) from being translated.',
      parameters: {
        type: 'object',
        properties: {
          text:   { type: 'string' },
          fields: { type: 'array', items: { type: 'string' }, description: 'Words or tokens to keep as-is.' }
        },
        required
