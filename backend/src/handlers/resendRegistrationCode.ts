import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertRateLimit } from '../helpers/rateLimit';
import { resendRegistrationCode } from '../services/registrationUseCase';
import { formatJSONResponse } from '../utils/api-response';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const registrationId = event.pathParameters?.registrationId;
    if (!registrationId) throw new BadRequestError('Missing registrationId');
    assertRateLimit(
      `resend-signup:${event.requestContext.http.sourceIp}`,
      3,
      60_000
    );
    return formatJSONResponse(await resendRegistrationCode(registrationId));
  } catch (error) {
    return buildErrorResponse(error);
  }
};
