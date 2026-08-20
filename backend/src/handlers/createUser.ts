import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { buildErrorResponse } from '../helpers/errors';
import { createManagedUser } from '../services/userManagementUseCase';
import { formatJSONResponse } from '../utils/api-response';
import {
  parseCreateUserBody,
  requireUserAdminContext,
} from './userHandlerUtils';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { commerceId, actor } = await requireUserAdminContext(event);
    return formatJSONResponse(
      await createManagedUser(commerceId, actor, parseCreateUserBody(event)),
      201
    );
  } catch (error) {
    return buildErrorResponse(error);
  }
};
