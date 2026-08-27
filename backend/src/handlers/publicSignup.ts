import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertRateLimit } from '../helpers/rateLimit';
import { formatJSONResponse } from '../utils/api-response';
import { createPublicRegistration } from '../services/registrationUseCase';
import type { PublicRegistrationRequest } from '../models/billing';

function parseBody(event: APIGatewayProxyEventV2): PublicRegistrationRequest {
  if (!event.body) {
    throw new BadRequestError('Missing body');
  }

  const body = JSON.parse(event.body) as Partial<PublicRegistrationRequest>;
  const firstName =
    typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName =
    typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const phoneNumber =
    typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
  const merchantName =
    typeof body.merchantName === 'string' ? body.merchantName.trim() : '';
  const acceptTerms = !!body.acceptTerms;

  if (
    !firstName ||
    !lastName ||
    !email ||
    !password ||
    !phoneNumber ||
    !merchantName
  ) {
    throw new BadRequestError('Missing required fields');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestError('Invalid email');
  }

  if (password.length < 8) {
    throw new BadRequestError('Password must be at least 8 characters');
  }

  if (!acceptTerms) {
    throw new BadRequestError('Debe aceptar los términos y condiciones');
  }

  return {
    firstName,
    lastName,
    email,
    password,
    phoneNumber,
    merchantName,
    acceptTerms,
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const sourceIp = event.requestContext.http.sourceIp || 'unknown';
    assertRateLimit(`public-signup:${sourceIp}`, 10, 60_000);
    const input = parseBody(event);
    const registration = await createPublicRegistration(input);
    return formatJSONResponse(registration, 201);
  } catch (err) {
    return buildErrorResponse(err);
  }
};
