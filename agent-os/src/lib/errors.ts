export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class GovernorStopError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "GOVERNOR_STOP", 422, details);
    this.name = "GovernorStopError";
  }
}

export class StateTransitionError extends AppError {
  constructor(from: string, to: string, resource: string) {
    super(
      `Invalid state transition: ${from} -> ${to} for ${resource}`,
      "INVALID_STATE_TRANSITION",
      409,
    );
    this.name = "StateTransitionError";
  }
}

export function safeJsonParse(str: string | null | undefined): unknown {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
