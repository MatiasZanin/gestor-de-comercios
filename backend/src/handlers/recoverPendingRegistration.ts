import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertRateLimit } from '../helpers/rateLimit';
import { recoverPendingRegistration } from '../services/registrationUseCase';
import { formatJSONResponse } from '../utils/api-response';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    assertRateLimit(
      `recover-signup:${event.requestContext.http.sourceIp || 'unknown'}`,
      3,
      60_000
    );
    if (!event.body) throw new BadRequestError('Missing body');
    const body = JSON.parse(event.body) as { email?: unknown };
    const email = typeof body.email === 'string' ? body.email : '';
    // The use case intentionally returns the same shape whether or not a record exists.
    return formatJSONResponse(await recoverPendingRegistration(email));
  } catch (error) {
    return buildErrorResponse(error);
  }
};
