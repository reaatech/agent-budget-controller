export const awsBedrockPricing = {
  provider: 'aws-bedrock',
  models: {
    'claude-3-sonnet': { inputPricePerMillion: 3.0, outputPricePerMillion: 15.0 },
    'claude-3-haiku': { inputPricePerMillion: 0.25, outputPricePerMillion: 1.25 },
    'llama-3': { inputPricePerMillion: 0.5, outputPricePerMillion: 0.7 },
    'mistral-large': { inputPricePerMillion: 4.0, outputPricePerMillion: 12.0 },
  },
};
