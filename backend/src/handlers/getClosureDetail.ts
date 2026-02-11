import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
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
import { CashClose } from '../models/cashClose';
import { Sale } from '../models/sale';
import { formatJSONResponse } from '../utils/api-response';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
    event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
    try {
        const tableName = process.env.TABLE_NAME;
        const gsiName = process.env.SALES_BY_DAY_GSI || 'GSI-Ventas-Por-Dia';

        if (!tableName) {
            throw new Error('TABLE_NAME env var is required');
        }

        const commerceId = event.pathParameters?.commerceId;
        const closureId = event.pathParameters?.closureId;

        if (!commerceId) {
            throw new BadRequestError('Missing commerceId');
        }
        if (!closureId) {
            throw new BadRequestError('Missing closureId');
        }

        // Validate user has access to this commerce
        assertCommerceAccess(event, commerceId);

        // Verify permissions: ADMIN ONLY
        const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
        const roles: string[] | undefined = claims['cognito:groups'];
        if (!roles || !roles.includes('admin')) {
            throw new ForbiddenError('Only admins can view closure details');
        }

        const pk = `COM#${commerceId}`;

        // Find the closure by querying with begins_with on SK containing closureId
        const closureResult = await docClient.send(
            new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
                ExpressionAttributeValues: {
                    ':pk': pk,
                    ':prefix': 'CLOSE#',
                },
                ScanIndexForward: false,
            })
        );

        // Find the closure with matching closureId
        const closure = (closureResult.Items ?? []).find(
            (item) => (item as CashClose).closureId === closureId
        ) as CashClose | undefined;

        if (!closure) {
            throw new NotFoundError('Closure not found');
        }

        // Now query all sales between openedAt and closedAt
        const openedAt = closure.openedAt;
        const closedAt = closure.closedAt;

        const openedDate = new Date(openedAt);
        const closedDate = new Date(closedAt);

        const allSales: Sale[] = [];

        // Iterate through each day in the range
        const currentDate = new Date(openedDate);
        currentDate.setHours(0, 0, 0, 0);

        while (currentDate <= closedDate) {
            const queryDay = currentDate.toISOString().slice(0, 10);
            const gsiPk = `COM#${commerceId}#${queryDay}`;

            let lastEvaluatedKey: Record<string, any> | undefined;

            do {
                const salesResult = await docClient.send(
                    new QueryCommand({
                        TableName: tableName,
                        IndexName: gsiName,
                        KeyConditionExpression: 'GSI1PK = :gsiPk',
                        FilterExpression:
                            'begins_with(SK, :salePrefix) AND createdAt BETWEEN :openedAt AND :closedAt',
                        ExpressionAttributeValues: {
                            ':gsiPk': gsiPk,
                            ':salePrefix': 'SALE#',
                            ':openedAt': openedAt,
                            ':closedAt': closedAt,
                        },
                        ExclusiveStartKey: lastEvaluatedKey,
                    })
                );

                if (salesResult.Items) {
                    allSales.push(...(salesResult.Items as Sale[]));
                }

                lastEvaluatedKey = salesResult.LastEvaluatedKey;
            } while (lastEvaluatedKey);

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Sort sales by createdAt descending
        allSales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Sanitize for role
        const sanitizedClosure = sanitizeForRole(closure, roles);
        const sanitizedSales = allSales.map((sale) => sanitizeForRole(sale, roles));

        return formatJSONResponse({
            closure: sanitizedClosure,
            sales: sanitizedSales,
        });
    } catch (err) {
        return buildErrorResponse(err);
    }
};
