import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
    BadRequestError,
    ForbiddenError,
    buildErrorResponse,
} from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { logAudit } from '../helpers/auditLogger';
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

        // Solo admin puede finalizar ofertas
        const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
        const roles: string[] | undefined = claims['cognito:groups'];
        if (!roles || !roles.includes('admin')) {
            throw new ForbiddenError('Only admins can finish offers');
        }

        const pk = `COM#${commerceId}`;
        const sk = `OFFER#${offerId}`;
        const now = new Date().toISOString();

        // Soft delete: sobrescribir endDate con now()
        const result = await docClient.send(
            new UpdateCommand({
                TableName: tableName,
                Key: { PK: pk, SK: sk },
                UpdateExpression: 'SET endDate = :now, updatedAt = :now',
                ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
                ExpressionAttributeValues: {
                    ':now': now,
                },
                ReturnValues: 'ALL_NEW',
            })
        );

        const userId = claims.sub as string;
        const userEmail = (claims.email as string) || '';
        await logAudit(tableName, commerceId, userId, userEmail, 'OFFER_FINISH', {
            offerId,
            finishedAt: now,
        });

        return formatJSONResponse(result.Attributes || {});
    } catch (err) {
        return buildErrorResponse(err);
    }
};
