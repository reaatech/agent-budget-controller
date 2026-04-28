# Middleware Skills

## Description

Create Express/Fastify middleware and SDK wrapper for integrating budget enforcement into agent applications.

## Skills

### `middleware:create-express-middleware`

Create Express middleware with pre-request and post-request hooks.

**Parameters:**

- None

**Usage:**

```bash
agent invoke middleware:create-express-middleware
```

**Creates:**

- `createBudgetMiddleware(options)` factory function
- `preRequest` middleware — checks budget, blocks if hard cap exceeded
- `postRequest` middleware — records actual spend
- Options: `controller`, `scopeResolver`, `costEstimator`

---

### `middleware:create-fastify-plugin`

Create Fastify plugin wrapper.

**Parameters:**

- None

**Usage:**

```bash
agent invoke middleware:create-fastify-plugin
```

**Creates:**

- `budgetMiddlewareFastify` plugin
- `onRequest` hook for pre-request check
- `onSend` hook for post-request recording
- Decorators: `request.budgetContext`

---

### `middleware:create-sdk-interceptor`

Create BudgetInterceptor SDK wrapper for non-HTTP agents.

**Parameters:**

- None

**Usage:**

```bash
agent invoke middleware:create-sdk-interceptor
```

**Creates:**

- `BudgetInterceptor` class
- `beforeStep(context)` — check budget, apply enforcement
- `afterStep(context)` — record spend
- Returns modified context (downgraded model, filtered tools, allowed flag)

---

### `middleware:implement-scope-resolver`

Implement scope resolver with multi-scope priority.

**Parameters:**

- None

**Usage:**

```bash
agent invoke middleware:implement-scope-resolver
```

**Creates:**

- `ScopeResolver` interface
- Default resolver with priority: task > user > session > org
- Header-based extraction (X-Task-ID, X-User-ID, X-Session-ID)
- Custom resolver support via options

---

### `middleware:implement-cost-estimator`

Implement cost estimator integration.

**Parameters:**

- None

**Usage:**

```bash
agent invoke middleware:implement-cost-estimator
```

**Creates:**

- `CostEstimator` interface
- Default estimator using token count × model price
- `estimateCost(modelId, prompt, tools)` method
- Supports both exact token count and character-based estimation (4 chars/token)

---

### `middleware:add-response-headers`

Add response header injection for budget telemetry.

**Parameters:**

- None

**Usage:**

```bash
agent invoke middleware:add-response-headers
```

**Creates:**

- Header injection in post-request middleware:
  - `X-Budget-Remaining` — remaining USD
  - `X-Budget-Limit` — total limit
  - `X-Budget-Scope` — scope identifier
  - `X-Budget-Status` — active/warned/degraded/stopped
  - `X-Budget-Model-Override` — original model if downgraded
  - `X-Budget-Tools-Disabled` — comma-separated disabled tools

---

### `middleware:implement-model-interceptor`

Implement model downgrade interception in middleware.

**Parameters:**

- None

**Usage:**

```bash
agent invoke middleware:implement-model-interceptor
```

**Creates:**

- Model ID swap in pre-request hook
- Stores original model in context for logging
- Sets `X-Budget-Model-Override` header
- Emits `model-downgrade` event

---

### `middleware:implement-tool-filter-middleware`

Implement tool filtering in middleware.

**Parameters:**

- None

**Usage:**

```bash
agent invoke middleware:implement-tool-filter-middleware
```

**Creates:**

- Tool list filtering in pre-request hook
- Removes tools from `req.body.tools` (Express) or `request.tools` (Fastify)
- Stores original tools in context
- Sets `X-Budget-Tools-Disabled` header
- Emits `tools-disabled` event

---

### `middleware:add-error-handling`

Add error handling and BudgetExceededError integration.

**Parameters:**

- None

**Usage:**

```bash
agent invoke middleware:add-error-handling
```

**Creates:**

- Re-exports `BudgetExceededError` from `@agent-budget-controller/types`
- Express/Fastify error handler integration
- Returns 429 (Too Many Requests) with JSON body for budget errors
- Adds `BudgetValidationError` handling for malformed requests

## Dependencies

- `budget-engine:create-controller`
- `budget-engine:implement-check`
- `budget-engine:create-downgrade-engine`
- `budget-engine:create-tool-filter`
- `project-setup:add-package` (must create `packages/middleware/` first)

## Tests

- Test pre-request budget check (allow, warn, deny)
- Test model downgrade in middleware
- Test tool filtering
- Test response header injection
- Test error handling (429 response)
- Test SDK interceptor beforeStep/afterStep
- Test scope resolution with multiple headers
- Test cost estimation accuracy
