import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, ForbiddenError, buildErrorResponse } from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { sanitizeForRole } from '../helpers/sanitizeForRole';
import { CreateCashCloseRequest } from '../models/cashClose';
import { formatJSONResponse } from '../utils/api-response';
import { closeRegisterUseCase } from '../services/closeUseCase';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('TABLE_NAME env var is required');
    }

    const commerceId = event.pathParameters?.commerceId;
    if (!commerceId) {
      throw new BadRequestError('Missing commerceId');
    }

    assertCommerceAccess(event, commerceId);

    const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
    const roles: string[] | undefined = claims['cognito:groups'];
    if (!roles || (!roles.includes('admin') && !roles.includes('vendedor'))) {
      throw new ForbiddenError('Not authorized to close register');
    }

    if (!event.body) {
      throw new BadRequestError('Missing body');
    }

    const body: CreateCashCloseRequest = JSON.parse(event.body);
    const cashClose = await closeRegisterUseCase(docClient, tableName, {
      commerceId,
      userId: claims.sub || 'unknown',
      userEmail: (claims.email as string) || '',
      declaredCash: body.declaredCash,
      expenses: body.expenses,
      initialFund: body.initialFund,
      notes: body.notes,
      closedAt: body.closedAt,
      auditAt: body.auditAt,
      closureId: body.closureId,
      auditId: body.auditId,
    });

    return formatJSONResponse(sanitizeForRole(cashClose, roles), 201);
  } catch (err) {
    return buildErrorResponse(err);
  }
};
