import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { BillingProfile } from '../models/billing';
import type { CommerceProfile } from '../models/commerce';
import type { CommerceUserProfile } from '../models/user';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function tableName(): string {
  const value = process.env.TABLE_NAME;
  if (!value) throw new Error('TABLE_NAME env var is required');
  return value;
}

export function userKey(commerceId: string, cognitoSub: string) {
  return { PK: `COM#${commerceId}`, SK: `USER#${cognitoSub}` as const };
}

export async function getCommerceProfile(
  commerceId: string
): Promise<CommerceProfile | null> {
  const result = await documentClient.send(
    new GetCommand({
      TableName: tableName(),
      Key: { PK: `COM#${commerceId}`, SK: 'PROFILE' },
      ConsistentRead: true,
    })
  );
  return (result.Item as CommerceProfile | undefined) ?? null;
}

export async function getBillingProfile(
  commerceId: string
): Promise<BillingProfile | null> {
  const result = await documentClient.send(
    new GetCommand({
      TableName: tableName(),
      Key: { PK: `COM#${commerceId}`, SK: 'BILLING#PROFILE' },
      ConsistentRead: true,
    })
  );
  return (result.Item as BillingProfile | undefined) ?? null;
}

export async function getUserProfile(
  commerceId: string,
  cognitoSub: string
): Promise<CommerceUserProfile | null> {
  const result = await documentClient.send(
    new GetCommand({
      TableName: tableName(),
      Key: userKey(commerceId, cognitoSub),
      ConsistentRead: true,
    })
  );
  return (result.Item as CommerceUserProfile | undefined) ?? null;
}

export async function listUserProfiles(
  commerceId: string
): Promise<CommerceUserProfile[]> {
  const users: CommerceUserProfile[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await documentClient.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `COM#${commerceId}`,
          ':prefix': 'USER#',
        },
        ConsistentRead: true,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    users.push(...((page.Items ?? []) as CommerceUserProfile[]));
    exclusiveStartKey = page.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return users;
}

export async function createUserProfile(
  profile: CommerceUserProfile
): Promise<void> {
  await documentClient.send(
    new PutCommand({
      TableName: tableName(),
      Item: profile,
      ConditionExpression:
        'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );
}

export async function putUserProfile(
  profile: CommerceUserProfile
): Promise<void> {
  await documentClient.send(
    new PutCommand({ TableName: tableName(), Item: profile })
  );
}

export async function deleteUserProfile(
  commerceId: string,
  cognitoSub: string
): Promise<void> {
  await documentClient.send(
    new DeleteCommand({
      TableName: tableName(),
      Key: userKey(commerceId, cognitoSub),
    })
  );
}
