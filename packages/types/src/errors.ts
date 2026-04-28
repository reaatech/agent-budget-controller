import type { ScopeIdentifier } from './budget-scope.js';

export enum BudgetErrorCode {
  Exceeded = 'BUDGET_EXCEEDED',
  Validation = 'BUDGET_VALIDATION',
  NotFound = 'BUDGET_NOT_FOUND',
  Internal = 'BUDGET_INTERNAL',
}

export class BudgetError extends Error {
  readonly code: BudgetErrorCode;
  readonly scope?: ScopeIdentifier;

  constructor(message: string, code: BudgetErrorCode, scope?: ScopeIdentifier) {
    super(message);
    this.name = 'BudgetError';
    this.code = code;
    this.scope = scope;
    Object.setPrototypeOf(this, BudgetError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      scope: this.scope,
    };
  }
}

export class BudgetExceededError extends BudgetError {
  readonly spent: number;
  readonly limit: number;
  readonly remaining: number;
  readonly action: string;

  constructor(
    message: string,
    scope: ScopeIdentifier,
    spent: number,
    limit: number,
    remaining: number,
    action: string,
  ) {
    super(message, BudgetErrorCode.Exceeded, scope);
    this.name = 'BudgetExceededError';
    this.spent = spent;
    this.limit = limit;
    this.remaining = remaining;
    this.action = action;
    Object.setPrototypeOf(this, BudgetExceededError.prototype);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      spent: this.spent,
      limit: this.limit,
      remaining: this.remaining,
      action: this.action,
    };
  }
}

export class BudgetValidationError extends BudgetError {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, BudgetErrorCode.Validation);
    this.name = 'BudgetValidationError';
    this.field = field;
    Object.setPrototypeOf(this, BudgetValidationError.prototype);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      field: this.field,
    };
  }
}
