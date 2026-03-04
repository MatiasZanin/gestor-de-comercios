import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
    BadRequestError,
    ForbiddenError,
    buildErrorResponse,
} from '../helpers/errors';
import { sanitizeForRole } from '../helpers/sanitizeForRole';
import { formatJSONResponse } from '../utils/api-response';
import { getNextCursor, hasNextPage, removeLastItem } from '../helpers/nextPage';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
    event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
    try {
        const tableName = process.env.TABLE_NAME;
        const gsiName = process.env.SALES_BY_DAY_GSI || 'GSI-Ventas-Por-Dia';
        const CLIENT_LIMIT = 10; // O lo que venga por query param (ej: Number(req.query.limit))
        const DYNAMO_LIMIT = CLIENT_LIMIT + 1; // 11

        if (!tableName) {
            throw new Error('TABLE_NAME env var is required');
        }

        const commerceId = event.pathParameters?.commerceId;
        if (!commerceId) {
            throw new BadRequestError('Missing commerceId');
        }

        // Verify permissions: ADMIN ONLY
        const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
        const roles: string[] | undefined = claims['cognito:groups'];
        if (!roles || !roles.includes('admin')) {
            throw new ForbiddenError('Only admins can view closure history');
        }

        const queryParams = event.queryStringParameters || {};
        const day = queryParams.day;

        let exclusiveStartKey: Record<string, any> | undefined;
        if (queryParams.lastKey) {
            try {
                const decoded = Buffer.from(queryParams.lastKey, 'base64').toString('utf-8');
                exclusiveStartKey = JSON.parse(decoded);
            } catch {
                throw new BadRequestError('Invalid lastKey');
            }
        }

        const start = queryParams.start;
        const end = queryParams.end;

        let command: QueryCommand;

        if (day) {
            // CASO 1: Filtrar por día específico (Usa GSI)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
                throw new BadRequestError('day must be in YYYY-MM-DD format');
            }

            const gsiPk = `COM#${commerceId}#${day}`;

            command = new QueryCommand({
                TableName: tableName,
                IndexName: gsiName,
                KeyConditionExpression: 'GSI1PK = :gsiPk',
                FilterExpression: 'begins_with(SK, :closePrefix)',
                ExpressionAttributeValues: {
                    ':gsiPk': gsiPk,
                    ':closePrefix': 'CLOSE#',
                },
                ExclusiveStartKey: exclusiveStartKey,
                Limit: DYNAMO_LIMIT,
                ScanIndexForward: false,
            });

        } else if (start || end) {
            // CASO 2: Filtrar por rango de fechas (Usa SK range en Tabla Principal)
            const pk = `COM#${commerceId}`;

            // Corrección: Los límites deben incluir el prefijo para que BETWEEN funcione correctamente con strings
            // skStart: Si hay 'start', usamos 'CLOSE#2026-02-01', si no, el mínimo posible 'CLOSE#'
            const skStart = start ? `CLOSE#${start}` : 'CLOSE#';

            // skEnd: Si hay 'end', usamos 'CLOSE#2026-02-19\uffff' para incluir todo ese día.
            // Si no hay 'end', usamos el prefijo con el carácter máximo para cerrar el rango.
            const skEnd = end ? `CLOSE#${end}\uffff` : 'CLOSE#\uffff';

            command = new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: 'PK = :pk AND SK BETWEEN :skStart AND :skEnd',
                ExpressionAttributeValues: {
                    ':pk': pk,
                    ':skStart': skStart,
                    ':skEnd': skEnd,
                },
                ExclusiveStartKey: exclusiveStartKey,
                Limit: DYNAMO_LIMIT,
                ScanIndexForward: false,
            });

        } else {
            // CASO 3: Historial General (Usa Tabla Principal)
            const pk = `COM#${commerceId}`;

            command = new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :closePrefix)',
                ExpressionAttributeValues: {
                    ':pk': pk,
                    ':closePrefix': 'CLOSE#',
                },
                ExclusiveStartKey: exclusiveStartKey,
                Limit: DYNAMO_LIMIT,
                ScanIndexForward: false,
            });
        }

        const result = await docClient.send(command);
        const originalTotalItems = result.Items?.length;
        const items = removeLastItem(result.Items, CLIENT_LIMIT);
        const lastKey = getNextCursor(items, result.LastEvaluatedKey, originalTotalItems, CLIENT_LIMIT);

        const sanitized = items.map((closure) => sanitizeForRole(closure, roles));

        return formatJSONResponse({ items: sanitized, lastKey });
    } catch (err) {
        return buildErrorResponse(err);
    }
};