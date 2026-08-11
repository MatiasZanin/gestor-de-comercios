import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  buildErrorResponse,
} from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { sanitizeForRole } from '../helpers/sanitizeForRole';
import { addCategory } from '../helpers/addCategory';
import { logAudit, buildAuditChanges } from '../helpers/auditLogger';
import { formatJSONResponse } from '../utils/api-response';
import { patchProductRecord } from '../services/domain';

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
    const code = event.pathParameters?.code;
    if (!commerceId || !code) {
      throw new BadRequestError('Missing commerceId or code');
    }

    // Validate user has access to this commerce
    await assertCommerceAccess(event, commerceId);

    const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
    const roles: any = claims['cognito:groups'];
    if (!roles.includes('admin')) {
      throw new ForbiddenError('Only admin can update products');
    }
    if (!event.body) {
      throw new BadRequestError('Missing body');
    }
    const body = JSON.parse(event.body);

    // Obtener el item viejo antes de actualizar para auditoría
    const oldResult = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: `COM#${commerceId}`, SK: `PRODUCT#${code}` },
      })
    );
    const oldItem = oldResult.Item as any;
    if (!oldItem) {
      throw new NotFoundError('Product not found');
    }

    // Si se actualiza la categoría, agregarla a METADATA#CONFIG si no existe
    if (body.category) {
      await addCategory(tableName, commerceId, body.category);
    }

    const pk = `COM#${commerceId}`;
    const sk = `PRODUCT#${code}`;
    const updatedAt = new Date().toISOString();
    const nextItem = patchProductRecord(oldItem, body, updatedAt);

    const result = await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: nextItem,
        ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
      })
    );
    const updatedItem = result.Attributes ?? nextItem;

    const userId = claims.sub as string;
    const userEmail = (claims.email as string) || '';
    const auditDetails = buildAuditChanges(
      oldItem as Record<string, unknown>,
      updatedItem as Record<string, unknown>,
      { code, name: updatedItem.name },
      Object.keys(body)
    );
    await logAudit(tableName, commerceId, userId, userEmail, 'PRODUCT_UPDATE', auditDetails);

    const responseItem = sanitizeForRole(updatedItem, roles);
    return formatJSONResponse(responseItem);
  } catch (err) {
    return buildErrorResponse(err);
  }
};
