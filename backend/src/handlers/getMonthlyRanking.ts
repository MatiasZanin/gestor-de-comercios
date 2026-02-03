import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Genera un array de meses entre startMonth y endMonth (inclusive).
 * Formato esperado: "YYYY-MM"
 */
function generateMonthRange(startMonth: string, endMonth: string): string[] {
    const months: string[] = [];
    const [startYear, startM] = startMonth.split('-').map(Number);
    const [endYear, endM] = endMonth.split('-').map(Number);

    let currentYear = startYear;
    let currentMonth = startM;

    while (
        currentYear < endYear ||
        (currentYear === endYear && currentMonth <= endM)
    ) {
        const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        months.push(monthStr);

        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
    }

    return months;
}

interface RankingItem {
    code: string;
    name: string;
    uom?: string;
    priceSale?: number;
    monthlyUnits: number;
}

interface MonthlyRanking {
    month: string;
    items: RankingItem[];
}

/**
 * Obtiene el ranking de productos más vendidos por mes.
 * Utiliza el GSI-Ranking-Mensual para consultas paralelas por cada mes.
 * 
 * Path: /{commerceId}/reports/monthly-ranking
 * Query params: startMonth (YYYY-MM), endMonth (YYYY-MM, opcional)
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

        const startMonth = event.queryStringParameters?.startMonth;
        if (!startMonth) {
            throw new BadRequestError('Missing startMonth query parameter (format: YYYY-MM)');
        }

        // Validar formato YYYY-MM
        const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
        if (!monthRegex.test(startMonth)) {
            throw new BadRequestError('Invalid startMonth format, expected YYYY-MM');
        }

        // Si no viene endMonth, asumir que es igual a startMonth
        const endMonth = event.queryStringParameters?.endMonth || startMonth;
        if (!monthRegex.test(endMonth)) {
            throw new BadRequestError('Invalid endMonth format, expected YYYY-MM');
        }

        // Validar que startMonth <= endMonth
        if (startMonth > endMonth) {
            throw new BadRequestError('startMonth must be less than or equal to endMonth');
        }

        // Generar array de meses a consultar
        const monthsToQuery = generateMonthRange(startMonth, endMonth);

        // Ejecutar consultas en PARALELO usando Promise.all
        const queryPromises = monthsToQuery.map(async (month): Promise<MonthlyRanking> => {
            const statPK = `COM#${commerceId}#${month}`;

            const result = await docClient.send(
                new QueryCommand({
                    TableName: tableName,
                    IndexName: 'GSI-Ranking-Mensual',
                    KeyConditionExpression: 'statPK = :pk',
                    ExpressionAttributeValues: {
                        ':pk': statPK,
                    },
                    ScanIndexForward: false, // Descendente: más vendidos primero
                    Limit: 50,
                })
            );

            const items: RankingItem[] = (result.Items ?? []).map((item) => ({
                code: item.code,
                name: item.name,
                uom: item.uom,
                priceSale: item.priceSale,
                monthlyUnits: item.monthlyUnits,
            }));

            return {
                month,
                items,
            };
        });

        const rankings = await Promise.all(queryPromises);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                commerceId,
                startMonth,
                endMonth,
                rankings,
            }),
        };
    } catch (err) {
        return buildErrorResponse(err);
    }
};
