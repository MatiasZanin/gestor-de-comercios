import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
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
import { sanitizeForRole } from '../helpers/sanitizeForRole';
import { logAudit } from '../helpers/auditLogger';
import { CashClose, CreateCashCloseRequest } from '../models/cashClose';
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
        if (!commerceId) {
            throw new BadRequestError('Missing commerceId');
        }

        // Validate user has access to this commerce
        assertCommerceAccess(event, commerceId);

        // Verify permissions: admin or vendedor
        const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
        const roles: string[] | undefined = claims['cognito:groups'];
        if (
            !roles ||
            (!roles.includes('admin') && !roles.includes('vendedor'))
        ) {
            throw new ForbiddenError('Not authorized to close register');
        }

        if (!event.body) {
            throw new BadRequestError('Missing body');
        }

        const body: CreateCashCloseRequest = JSON.parse(event.body);

        // Validate required fields
        if (typeof body.declaredCash !== 'number') {
            throw new BadRequestError('declaredCash is required and must be a number');
        }
        if (typeof body.expenses !== 'number') {
            throw new BadRequestError('expenses is required and must be a number');
        }
        if (typeof body.initialFund !== 'number') {
            throw new BadRequestError('initialFund is required and must be a number');
        }

        const now = new Date();
        const closedAt = now.toISOString();
        const day = closedAt.slice(0, 10); // YYYY-MM-DD
        const closureId = randomUUID();
        const pk = `COM#${commerceId}`;

        // Find the last closure to determine openedAt
        const lastClosureResult = await docClient.send(
            new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
                ExpressionAttributeValues: {
                    ':pk': pk,
                    ':prefix': 'CLOSE#',
                },
                ScanIndexForward: false, // Descending order
                Limit: 1,
            })
        );

        let openedAt: string;
        if (lastClosureResult.Items && lastClosureResult.Items.length > 0) {
            // Use the closedAt of the last closure as openedAt
            openedAt = (lastClosureResult.Items[0] as CashClose).closedAt;
        } else {
            // No previous closure, use start of today (00:00:00)
            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);
            openedAt = startOfDay.toISOString();
        }

        // Query sales between openedAt and now to calculate totals
        // We need to query all days between openedAt and closedAt
        const openedDate = new Date(openedAt);
        const closedDate = new Date(closedAt);

        let systemTotalCash = 0;
        let systemTotalCard = 0;
        let systemTotalTransfer = 0;
        let systemTotalOther = 0;

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
                    for (const item of salesResult.Items as Sale[]) {
                        const paymentMethod = item.paymentMethod || 'CASH';
                        const total = item.total || 0;

                        switch (paymentMethod) {
                            case 'CASH':
                                systemTotalCash += total;
                                break;
                            case 'CARD':
                                systemTotalCard += total;
                                break;
                            case 'TRANSFER':
                                systemTotalTransfer += total;
                                break;
                            case 'OTHER':
                                systemTotalOther += total;
                                break;
                            // OTHER is ignored for register closing calculations
                        }
                    }
                }

                lastEvaluatedKey = salesResult.LastEvaluatedKey;
            } while (lastEvaluatedKey);

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Calculate difference: declaredCash - (systemTotalCash - expenses + initialFund)
        const expectedCash = systemTotalCash - body.expenses + body.initialFund;
        const difference = body.declaredCash - expectedCash;

        const sk = `CLOSE#${closedAt}#${closureId}`;

        const cashClose: CashClose = {
            PK: pk,
            SK: sk,
            GSI1PK: `COM#${commerceId}#${day}`,
            GSI1SK: closedAt,
            closureId,
            commerceId,
            userId: claims.sub || 'unknown',
            openedAt,
            closedAt,
            systemTotalCash,
            systemTotalCard,
            systemTotalTransfer,
            systemTotalOther,
            declaredCash: body.declaredCash,
            expenses: body.expenses,
            initialFund: body.initialFund,
            difference,
            notes: body.notes,
        };

        await docClient.send(
            new PutCommand({
                TableName: tableName,
                Item: cashClose,
            })
        );

        const userId = claims.sub as string;
        const userEmail = (claims.email as string) || '';
        await logAudit(tableName, commerceId, userId, userEmail, 'REGISTER_CLOSE', {
            difference, declaredCash: body.declaredCash,
        });

        const response = sanitizeForRole(cashClose, roles);

        return formatJSONResponse(response, 201);
    } catch (err) {
        return buildErrorResponse(err);
    }
};
