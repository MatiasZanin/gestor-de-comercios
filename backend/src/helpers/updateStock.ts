import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BadRequestError, NotFoundError } from './errors';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Ajusta el stock de un producto. Si la cantidad resultante sería negativa,
 * lanza BadRequestError. También actualiza el campo updatedAt.
 * @param commerceId ID del comercio
 * @param code Código del producto
 * @param qty Cantidad a sumar (negativo para devoluciones)
 */
export async function updateStock(
  commerceId: string,
  code: string,
  qty: number,
): Promise<number> {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error('TABLE_NAME env var is required');
  }
  const pk = `COM#${commerceId}`;
  const sk = `PRODUCT#${code}`;
  const now = new Date().toISOString();
  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: pk, SK: sk },
        UpdateExpression: 'SET stock = stock + :qty, updatedAt = :now',
        ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK) AND stock + :qty >= :zero',
        ExpressionAttributeValues: {
          ':qty': qty,
          ':now': now,
          ':zero': 0,
        },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    const newStock = result.Attributes?.stock;
    return newStock;
  } catch (err: any) {
    // Dynamo arroja una ConditionalCheckFailedException si se viola la condición
    if (err.name === 'ConditionalCheckFailedException') {
      throw new BadRequestError('Stock would become negative');
    }
    if (err.name === 'ResourceNotFoundException') {
      throw new NotFoundError('Product not found');
    }
    throw err;
  }
}