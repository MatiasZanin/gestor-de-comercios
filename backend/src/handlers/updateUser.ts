import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { buildErrorResponse } from '../helpers/errors';
import { updateManagedUser } from '../services/userManagementUseCase';
import { formatJSONResponse } from '../utils/api-response';
import {
  parseUpdateUserBody,
  requireTargetUserId,
  requireUserAdminContext,
} from './userHandlerUtils';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { commerceId, actor } = await requireUserAdminContext(event);
    return formatJSONResponse(
      await updateManagedUser(
        commerceId,
        requireTargetUserId(event),
        actor,
        parseUpdateUserBody(event)
      )
    );
  } catch (error) {
    return buildErrorResponse(error);
  }
};
