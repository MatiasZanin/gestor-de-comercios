import { DynamoDBDocumentClient, BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }

  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );
}

export async function queryAllCommerceItems(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  commerceId: string,
  beginsWith?: string,
  consistentRead = true
): Promise<any[]> {
  const items: any[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression:
          beginsWith !== undefined
            ? 'PK = :pk AND begins_with(SK, :prefix)'
            : 'PK = :pk',
        ConsistentRead: consistentRead,
        ExpressionAttributeValues: beginsWith
          ? {
              ':pk': `COM#${commerceId}`,
              ':prefix': beginsWith,
            }
          : {
              ':pk': `COM#${commerceId}`,
            },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    items.push(...(result.Items ?? []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

export async function deleteItems(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  items: Array<{ PK: string; SK: string }>
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  for (const batch of chunkArray(
    items.map((item) => ({
      DeleteRequest: {
        Key: {
          PK: item.PK,
          SK: item.SK,
        },
      },
    })),
    25
  )) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch,
        },
      })
    );
  }
}

export async function cleanCommerceItems(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  commerceId: string,
  beginsWith?: string
): Promise<void> {
  const items = await queryAllCommerceItems(docClient, tableName, commerceId, beginsWith);
  await deleteItems(
    docClient,
    tableName,
    items.map((item) => ({ PK: item.PK, SK: item.SK }))
  );
}

export async function cleanAuditItemsByAction(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  commerceId: string,
  actions: string[]
): Promise<void> {
  const audits = await queryAllCommerceItems(docClient, tableName, commerceId, 'AUDIT#');
  const toDelete = audits.filter((item) => actions.includes(item.action));
  await deleteItems(
    docClient,
    tableName,
    toDelete.map((item) => ({ PK: item.PK, SK: item.SK }))
  );
}
