import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
    BadRequestError,
    buildErrorResponse,
} from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { Offer } from '../models/offer';
import { formatJSONResponse } from '../utils/api-response';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const PAGE_SIZE = 20;

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

        const params = event.queryStringParameters || {};
        const statusFilter = params.status; // 'active' | 'scheduled' | 'expired'
        const startDateFilter = params.startDate;
        const endDateFilter = params.endDate;
        const lastKeyParam = params.lastKey;

        const pk = `COM#${commerceId}`;

        let exclusiveStartKey: Record<string, any> | undefined;
        if (lastKeyParam) {
            try {
                exclusiveStartKey = JSON.parse(Buffer.from(lastKeyParam, 'base64').toString('utf-8'));
            } catch {
                throw new BadRequestError('Invalid lastKey format');
            }
        }

        // Traer todas las ofertas para este comercio
        const result = await docClient.send(
            new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
                ExpressionAttributeValues: {
                    ':pk': pk,
                    ':prefix': 'OFFER#',
                },
                ScanIndexForward: false,
                Limit: PAGE_SIZE * 3, // Traemos más para filtrar en memoria
                ExclusiveStartKey: exclusiveStartKey,
            })
        );

        let items = (result.Items ?? []) as Offer[];
        const now = new Date().toISOString();

        // Filtrar por estado
        if (statusFilter) {
            items = items.filter((offer) => {
                switch (statusFilter) {
                    case 'active':
                        return now >= offer.startDate && now <= offer.endDate;
                    case 'scheduled':
                        return now < offer.startDate;
                    case 'expired':
                        return now > offer.endDate;
                    default:
                        return true;
                }
            });
        }

        // Filtrar por rango de fechas
        if (startDateFilter) {
            items = items.filter((offer) => offer.endDate >= startDateFilter);
        }
        if (endDateFilter) {
            items = items.filter((offer) => offer.startDate <= endDateFilter);
        }

        // Paginar los resultados filtrados
        const paginatedItems = items.slice(0, PAGE_SIZE);
        let lastKey: string | undefined;

        if (result.LastEvaluatedKey) {
            lastKey = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
        }

        return formatJSONResponse({
            items: paginatedItems,
            lastKey,
        });
    } catch (err) {
        return buildErrorResponse(err);
    }
};
