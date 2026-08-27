import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertRateLimit } from '../helpers/rateLimit';
import { changePendingRegistrationEmail } from '../services/registrationUseCase';
import { formatJSONResponse } from '../utils/api-response';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    // Coarse IP protection; the registration service also enforces the durable
    // per-registration cooldown. Allow the two-call password fallback.
    assertRateLimit(
      `change-signup-email:${event.requestContext.http.sourceIp || 'unknown'}`,
      10,
      15 * 60_000
    );
    const registrationId = event.pathParameters?.registrationId;
    if (!registrationId || !event.body)
      throw new BadRequestError('Missing registration or body');
    const body = JSON.parse(event.body) as {
      email?: unknown;
      password?: unknown;
    };
    const newEmail = typeof body.email === 'string' ? body.email.trim() : '';
    const password =
      typeof body.password === 'string' ? body.password : undefined;
    if (!newEmail) throw new BadRequestError('Ingresá el email nuevo');
    return formatJSONResponse(
      await changePendingRegistrationEmail({
        registrationId,
        newEmail,
        password,
      })
    );
  } catch (error) {
    return buildErrorResponse(error);
  }
};
