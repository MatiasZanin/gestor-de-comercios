import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { BadRequestError, NotFoundError } from './errors';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Ajusta el stock de un producto. Si la cantidad resultante sería negativa,
 * lanza BadRequestError. También actualiza el campo updatedAt.
 * 
 * Implementa Sparse Index para alertas de stock crítico:
 * - Si el nuevo stock <= minStock, agrega alertStatus = 'LOW'
 * - Si el nuevo stock > minStock, remueve alertStatus
 * 
 * @param commerceId ID del comercio
 * @param code Código del producto
 * @param qty Cantidad a restar (positivo para ventas, negativo para devoluciones/reposiciones)
 */
export async function updateStock(
  commerceId: string,
  code: string,
  qty: number
): Promise<number> {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error('TABLE_NAME env var is required');
  }
  const pk = `COM#${commerceId}`;
  const sk = `PRODUCT#${code}`;
  const now = new Date().toISOString();

  // Primero obtenemos el producto para conocer minStock y el stock actual
  const getResult = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: pk, SK: sk },
      ProjectionExpression: 'stock, minStock, alertStatus',
    })
  );

  if (!getResult.Item) {
    throw new NotFoundError('Product not found');
  }

  const currentStock = getResult.Item.stock ?? 0;
  const minStock = getResult.Item.minStock ?? 0;
  const newStock = currentStock - qty;

  // Validar que el stock no sea negativo
  if (newStock < 0) {
    throw new BadRequestError('Stock would become negative');
  }

  // Determinar si necesitamos agregar o remover alertStatus
  const shouldHaveAlert = minStock > 0 && newStock <= minStock;
  const currentlyHasAlert = !!getResult.Item.alertStatus;

  try {
    let updateExpression: string;
    const expressionValues: Record<string, any> = {
      ':newStock': newStock,
      ':now': now,
    };

    if (shouldHaveAlert && !currentlyHasAlert) {
      // CASO A: Stock baja del mínimo - agregar alertStatus
      updateExpression = 'SET stock = :newStock, updatedAt = :now, alertStatus = :status';
      expressionValues[':status'] = 'LOW';
    } else if (!shouldHaveAlert && currentlyHasAlert) {
      // CASO B: Stock se recupera - remover alertStatus (Sparse Index)
      updateExpression = 'SET stock = :newStock, updatedAt = :now REMOVE alertStatus';
    } else {
      // No hay cambio en el estado de alerta
      updateExpression = 'SET stock = :newStock, updatedAt = :now';
    }

    const result = await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: pk, SK: sk },
        UpdateExpression: updateExpression,
        ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK) AND stock = :currentStock',
        ExpressionAttributeValues: {
          ...expressionValues,
          ':currentStock': currentStock, // Optimistic locking
        },
        ReturnValues: 'UPDATED_NEW',
      })
    );

    return result.Attributes?.stock ?? newStock;
  } catch (err: any) {
    // Dynamo arroja una ConditionalCheckFailedException si se viola la condición
    if (err.name === 'ConditionalCheckFailedException') {
      // Puede ser por stock concurrente o producto no existe
      throw new BadRequestError('Stock update conflict - please retry');
    }
    if (err.name === 'ResourceNotFoundException') {
      throw new NotFoundError('Product not found');
    }
    throw err;
  }
}
