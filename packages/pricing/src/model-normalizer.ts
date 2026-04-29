export class ModelNormalizer {
  private aliases: Map<string, Map<string, string>> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.registerAlias('anthropic', 'claude-3-opus', 'claude-opus-4-1');
    this.registerAlias('anthropic', 'claude-3-sonnet', 'claude-sonnet-4');
    this.registerAlias('anthropic', 'claude-3-haiku', 'claude-haiku-3-5');
    this.registerAlias('openai', 'gpt-4o', 'gpt-4-turbo');
    this.registerAlias('openai', 'gpt-4o-mini', 'gpt-4-mini');
  }

  registerAlias(provider: string, alias: string, canonical: string): void {
    if (!this.aliases.has(provider)) {
      this.aliases.set(provider, new Map());
    }
    this.aliases.get(provider)?.set(alias.toLowerCase(), canonical);
  }

  normalize(modelId: string, provider?: string): string {
    const lower = modelId.toLowerCase();
    if (provider && this.aliases.has(provider)) {
      const canonical = this.aliases.get(provider)?.get(lower);
      if (canonical) return canonical;
    }
    // Try all providers if no provider specified
    for (const [, providerAliases] of this.aliases) {
      const canonical = providerAliases.get(lower);
      if (canonical) return canonical;
    }
    return modelId;
  }
}
