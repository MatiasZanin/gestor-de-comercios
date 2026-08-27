import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertRateLimit } from '../helpers/rateLimit';
import { recoverPendingRegistrationAccess } from '../services/registrationUseCase';
import { formatJSONResponse } from '../utils/api-response';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    assertRateLimit(
      `recover-signup-access:${event.requestContext.http.sourceIp || 'unknown'}`,
      10,
      15 * 60_000
    );
    if (!event.body) throw new BadRequestError('Missing body');
    const body = JSON.parse(event.body) as {
      email?: unknown;
      password?: unknown;
    };
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    return formatJSONResponse(
      await recoverPendingRegistrationAccess(email, password)
    );
  } catch (error) {
    return buildErrorResponse(error);
  }
};
