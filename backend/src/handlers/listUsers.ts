import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { buildErrorResponse } from '../helpers/errors';
import { listManagedUsers } from '../services/userManagementUseCase';
import { formatJSONResponse } from '../utils/api-response';
import { requireUserAdminContext } from './userHandlerUtils';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const { commerceId } = await requireUserAdminContext(event);
    return formatJSONResponse(await listManagedUsers(commerceId));
  } catch (error) {
    return buildErrorResponse(error);
  }
};
