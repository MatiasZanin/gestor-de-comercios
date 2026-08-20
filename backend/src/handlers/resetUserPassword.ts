import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { buildErrorResponse } from '../helpers/errors';
import { resetManagedUserPassword } from '../services/userManagementUseCase';
import { formatJSONResponse } from '../utils/api-response';
import {
  requireTargetUserId,
  requireUserAdminContext,
} from './userHandlerUtils';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { commerceId, actor } = await requireUserAdminContext(event);
    return formatJSONResponse(
      await resetManagedUserPassword(
        commerceId,
        requireTargetUserId(event),
        actor
      )
    );
  } catch (error) {
    return buildErrorResponse(error);
  }
};
