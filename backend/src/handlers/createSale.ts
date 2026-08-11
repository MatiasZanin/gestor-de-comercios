import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, ForbiddenError, buildErrorResponse } from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { sanitizeForRole } from '../helpers/sanitizeForRole';
import { Sale } from '../models/sale';
import { formatJSONResponse } from '../utils/api-response';
import { createSaleUseCase } from '../services/saleUseCase';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const tableName = process.env.TABLE_NAME;
    const retentionDays = parseInt(process.env.RETENTION_DAYS || '90', 10);

    if (!tableName) {
      throw new Error('TABLE_NAME env var is required');
    }

    const commerceId = event.pathParameters?.commerceId;
    if (!commerceId) {
      throw new BadRequestError('Missing commerceId');
    }

    await assertCommerceAccess(event, commerceId);

    const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
    const roles: string[] | undefined = claims['cognito:groups'];
    if (!roles || (!roles.includes('admin') && !roles.includes('vendedor'))) {
      throw new ForbiddenError('Not authorized to create sales');
    }

    if (!event.body) {
      throw new BadRequestError('Missing body');
    }

    const body = JSON.parse(event.body);
    const sale: Sale = await createSaleUseCase(docClient, tableName, {
      commerceId,
      sellerId: claims.sub || 'unknown',
      userEmail: (claims.email as string) || '',
      items: body.items,
      notes: body.notes,
      paymentMethod: body.paymentMethod,
      createdAt: body.createdAt,
      saleId: body.saleId,
      retentionDays,
      auditAt: body.auditAt,
      auditId: body.auditId,
    });

    return formatJSONResponse(sanitizeForRole(sale, roles), 201);
  } catch (err) {
    return buildErrorResponse(err);
  }
};
