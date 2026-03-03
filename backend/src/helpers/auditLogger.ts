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

/**
 * Compara el estado anterior y posterior de un item y devuelve solo los campos
 * que cambiaron, con sus valores viejos y nuevos.
 * Incluye siempre los campos de identidad (id, name) para contexto.
 */
export function buildAuditChanges(
    oldItem: Record<string, unknown>,
    newItem: Record<string, unknown>,
    identityFields: Record<string, unknown>,
    trackedFields: string[]
): Record<string, unknown> {
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    for (const field of trackedFields) {
        const oldVal = oldItem[field];
        const newVal = newItem[field];
        const oldStr = JSON.stringify(oldVal);
        const newStr = JSON.stringify(newVal);
        if (oldStr !== newStr) {
            changes[field] = { old: oldVal ?? null, new: newVal ?? null };
        }
    }

    return {
        ...identityFields,
        changes,
    };
}
