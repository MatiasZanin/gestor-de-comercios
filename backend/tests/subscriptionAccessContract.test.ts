import {
  BadRequestError,
  buildErrorResponse,
  PaymentRequiredError,
} from '../src/helpers/errors';

describe('subscription-required API contract', () => {
  it('returns a stable code and message with HTTP 402', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = buildErrorResponse(new PaymentRequiredError());
      expect(response.statusCode).toBe(402);
      expect(JSON.parse(response.body)).toEqual({
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'La suscripción no habilita esta operación',
        },
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  it('keeps the historical response shape for other HTTP errors', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = buildErrorResponse(new BadRequestError('Solicitud inválida'));
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ error: 'Solicitud inválida' });
    } finally {
      consoleError.mockRestore();
    }
  });
});
