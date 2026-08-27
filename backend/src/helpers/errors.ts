/**
 * Conjunto de errores personalizados para centralizar el manejo de fallos.
 * Cada error incluye un statusCode que será utilizado por los handlers para
 * construir la respuesta HTTP adecuada.
 */

import { formatJSONResponse } from '../utils/api-response';

export class HttpError extends Error {
  public statusCode: number;
  public code?: string;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request') {
    super(message, 400);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

export class PaymentRequiredError extends HttpError {
  constructor(message = 'La suscripción no habilita esta operación') {
    super(message, 402, 'SUBSCRIPTION_REQUIRED');
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(message, 404);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal server error') {
    super(message, 500);
  }
}

/**
 * Dado un error, construye una respuesta estándar para API Gateway HTTP.
 */
export function buildErrorResponse(err: unknown) {
  console.error(
    'Request failed',
    err instanceof Error
      ? { name: err.name, message: err.message }
      : 'Unknown error'
  );
  if (err instanceof HttpError) {
    if (err.code) {
      return formatJSONResponse(
        { error: { code: err.code, message: err.message } },
        err.statusCode
      );
    }
    return formatJSONResponse({ error: err.message }, err.statusCode);
  }
  return formatJSONResponse({ error: 'Unexpected error' }, 500);
}
