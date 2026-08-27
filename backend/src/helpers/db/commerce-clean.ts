import {
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUserPoolsCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { DEFAULT_SCALE_BARCODE_CONFIG } from '../../models/commerce';

// CONFIGURACIÓN
const TABLE_NAME = 'GestionComercios-dev';
const COMMERCE_ID = 'gs';
const REGION = 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

async function resolveTestUsers() {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const vendorEmail = process.env.E2E_VENDOR_EMAIL;
  if (!adminEmail || !vendorEmail) {
    throw new Error('E2E_ADMIN_EMAIL and E2E_VENDOR_EMAIL are required');
  }
  const pools = await cognitoClient.send(
    new ListUserPoolsCommand({ MaxResults: 60 })
  );
  const userPoolId =
    process.env.COGNITO_USER_POOL_ID ??
    pools.UserPools?.find(pool => pool.Name === 'gestor-comercios-dev')?.Id;
  if (!userPoolId) throw new Error('No se encontró el User Pool dev');
  const resolve = async (username: string, role: 'admin' | 'vendedor') => {
    const listed = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Filter: `email = "${username.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
        Limit: 1,
      })
    );
    const internalUsername = listed.Users?.[0]?.Username;
    if (!internalUsername)
      throw new Error(`No se encontró el fixture Cognito para el rol ${role}`);
    const user = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: internalUsername,
      })
    );
    const attribute = (name: string) =>
      user.UserAttributes?.find(item => item.Name === name)?.Value ?? '';
    return {
      username: internalUsername,
      sub: attribute('sub'),
      email: attribute('email').trim().toLowerCase(),
      firstName: attribute('given_name') || username,
      lastName: attribute('family_name'),
      role,
    };
  };
  return Promise.all([
    resolve(adminEmail, 'admin'),
    resolve(vendorEmail, 'vendedor'),
  ]);
}

async function cleanGestionComercios() {
  const pkToClean = `COM#${COMMERCE_ID}`;
  console.log(`🔥 Iniciando borrado total para: ${pkToClean}`);

  try {
    let itemsToDelete: any[] = [];
    let lastEvaluatedKey;
    let totalDeleted = 0;

    // 1. RECOLECTAR TODOS LOS ITEMS (Maneja paginación)
    console.log('🔍 Buscando items en la base de datos...');
    do {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': pkToClean },
        })
      );

      if (result.Items) {
        itemsToDelete.push(...result.Items);
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
      process.stdout.write('.'); // Feedback visual
    } while (lastEvaluatedKey);

    console.log(
      `\n📦 Encontrados ${itemsToDelete.length} items para eliminar.`
    );

    // 2. ELIMINAR ITEMS
    // Nota: Para grandes volúmenes (>500 items), sería mejor usar batchWrite o controlar la concurrencia.
    // Aquí mantenemos tu lógica original de Promise.all para mantenerlo simple.
    console.log('🧹 Ejecutando eliminaciones...');

    const deletePromises = itemsToDelete.map(item =>
      docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { PK: item.PK, SK: item.SK },
        })
      )
    );

    await Promise.all(deletePromises);

    const now = new Date().toISOString();
    const [admin, vendor] = await resolveTestUsers();
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `COM#${COMMERCE_ID}`,
          SK: 'PROFILE',
          type: 'COMMERCE',
          commerceId: COMMERCE_ID,
          merchantName: 'G&S Comercio - Gestión de Suscripción',
          ownerCognitoSub: admin.sub,
          ownerEmail: admin.email,
          scaleBarcodeConfig: DEFAULT_SCALE_BARCODE_CONFIG,
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    for (const user of [admin, vendor]) {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `COM#${COMMERCE_ID}`,
            SK: `USER#${user.sub}`,
            type: 'COMMERCE_USER',
            commerceId: COMMERCE_ID,
            cognitoSub: user.sub,
            cognitoUsername: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            createdAt: now,
            updatedAt: now,
          },
        })
      );
    }

    console.log(
      `✅ ÉXITO: Se eliminaron ${itemsToDelete.length} registros y se recreó el perfil base de ${COMMERCE_ID}.`
    );
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  }
}

cleanGestionComercios();
