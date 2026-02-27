import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export type AuditAction =
    | 'PRODUCT_CREATE'
    | 'PRODUCT_UPDATE'
    | 'SALE_CREATE'
    | 'REGISTER_CLOSE'
    | 'OFFER_CREATE'
    | 'OFFER_UPDATE'
    | 'OFFER_FINISH';

/**
 * Registra un evento de auditoría en DynamoDB.
 * Maneja errores internamente para no romper el flujo principal.
 */
export async function logAudit(
    tableName: string,
    commerceId: string,
    userId: string,
    userEmail: string,
    action: AuditAction,
    details: Record<string, unknown>
): Promise<void> {
    try {
        const now = new Date().toISOString();
        const ttl = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

        await docClient.send(
            new PutCommand({
                TableName: tableName,
                Item: {
                    PK: `COM#${commerceId}`,
                    SK: `AUDIT#${now}#${randomUUID()}`,
                    type: 'AUDIT',
                    userId,
                    userEmail,
                    action,
                    details,
                    createdAt: now,
                    ttl,
                },
            })
        );
    } catch (err) {
        console.error('[AuditLogger] Failed to log audit event:', err);
    }
}
