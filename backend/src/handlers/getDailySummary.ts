import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { sanitizeForRole } from '../helpers/sanitizeForRole';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Valida que una fecha tenga el formato YYYY-MM-DD y sea una fecha válida.
 */
function isValidDate(dateStr: string): boolean {
    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    if (!dateRegex.test(dateStr)) {
        return false;
    }
    // Validar que sea una fecha real (no 2024-02-30, por ejemplo)
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}

/**
 * Obtiene los registros de resumen diario (SUMMARY#YYYY-MM-DD) para un rango de fechas.
 * Se utiliza para alimentar gráficos de tendencias y mapas de calor en el frontend.
 * 
 * Path: /{commerceId}/reports/daily-summary
 * Query params: start (YYYY-MM-DD), end (YYYY-MM-DD, opcional)
 */
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

        // Validate user has access to this commerce
        assertCommerceAccess(event, commerceId);

        // Obtener claims del JWT para verificación de roles
        const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
        const roles: string[] = claims['cognito:groups'] ?? [];

        const start = event.queryStringParameters?.start;
        if (!start) {
            throw new BadRequestError('Missing start query parameter (format: YYYY-MM-DD)');
        }

        // Validar formato y fecha válida para start
        if (!isValidDate(start)) {
            throw new BadRequestError('Invalid start date format or value, expected YYYY-MM-DD');
        }

        // Si no viene end, asumir que es igual a start (consulta de un solo día)
        const end = event.queryStringParameters?.end || start;

        // Validar formato y fecha válida para end
        if (!isValidDate(end)) {
            throw new BadRequestError('Invalid end date format or value, expected YYYY-MM-DD');
        }

        // Validar que start <= end
        if (start > end) {
            throw new BadRequestError('start must be less than or equal to end');
        }

        // Construir las claves para la consulta BETWEEN
        const pk = `COM#${commerceId}`;
        const skStart = `SUMMARY#${start}`;
        const skEnd = `SUMMARY#${end}`;

        // Consultar directamente la tabla principal usando BETWEEN en SK
        let exclusiveStartKey;
        const items: Record<string, any>[] = [];

        do {
            const result: any = await docClient.send(
                new QueryCommand({
                    TableName: tableName,
                    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :skStart AND :skEnd',
                    ExpressionAttributeValues: {
                        ':pk': pk,
                        ':skStart': skStart,
                        ':skEnd': skEnd,
                    },
                    ScanIndexForward: true, // Ascendente: ordenado por fecha de menor a mayor
                    ExclusiveStartKey: exclusiveStartKey,
                })
            );

            if (result.Items) {
                items.push(...result.Items);
            }

            exclusiveStartKey = result.LastEvaluatedKey;
        } while (exclusiveStartKey);

        // Sanitizar según el rol del usuario
        const sanitizedItems = items.map(item => sanitizeForRole(item, roles));

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start,
                end,
                items: sanitizedItems,
            }),
        };
    } catch (err) {
        return buildErrorResponse(err);
    }
};
