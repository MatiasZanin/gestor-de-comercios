import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResultV2,
} from 'aws-lambda';
import { randomUUID } from 'crypto';
import {
    BadRequestError,
    ForbiddenError,
    buildErrorResponse,
} from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { logAudit } from '../helpers/auditLogger';
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
        if (!commerceId) {
            throw new BadRequestError('Missing commerceId');
        }

        assertCommerceAccess(event, commerceId);

        // Solo admin puede crear ofertas
        const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
        const roles: string[] | undefined = claims['cognito:groups'];
        if (!roles || !roles.includes('admin')) {
            throw new ForbiddenError('Only admins can create offers');
        }

        if (!event.body) {
            throw new BadRequestError('Missing body');
        }

        const body = JSON.parse(event.body);

        // Validaciones
        if (!body.name || typeof body.name !== 'string') {
            throw new BadRequestError('name is required');
        }
        if (!body.discountType || !['PERCENTAGE', 'FIXED'].includes(body.discountType)) {
            throw new BadRequestError('discountType must be PERCENTAGE or FIXED');
        }
        if (typeof body.discountValue !== 'number' || body.discountValue <= 0) {
            throw new BadRequestError('discountValue must be a positive number');
        }
        if (body.discountType === 'PERCENTAGE' && body.discountValue > 100) {
            throw new BadRequestError('discountValue for PERCENTAGE cannot exceed 100');
        }
        if (!body.startDate || !body.endDate) {
            throw new BadRequestError('startDate and endDate are required (ISO 8601)');
        }

        const startDate = new Date(body.startDate);
        const endDate = new Date(body.endDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new BadRequestError('startDate and endDate must be valid ISO 8601 dates');
        }
        if (startDate >= endDate) {
            throw new BadRequestError('startDate must be before endDate');
        }

        if (!body.scope || !body.scope.type || !Array.isArray(body.scope.values) || body.scope.values.length === 0) {
            throw new BadRequestError('scope must include type (PRODUCT|CATEGORY|BRAND) and a non-empty values array');
        }
        if (!['PRODUCT', 'CATEGORY', 'BRAND'].includes(body.scope.type)) {
            throw new BadRequestError('scope.type must be PRODUCT, CATEGORY or BRAND');
        }

        const now = new Date().toISOString();
        const offerId = randomUUID();
        const pk = `COM#${commerceId}`;
        const sk = `OFFER#${offerId}`;

        const offer: Offer = {
            PK: pk,
            SK: sk,
            offerId,
            commerceId,
            name: body.name.trim(),
            discountType: body.discountType,
            discountValue: body.discountValue,
            startDate: body.startDate,
            endDate: body.endDate,
            scope: {
                type: body.scope.type,
                values: body.scope.values,
            },
            createdAt: now,
            updatedAt: now,
            createdBy: claims.sub || 'unknown',
        };

        await docClient.send(
            new PutCommand({
                TableName: tableName,
                Item: offer,
            })
        );

        const userId = claims.sub as string;
        const userEmail = (claims.email as string) || '';
        await logAudit(tableName, commerceId, userId, userEmail, 'OFFER_CREATE', {
            offerId,
            name: offer.name,
            discountType: offer.discountType,
            discountValue: offer.discountValue,
        });

        return formatJSONResponse(offer, 201);
    } catch (err) {
        return buildErrorResponse(err);
    }
};
