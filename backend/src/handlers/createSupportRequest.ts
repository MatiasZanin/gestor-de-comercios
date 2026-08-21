import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import {
  BadRequestError,
  UnauthorizedError,
  buildErrorResponse,
} from '../helpers/errors';
import {
  sendSupportRequest,
  validateSupportRequest,
} from '../services/supportRequestUseCase';
import { formatJSONResponse } from '../utils/api-response';

function parseBody(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Record<string, unknown> {
  if (!event.body) throw new BadRequestError('Falta el cuerpo de la solicitud');
  try {
    const body = JSON.parse(event.body) as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new Error('invalid body');
    return body as Record<string, unknown>;
  } catch {
    throw new BadRequestError('El cuerpo debe ser JSON válido');
  }
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const commerceId = event.pathParameters?.commerceId;
    if (!commerceId) throw new BadRequestError('Falta commerceId');
    await assertCommerceAccess(event, commerceId);

    const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
    if (typeof claims.sub !== 'string' || !claims.sub)
      throw new UnauthorizedError('Identidad inválida');
    const groups = claims['cognito:groups'];
    const role = Array.isArray(groups)
      ? String(groups[0] ?? '')
      : typeof groups === 'string'
        ? groups
            .replace(/[\[\]]/g, '')
            .split(',')[0]
            ?.trim()
        : undefined;

    const response = await sendSupportRequest(
      commerceId,
      {
        sub: claims.sub,
        email: typeof claims.email === 'string' ? claims.email : '',
        role,
      },
      validateSupportRequest(parseBody(event))
    );
    return formatJSONResponse(response, 201);
  } catch (error) {
    return buildErrorResponse(error);
  }
};
