import {
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
  ListUsersCommand,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import type { CommerceProfile } from '../../models/commerce';
import type { CommerceUserProfile } from '../../models/user';

const apply = process.argv.includes('--apply');
const tableName = process.env.TABLE_NAME ?? 'GestionComercios-dev';
const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});
const documentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
);

function attribute(attributes: AttributeType[] | undefined, name: string) {
  return attributes?.find(item => item.Name === name)?.Value ?? '';
}

async function resolveUserPoolId() {
  if (process.env.COGNITO_USER_POOL_ID) return process.env.COGNITO_USER_POOL_ID;
  const pools = await cognito.send(
    new ListUserPoolsCommand({ MaxResults: 60 })
  );
  const pool = pools.UserPools?.find(
    item => item.Name === 'gestor-comercios-dev'
  );
  if (!pool?.Id)
    throw new Error(
      'No se encontró gestor-comercios-dev; definí COGNITO_USER_POOL_ID'
    );
  return pool.Id;
}

async function main() {
  const userPoolId = await resolveUserPoolId();
  let paginationToken: string | undefined;
  do {
    const page = await cognito.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        PaginationToken: paginationToken,
      })
    );
    for (const user of page.Users ?? []) {
      if (!user.Username) continue;
      const commerceIds = attribute(user.Attributes, 'custom:commerceIds')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);
      const sub = attribute(user.Attributes, 'sub');
      const email = attribute(user.Attributes, 'email').trim().toLowerCase();
      if (!sub || !email || commerceIds.length === 0) continue;
      const groups = await cognito.send(
        new AdminListGroupsForUserCommand({
          UserPoolId: userPoolId,
          Username: user.Username,
        })
      );
      const groupNames = new Set(
        (groups.Groups ?? []).map(group => group.GroupName)
      );
      const role = groupNames.has('admin')
        ? 'admin'
        : groupNames.has('vendedor')
          ? 'vendedor'
          : null;
      if (!role) continue;
      for (const commerceId of commerceIds) {
        const commerceResult = await documentClient.send(
          new GetCommand({
            TableName: tableName,
            Key: { PK: `COM#${commerceId}`, SK: 'PROFILE' },
          })
        );
        const commerce = commerceResult.Item as CommerceProfile | undefined;
        if (!commerce) continue;
        const now = new Date().toISOString();
        const profile: CommerceUserProfile = {
          PK: `COM#${commerceId}`,
          SK: `USER#${sub}`,
          type: 'COMMERCE_USER',
          commerceId,
          cognitoSub: sub,
          cognitoUsername: user.Username,
          email,
          firstName: attribute(user.Attributes, 'given_name') || user.Username,
          lastName: attribute(user.Attributes, 'family_name'),
          role,
          createdAt:
            user.UserCreateDate?.toISOString() ?? commerce.createdAt ?? now,
          updatedAt: now,
        };
        console.log(apply ? 'APPLY' : 'DRY-RUN', {
          commerceId,
          username: user.Username,
          role,
        });
        if (apply)
          await documentClient.send(
            new PutCommand({ TableName: tableName, Item: profile })
          );
      }
    }
    paginationToken = page.PaginationToken;
  } while (paginationToken);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
