import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertRateLimit } from '../helpers/rateLimit';
import { confirmRegistrationEmail } from '../services/registrationUseCase';
import { formatJSONResponse } from '../utils/api-response';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const registrationId = event.pathParameters?.registrationId;
    if (!registrationId || !event.body)
      throw new BadRequestError('Missing registration or body');
    const body = JSON.parse(event.body) as { code?: unknown };
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!/^\d{6}$/.test(code))
      throw new BadRequestError('Invalid confirmation code');
    assertRateLimit(
      `confirm-signup:${event.requestContext.http.sourceIp}`,
      10,
      60_000
    );
    return formatJSONResponse(
      await confirmRegistrationEmail(registrationId, code)
    );
  } catch (error) {
    return buildErrorResponse(error);
  }
};
