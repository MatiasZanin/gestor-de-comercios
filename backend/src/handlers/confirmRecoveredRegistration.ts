import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertRateLimit } from '../helpers/rateLimit';
import { confirmRecoveredRegistration } from '../services/registrationUseCase';
import { formatJSONResponse } from '../utils/api-response';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    assertRateLimit(
      `confirm-recovered:${event.requestContext.http.sourceIp || 'unknown'}`,
      10,
      60_000
    );
    if (!event.body) throw new BadRequestError('Missing body');
    const body = JSON.parse(event.body) as { email?: unknown; code?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!email || !/^\d{6}$/.test(code))
      throw new BadRequestError('Datos de confirmación inválidos');
    return formatJSONResponse(await confirmRecoveredRegistration(email, code));
  } catch (error) {
    return buildErrorResponse(error);
  }
};
