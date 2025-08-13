import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { NotFoundError } from './errors';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Actualiza los contadores agregados de un producto (unitsSold, revenue, profit).
 * @param commerceId ID del comercio
 * @param code Código del producto
 * @param qty Cantidad (positiva para venta, negativa para devolución)
 * @param priceBuy Precio de compra por unidad
 * @param priceSale Precio de venta por unidad
 */
export async function updateDailyStats(
  commerceId: string,
  code: string,
  qty: number,
  priceBuy: number,
  priceSale: number,
): Promise<void> {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error('TABLE_NAME env var is required');
  }
  const pk = `COM#${commerceId}`;
  const sk = `PRODUCT#${code}`;
  const now = new Date().toISOString();
  const unitsDelta = qty;
  const revenueDelta = priceSale * qty;
  const profitDelta = (priceSale - priceBuy) * qty;
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: pk, SK: sk },
        UpdateExpression:
          'ADD unitsSold :unitsDelta, revenue :revenueDelta, profit :profitDelta SET updatedAt = :now',
        ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
        ExpressionAttributeValues: {
          ':unitsDelta': unitsDelta,
          ':revenueDelta': revenueDelta,
          ':profitDelta': profitDelta,
          ':now': now,
        },
        ReturnValues: 'NONE',
      }),
    );
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new NotFoundError('Product not found');
    }
    throw err;
  }
}