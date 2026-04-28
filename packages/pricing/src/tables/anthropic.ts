export const anthropicPricing = {
  provider: 'anthropic',
  models: {
    'claude-opus-4-1': { inputPricePerMillion: 15.0, outputPricePerMillion: 75.0 },
    'claude-sonnet-4': { inputPricePerMillion: 3.0, outputPricePerMillion: 15.0 },
    'claude-haiku-3-5': { inputPricePerMillion: 0.25, outputPricePerMillion: 1.25 },
  },
};
