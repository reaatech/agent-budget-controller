export const openaiPricing = {
  provider: 'openai',
  models: {
    'gpt-4': { inputPricePerMillion: 30.0, outputPricePerMillion: 60.0 },
    'gpt-4-mini': { inputPricePerMillion: 0.15, outputPricePerMillion: 0.6 },
    'gpt-4-turbo': { inputPricePerMillion: 10.0, outputPricePerMillion: 30.0 },
    o1: { inputPricePerMillion: 15.0, outputPricePerMillion: 60.0 },
    o3: { inputPricePerMillion: 15.0, outputPricePerMillion: 60.0 },
  },
};
