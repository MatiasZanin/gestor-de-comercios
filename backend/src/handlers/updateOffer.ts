import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
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
import { logAudit, buildAuditChanges } from '../helpers/auditLogger';
import { Offer } from '../models/offer';
import { formatJSONResponse } from '../utils/api-response';

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
        const offerId = event.pathParameters?.offerId;
        if (!commerceId) {
            throw new BadRequestError('Missing commerceId');
        }
        if (!offerId) {
            throw new BadRequestError('Missing offerId');
        }

        assertCommerceAccess(event, commerceId);

        // Solo admin puede editar ofertas
        const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
        const roles: string[] | undefined = claims['cognito:groups'];
        if (!roles || !roles.includes('admin')) {
            throw new ForbiddenError('Only admins can update offers');
        }

        if (!event.body) {
            throw new BadRequestError('Missing body');
        }

        const pk = `COM#${commerceId}`;
        const sk = `OFFER#${offerId}`;

        // Verificar que la oferta exista
        const existing = await docClient.send(
            new GetCommand({
                TableName: tableName,
                Key: { PK: pk, SK: sk },
            })
        );

        if (!existing.Item) {
            throw new NotFoundError(`Offer ${offerId} not found`);
        }

        const body = JSON.parse(event.body);
        const now = new Date().toISOString();

        // Construir UpdateExpression dinámico
        const expressionParts: string[] = [];
        const expressionNames: Record<string, string> = {};
        const expressionValues: Record<string, any> = {};

        if (body.name !== undefined) {
            expressionParts.push('#name = :name');
            expressionNames['#name'] = 'name';
            expressionValues[':name'] = body.name.trim();
        }

        if (body.discountType !== undefined) {
            if (!['PERCENTAGE', 'FIXED'].includes(body.discountType)) {
                throw new BadRequestError('discountType must be PERCENTAGE or FIXED');
            }
            expressionParts.push('discountType = :discountType');
            expressionValues[':discountType'] = body.discountType;
        }

        if (body.discountValue !== undefined) {
            if (typeof body.discountValue !== 'number' || body.discountValue <= 0) {
                throw new BadRequestError('discountValue must be a positive number');
            }
            const dType = body.discountType || (existing.Item as Offer).discountType;
            if (dType === 'PERCENTAGE' && body.discountValue > 100) {
                throw new BadRequestError('discountValue for PERCENTAGE cannot exceed 100');
            }
            expressionParts.push('discountValue = :discountValue');
            expressionValues[':discountValue'] = body.discountValue;
        }

        if (body.startDate !== undefined) {
            const sd = new Date(body.startDate);
            if (isNaN(sd.getTime())) {
                throw new BadRequestError('startDate must be a valid ISO 8601 date');
            }
            expressionParts.push('startDate = :startDate');
            expressionValues[':startDate'] = body.startDate;
        }

        if (body.endDate !== undefined) {
            const ed = new Date(body.endDate);
            if (isNaN(ed.getTime())) {
                throw new BadRequestError('endDate must be a valid ISO 8601 date');
            }
            expressionParts.push('endDate = :endDate');
            expressionValues[':endDate'] = body.endDate;
        }

        // Validar que startDate < endDate (considerando valores existentes)
        const finalStartDate = body.startDate || (existing.Item as Offer).startDate;
        const finalEndDate = body.endDate || (existing.Item as Offer).endDate;
        if (new Date(finalStartDate) >= new Date(finalEndDate)) {
            throw new BadRequestError('startDate must be before endDate');
        }

        if (body.scope !== undefined) {
            if (!body.scope.type || !Array.isArray(body.scope.values) || body.scope.values.length === 0) {
                throw new BadRequestError('scope must include type and a non-empty values array');
            }
            if (!['PRODUCT', 'CATEGORY', 'BRAND'].includes(body.scope.type)) {
                throw new BadRequestError('scope.type must be PRODUCT, CATEGORY or BRAND');
            }
            expressionParts.push('#scope = :scope');
            expressionNames['#scope'] = 'scope';
            expressionValues[':scope'] = body.scope;
        }

        if (expressionParts.length === 0) {
            throw new BadRequestError('No fields to update');
        }

        // Siempre actualizar updatedAt
        expressionParts.push('updatedAt = :updatedAt');
        expressionValues[':updatedAt'] = now;

        const result = await docClient.send(
            new UpdateCommand({
                TableName: tableName,
                Key: { PK: pk, SK: sk },
                UpdateExpression: `SET ${expressionParts.join(', ')}`,
                ExpressionAttributeNames: Object.keys(expressionNames).length > 0 ? expressionNames : undefined,
                ExpressionAttributeValues: expressionValues,
                ReturnValues: 'ALL_NEW',
            })
        );

        const userId = claims.sub as string;
        const userEmail = (claims.email as string) || '';
        const trackedFields = ['name', 'discountType', 'discountValue', 'startDate', 'endDate', 'scope'];
        const auditDetails = buildAuditChanges(
            existing.Item as Record<string, unknown>,
            (result.Attributes ?? {}) as Record<string, unknown>,
            { offerId, name: (result.Attributes ?? existing.Item as any).name },
            trackedFields
        );
        await logAudit(tableName, commerceId, userId, userEmail, 'OFFER_UPDATE', auditDetails);

        return formatJSONResponse(result.Attributes || {});
    } catch (err) {
        return buildErrorResponse(err);
    }
};
