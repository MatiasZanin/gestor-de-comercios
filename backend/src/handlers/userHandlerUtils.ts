import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { assertRole } from '../helpers/assertRole';
import { BadRequestError, UnauthorizedError } from '../helpers/errors';
import type {
  CreateManagedUserRequest,
  UpdateManagedUserRequest,
} from '../models/user';
import {
  validateEmail,
  validateName,
  validateRole,
  type UserActor,
} from '../services/userManagementUseCase';

export async function requireUserAdminContext(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) {
  const commerceId = event.pathParameters?.commerceId;
  if (!commerceId) throw new BadRequestError('Falta commerceId');
  assertRole(event, 'admin');
  await assertCommerceAccess(event, commerceId);
  const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
  if (typeof claims.sub !== 'string' || !claims.sub)
    throw new UnauthorizedError('Identidad inválida');
  const actor: UserActor = {
    sub: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : '',
  };
  return { commerceId, actor };
}

export function requireTargetUserId(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): string {
  const userId = event.pathParameters?.userId;
  if (!userId) throw new BadRequestError('Falta userId');
  return userId;
}

function parseObject(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Record<string, unknown> {
  if (!event.body) throw new BadRequestError('Falta el cuerpo de la solicitud');
  try {
    const parsed = JSON.parse(event.body) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new BadRequestError('El cuerpo debe ser JSON válido');
  }
}

function assertOnlyFields(body: Record<string, unknown>, allowed: string[]) {
  const unexpected = Object.keys(body).filter(key => !allowed.includes(key));
  if (unexpected.length > 0)
    throw new BadRequestError(`Campos no permitidos: ${unexpected.join(', ')}`);
}

export function parseCreateUserBody(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): CreateManagedUserRequest {
  const body = parseObject(event);
  assertOnlyFields(body, ['firstName', 'lastName', 'email', 'role']);
  return {
    firstName: validateName(body.firstName, 'Nombre'),
    lastName: validateName(body.lastName, 'Apellido'),
    email: validateEmail(body.email),
    role: validateRole(body.role),
  };
}

export function parseUpdateUserBody(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): UpdateManagedUserRequest {
  const body = parseObject(event);
  if (Object.prototype.hasOwnProperty.call(body, 'email')) {
    throw new BadRequestError('El email no puede modificarse');
  }
  assertOnlyFields(body, ['firstName', 'lastName', 'role']);
  return {
    firstName: validateName(body.firstName, 'Nombre'),
    lastName: validateName(body.lastName, 'Apellido'),
    role: validateRole(body.role),
  };
}
