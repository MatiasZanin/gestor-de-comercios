/**
 * Conjunto de errores personalizados para centralizar el manejo de fallos.
 * Cada error incluye un statusCode que será utilizado por los handlers para
 * construir la respuesta HTTP adecuada.
 */

export class HttpError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
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
  console.log("🚀 ~ ", err)
  if (err instanceof HttpError) {
    return {
      statusCode: err.statusCode,
      body: JSON.stringify({ error: err.message }),
    };
  }
  return {
    statusCode: 500,
    body: JSON.stringify({ error: 'Unexpected error' }),
  };
}