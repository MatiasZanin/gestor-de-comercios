import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DEFAULT_SCALE_BARCODE_CONFIG } from '../../models/commerce';

const REGION = process.env.AWS_REGION ?? 'us-east-1';
const TABLE_NAME = process.env.TABLE_NAME ?? 'GestionComercios-dev';
const COMMERCE_ID = process.env.SEED_USER_COMMERCE_ID ?? 'admin-testing';
const USERNAME = 'admin';
const EMAIL = 'admin@gestor-comercios.test';
const PASSWORD = 'Admin_2026';
const cognito = new CognitoIdentityProviderClient({ region: REGION });
const documentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION })
);

async function resolveUserPoolId() {
  if (process.env.COGNITO_USER_POOL_ID) return process.env.COGNITO_USER_POOL_ID;
  const pools = await cognito.send(
    new ListUserPoolsCommand({ MaxResults: 60 })
  );
  const pool = pools.UserPools?.find(item => item.Name === 'commerce-mvp-dev');
  if (!pool?.Id)
    throw new Error(
      'No se encontró commerce-mvp-dev; definí COGNITO_USER_POOL_ID'
    );
  return pool.Id;
}

async function main() {
  const userPoolId = await resolveUserPoolId();
  try {
    await cognito.send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: USERNAME })
    );
  } catch (error) {
    if ((error as { name?: string }).name !== 'UserNotFoundException')
      throw error;
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: USERNAME,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: EMAIL },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'given_name', Value: 'Admin' },
          { Name: 'family_name', Value: 'Testing' },
          { Name: 'custom:commerceIds', Value: COMMERCE_ID },
          { Name: 'custom:accountStatus', Value: 'active' },
        ],
      })
    );
  }
  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId,
      Username: USERNAME,
      UserAttributes: [
        { Name: 'email', Value: EMAIL },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: 'Admin' },
        { Name: 'family_name', Value: 'Testing' },
        { Name: 'custom:commerceIds', Value: COMMERCE_ID },
        { Name: 'custom:accountStatus', Value: 'active' },
      ],
    })
  );
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: USERNAME,
      Password: PASSWORD,
      Permanent: true,
    })
  );
  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: USERNAME,
      GroupName: 'admin',
    })
  );
  const user = await cognito.send(
    new AdminGetUserCommand({ UserPoolId: userPoolId, Username: USERNAME })
  );
  const sub = user.UserAttributes?.find(item => item.Name === 'sub')?.Value;
  if (!sub) throw new Error('Cognito no devolvió el sub del usuario admin');
  const now = new Date().toISOString();
  await Promise.all([
    documentClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `COM#${COMMERCE_ID}`,
          SK: 'PROFILE',
          type: 'COMMERCE',
          commerceId: COMMERCE_ID,
          merchantName: 'Comercio Admin Testing',
          ownerCognitoSub: sub,
          ownerEmail: EMAIL,
          scaleBarcodeConfig: DEFAULT_SCALE_BARCODE_CONFIG,
          createdAt: now,
          updatedAt: now,
        },
      })
    ),
    documentClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `COM#${COMMERCE_ID}`,
          SK: 'BILLING#PROFILE',
          type: 'BILLING_PROFILE',
          commerceId: COMMERCE_ID,
          status: 'active',
          ownerEmail: EMAIL,
          ownerCognitoSub: sub,
          merchantName: 'Comercio Admin Testing',
          mercadoPagoPlanId: 'seed',
          createdAt: now,
          updatedAt: now,
        },
      })
    ),
    documentClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `COM#${COMMERCE_ID}`,
          SK: `USER#${sub}`,
          type: 'COMMERCE_USER',
          commerceId: COMMERCE_ID,
          cognitoSub: sub,
          cognitoUsername: USERNAME,
          email: EMAIL,
          firstName: 'Admin',
          lastName: 'Testing',
          role: 'admin',
          createdAt: now,
          updatedAt: now,
        },
      })
    ),
  ]);
  console.log(
    `Seed listo: ${USERNAME} / ${PASSWORD} — comercio ${COMMERCE_ID}`
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
