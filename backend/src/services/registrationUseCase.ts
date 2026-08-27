import { createHash, randomUUID } from 'crypto';
import {
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ListUsersCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { BILLING_STATUS, billingConfig, nowIso } from '../config/billing';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../helpers/errors';
import type {
  BillingProfile,
  PublicRegistrationRequest,
  PublicRegistrationResponse,
  RegistrationRecord,
  RegistrationStatusResponse,
} from '../models/billing';
import {
  DEFAULT_SCALE_BARCODE_CONFIG,
  type CommerceProfile,
} from '../models/commerce';
import type { CommerceUserProfile } from '../models/user';
import { createWelcomeEmailNotification } from './transactionalEmail';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const cognitoClient = new CognitoIdentityProviderClient({});

// Cognito confirmation codes are normally valid for 24 hours. Pending records stay
// usable for 48 hours and remain physically present for another 7 days so the
// scheduled cleanup can delete the matching UNCONFIRMED Cognito identity safely.
export const REGISTRATION_LIFETIME_SECONDS = 48 * 60 * 60;
export const REGISTRATION_TTL_GRACE_SECONDS = 7 * 24 * 60 * 60;
export const REGISTRATION_RESEND_COOLDOWN_SECONDS = 60;
export const REGISTRATION_EMAIL_CHANGE_COOLDOWN_SECONDS = 5 * 60;
const GENERIC_RECOVERY_MESSAGE =
  'Si existe un alta pendiente para ese email, enviaremos un nuevo código. Revisá también Spam o Correo no deseado.';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhoneNumber(phoneNumber: string): string {
  const parsed = parsePhoneNumberFromString(phoneNumber.trim(), 'AR');
  if (!parsed?.isValid())
    throw new BadRequestError('Ingresá un número de teléfono válido');
  return parsed.number;
}

function normalizeName(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function emailHash(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

function emailLookupKey(email: string): string {
  return `PENDING_EMAIL#${emailHash(email)}`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

function registrationKey(registrationId: string) {
  return { PK: `REG#${registrationId}`, SK: 'REGISTRATION' as const };
}

function commerceKey(commerceId: string) {
  return { PK: `COM#${commerceId}`, SK: 'PROFILE' as const };
}

function billingKey(commerceId: string) {
  return { PK: `COM#${commerceId}`, SK: 'BILLING#PROFILE' as const };
}

async function getRegistration(
  registrationId: string
): Promise<RegistrationRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: requireEnv('TABLE_NAME'),
      Key: registrationKey(registrationId),
      ConsistentRead: true,
    })
  );
  return (result.Item as RegistrationRecord | undefined) ?? null;
}

async function findPendingRegistrationByEmail(
  email: string
): Promise<RegistrationRecord | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: requireEnv('TABLE_NAME'),
      IndexName: requireEnv('REGISTRATION_EMAIL_GSI'),
      KeyConditionExpression: 'emailLookupPk = :pk',
      ExpressionAttributeValues: { ':pk': emailLookupKey(email) },
      ScanIndexForward: false,
      Limit: 5,
    })
  );
  return (
    (result.Items as RegistrationRecord[] | undefined)?.find(
      item =>
        item.type === 'REGISTRATION' &&
        item.status === 'email_verification_pending'
    ) ?? null
  );
}

async function findCognitoUsersByEmail(email: string): Promise<UserType[]> {
  const escaped = normalizeEmail(email)
    .replace(/\\/g, '\\\\')
    .replace(/\"/g, '\\"');
  const result = await cognitoClient.send(
    new ListUsersCommand({
      UserPoolId: requireEnv('COGNITO_USER_POOL_ID'),
      Filter: `email = "${escaped}"`,
      Limit: 2,
    })
  );
  return result.Users ?? [];
}

function cognitoAttribute(
  user: Awaited<ReturnType<typeof getCognitoUser>>,
  name: string
): string {
  return (
    user.UserAttributes?.find(attribute => attribute.Name === name)?.Value ?? ''
  );
}

async function getCognitoUser(username: string) {
  return cognitoClient.send(
    new AdminGetUserCommand({
      UserPoolId: requireEnv('COGNITO_USER_POOL_ID'),
      Username: username,
    })
  );
}

async function deleteExpiredUnconfirmedUser(
  registration: RegistrationRecord
): Promise<void> {
  try {
    const user = await getCognitoUser(
      registration.userPoolUsername || registration.email
    );
    if (user.UserStatus === 'UNCONFIRMED') {
      await cognitoClient.send(
        new AdminDeleteUserCommand({
          UserPoolId: requireEnv('COGNITO_USER_POOL_ID'),
          Username: user.Username ?? registration.email,
        })
      );
    }
  } catch (error: any) {
    if (error?.name !== 'UserNotFoundException') throw error;
  }
}

function assertValidRegistrationInput(input: PublicRegistrationRequest) {
  if (!input.acceptTerms)
    throw new BadRequestError('Debe aceptar los términos y condiciones');
  if (
    !normalizeName(input.firstName) ||
    !normalizeName(input.lastName) ||
    !normalizeName(input.merchantName)
  ) {
    throw new BadRequestError('Faltan datos obligatorios');
  }
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new BadRequestError('Ingresá un email válido');
  if (input.password.length < 8)
    throw new BadRequestError('La contraseña debe tener al menos 8 caracteres');
}

async function createCognitoIdentity(
  input: PublicRegistrationRequest,
  email: string,
  phoneNumber: string
) {
  return cognitoClient.send(
    new SignUpCommand({
      ClientId: requireEnv('COGNITO_CLIENT_ID'),
      Username: email,
      Password: input.password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'given_name', Value: normalizeName(input.firstName) },
        { Name: 'family_name', Value: normalizeName(input.lastName) },
        { Name: 'phone_number', Value: phoneNumber },
      ],
    })
  );
}

export async function createPublicRegistration(
  input: PublicRegistrationRequest
): Promise<PublicRegistrationResponse> {
  assertValidRegistrationInput(input);
  requireEnv('TABLE_NAME');
  requireEnv('COGNITO_USER_POOL_ID');
  requireEnv('COGNITO_CLIENT_ID');

  const email = normalizeEmail(input.email);
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const existingRegistration = await findPendingRegistrationByEmail(email);
  if (
    existingRegistration &&
    existingRegistration.expiresAt > Math.floor(Date.now() / 1000)
  ) {
    throw new ConflictError(
      'Ya existe un alta pendiente. Reenviá el código desde Confirmar cuenta.'
    );
  }
  if (existingRegistration) {
    await deleteExpiredUnconfirmedUser(existingRegistration);
    await docClient.send(
      new DeleteCommand({
        TableName: requireEnv('TABLE_NAME'),
        Key: registrationKey(existingRegistration.registrationId),
      })
    );
  }

  const cognitoUsers = await findCognitoUsersByEmail(email);
  const confirmedUser = cognitoUsers.find(
    user => user.UserStatus === 'CONFIRMED'
  );
  if (confirmedUser)
    throw new ConflictError('Ya existe una cuenta para ese email');
  for (const user of cognitoUsers.filter(
    user => user.UserStatus === 'UNCONFIRMED'
  )) {
    await cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: requireEnv('COGNITO_USER_POOL_ID'),
        Username: user.Username!,
      })
    );
  }

  const registrationId = randomUUID();
  const commerceId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const createdAt = nowIso();
  const registration: RegistrationRecord = {
    ...registrationKey(registrationId),
    type: 'REGISTRATION',
    registrationId,
    commerceId,
    email,
    emailLookupPk: emailLookupKey(email),
    emailLookupSk: `${createdAt}#${registrationId}`,
    firstName: normalizeName(input.firstName),
    lastName: normalizeName(input.lastName),
    phoneNumber,
    merchantName: normalizeName(input.merchantName),
    status: 'email_verification_pending',
    userPoolUsername: '',
    createdAt,
    updatedAt: createdAt,
    retryCount: 1,
    expiresAt: now + REGISTRATION_LIFETIME_SECONDS,
    ttl: now + REGISTRATION_LIFETIME_SECONDS + REGISTRATION_TTL_GRACE_SECONDS,
    lastCodeSentAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: requireEnv('TABLE_NAME'),
      Item: registration,
      ConditionExpression:
        'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    })
  );
  let deliveryMedium: 'EMAIL' = 'EMAIL';
  try {
    const result = await createCognitoIdentity(input, email, phoneNumber);
    if (result.CodeDeliveryDetails?.DeliveryMedium !== 'EMAIL') {
      throw new Error(
        'Cognito did not select email as the confirmation delivery medium'
      );
    }
    deliveryMedium = result.CodeDeliveryDetails.DeliveryMedium;
    registration.userPoolUsername = result.UserSub ?? email;
    await docClient.send(
      new PutCommand({
        TableName: requireEnv('TABLE_NAME'),
        Item: registration,
      })
    );
  } catch (error) {
    await docClient.send(
      new DeleteCommand({
        TableName: requireEnv('TABLE_NAME'),
        Key: registrationKey(registrationId),
      })
    );
    throw error;
  }

  return {
    registrationId,
    status: registration.status,
    maskedEmail: maskEmail(email),
    email,
    cooldownSeconds: REGISTRATION_RESEND_COOLDOWN_SECONDS,
    deliveryMedium,
  };
}

async function markCodeSent(
  registration: RegistrationRecord,
  cooldownSeconds: number
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  if ((registration.lastCodeSentAt ?? 0) + cooldownSeconds > now) return false;
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: requireEnv('TABLE_NAME'),
        Key: registrationKey(registration.registrationId),
        UpdateExpression:
          'SET lastCodeSentAt = :now, updatedAt = :updated ADD retryCount :one',
        ConditionExpression:
          '#status = :pending AND (attribute_not_exists(lastCodeSentAt) OR lastCodeSentAt <= :availableAt)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':now': now,
          ':updated': nowIso(),
          ':one': 1,
          ':pending': 'email_verification_pending',
          ':availableAt': now - cooldownSeconds,
        },
      })
    );
    return true;
  } catch (error: any) {
    if (error?.name === 'ConditionalCheckFailedException') return false;
    throw error;
  }
}

async function resendForRegistration(
  registration: RegistrationRecord
): Promise<boolean> {
  if (registration.expiresAt <= Math.floor(Date.now() / 1000)) return false;
  if (!(await markCodeSent(registration, REGISTRATION_RESEND_COOLDOWN_SECONDS)))
    return false;
  await cognitoClient.send(
    new ResendConfirmationCodeCommand({
      ClientId: requireEnv('COGNITO_CLIENT_ID'),
      Username: registration.userPoolUsername || registration.email,
    })
  );
  return true;
}

export async function resendRegistrationCode(registrationId: string) {
  const registration = await getRegistration(registrationId);
  if (!registration || registration.status !== 'email_verification_pending') {
    return {
      sent: true,
      message: GENERIC_RECOVERY_MESSAGE,
      cooldownSeconds: REGISTRATION_RESEND_COOLDOWN_SECONDS,
    };
  }
  await resendForRegistration(registration);
  return {
    sent: true,
    message: GENERIC_RECOVERY_MESSAGE,
    cooldownSeconds: REGISTRATION_RESEND_COOLDOWN_SECONDS,
  };
}

export async function recoverPendingRegistration(emailInput: string) {
  const email = normalizeEmail(emailInput);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const registration = await findPendingRegistrationByEmail(email);
    if (registration)
      await resendForRegistration(registration).catch(() => false);
  }
  return {
    sent: true,
    message: GENERIC_RECOVERY_MESSAGE,
    cooldownSeconds: REGISTRATION_RESEND_COOLDOWN_SECONDS,
  };
}

export async function recoverPendingRegistrationAccess(
  emailInput: string,
  password: string
) {
  const email = normalizeEmail(emailInput);
  const denied = () =>
    new UnauthorizedError('No se pudo recuperar el alta pendiente');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    throw denied();
  }

  await assertUnconfirmedCredentials(email, password);

  const registration = await findPendingRegistrationByEmail(email);
  if (
    !registration ||
    registration.expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    throw denied();
  }

  return {
    registrationId: registration.registrationId,
    email: registration.email,
  };
}

async function assertUnconfirmedCredentials(
  username: string,
  password: string
): Promise<void> {
  try {
    await cognitoClient.send(
      new InitiateAuthCommand({
        ClientId: requireEnv('COGNITO_CLIENT_ID'),
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      })
    );
    // A confirmed account must never grant access to a stale pending record.
    throw new UnauthorizedError('No se pudo recuperar el alta pendiente');
  } catch (error: any) {
    if (error instanceof UnauthorizedError) throw error;
    // Cognito only reaches this state after accepting the credentials for an
    // existing identity. No token is issued while the user is unconfirmed.
    if (error?.name !== 'UserNotConfirmedException') {
      throw new UnauthorizedError('No se pudo recuperar el alta pendiente');
    }
  }
}

async function materializeConfirmedRegistration(
  registration: RegistrationRecord
) {
  if (registration.status !== 'email_verification_pending') {
    return {
      registrationId: registration.registrationId,
      status: registration.status,
      loginUrl: '/login?confirmed=1',
    };
  }
  const user = await getCognitoUser(
    registration.userPoolUsername || registration.email
  );
  if (user.UserStatus !== 'CONFIRMED')
    throw new ConflictError('La cuenta todavía no está confirmada');
  const ownerCognitoSub = cognitoAttribute(user, 'sub');
  if (!ownerCognitoSub) throw new Error('Confirmed Cognito user has no sub');
  const cognitoUsername = user.Username ?? registration.userPoolUsername;
  const updatedAt = nowIso();

  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: requireEnv('COGNITO_USER_POOL_ID'),
      Username: cognitoUsername,
      UserAttributes: [
        {
          Name: 'custom:accountStatus',
          Value: BILLING_STATUS.PENDING_SUBSCRIPTION,
        },
        { Name: 'custom:commerceIds', Value: registration.commerceId },
        { Name: 'custom:regId', Value: registration.registrationId },
      ],
    })
  );
  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: requireEnv('COGNITO_USER_POOL_ID'),
      Username: cognitoUsername,
      GroupName: 'admin',
    })
  );

  const commerce: CommerceProfile = {
    ...commerceKey(registration.commerceId),
    type: 'COMMERCE',
    commerceId: registration.commerceId,
    merchantName: registration.merchantName,
    ownerCognitoSub,
    ownerEmail: registration.email,
    scaleBarcodeConfig: DEFAULT_SCALE_BARCODE_CONFIG,
    createdAt: registration.createdAt,
    updatedAt,
  };
  const billing: BillingProfile = {
    ...billingKey(registration.commerceId),
    type: 'BILLING_PROFILE',
    commerceId: registration.commerceId,
    merchantName: registration.merchantName,
    ownerEmail: registration.email,
    ownerCognitoSub,
    status: BILLING_STATUS.PENDING_SUBSCRIPTION,
    mercadoPagoPlanId: billingConfig.planId,
    createdAt: registration.createdAt,
    updatedAt,
  };
  const ownerUser: CommerceUserProfile = {
    PK: `COM#${registration.commerceId}`,
    SK: `USER#${ownerCognitoSub}`,
    type: 'COMMERCE_USER',
    commerceId: registration.commerceId,
    cognitoSub: ownerCognitoSub,
    cognitoUsername,
    email: registration.email,
    phoneNumber: registration.phoneNumber,
    firstName: registration.firstName,
    lastName: registration.lastName,
    role: 'admin',
    createdAt: registration.createdAt,
    updatedAt,
  };
  const completed: RegistrationRecord = {
    ...registration,
    ownerCognitoSub,
    userPoolUsername: cognitoUsername,
    status: 'pending_subscription',
    updatedAt,
  };
  delete (completed as Partial<RegistrationRecord>).emailLookupPk;
  delete (completed as Partial<RegistrationRecord>).emailLookupSk;
  delete (completed as Partial<RegistrationRecord>).ttl;

  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: requireEnv('TABLE_NAME'),
              Item: commerce,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Put: {
              TableName: requireEnv('TABLE_NAME'),
              Item: billing,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Put: {
              TableName: requireEnv('TABLE_NAME'),
              Item: ownerUser,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Put: {
              TableName: requireEnv('TABLE_NAME'),
              Item: completed,
              ConditionExpression: '#status = :pending',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: {
                ':pending': 'email_verification_pending',
              },
            },
          },
        ],
        ClientRequestToken: registration.registrationId,
      })
    );
  } catch (error: any) {
    if (error?.name !== 'TransactionCanceledException') throw error;
    const current = await getRegistration(registration.registrationId);
    if (current?.status !== 'pending_subscription') throw error;
  }

  await createWelcomeEmailNotification({
    registrationId: registration.registrationId,
    email: registration.email,
    firstName: registration.firstName,
    merchantName: registration.merchantName,
  });
  return {
    registrationId: registration.registrationId,
    status: 'pending_subscription',
    loginUrl: '/login?confirmed=1',
  };
}

export async function confirmRegistrationEmail(
  registrationId: string,
  code: string
) {
  const registration = await getRegistration(registrationId);
  if (!registration)
    throw new NotFoundError(
      'El alta pendiente venció. Iniciá el registro nuevamente.'
    );
  return confirmAndMaterialize(registration, code);
}

export async function confirmRecoveredRegistration(
  emailInput: string,
  code: string
) {
  const registration = await findPendingRegistrationByEmail(
    normalizeEmail(emailInput)
  );
  if (!registration)
    throw new BadRequestError('No se pudo confirmar la cuenta');
  return confirmAndMaterialize(registration, code);
}

async function confirmAndMaterialize(
  registration: RegistrationRecord,
  code: string
) {
  if (registration.status === 'email_verification_pending') {
    try {
      await cognitoClient.send(
        new ConfirmSignUpCommand({
          ClientId: requireEnv('COGNITO_CLIENT_ID'),
          Username: registration.userPoolUsername || registration.email,
          ConfirmationCode: code,
        })
      );
    } catch (error: any) {
      if (error?.name === 'CodeMismatchException')
        throw new BadRequestError('El código ingresado es incorrecto');
      if (error?.name === 'ExpiredCodeException')
        throw new BadRequestError('El código venció. Solicitá uno nuevo');
      if (error?.name !== 'NotAuthorizedException') throw error;
      const user = await getCognitoUser(
        registration.userPoolUsername || registration.email
      );
      if (user.UserStatus !== 'CONFIRMED') throw error;
    }
  }
  return materializeConfirmedRegistration(registration);
}

export async function changePendingRegistrationEmail(input: {
  registrationId: string;
  newEmail: string;
  password?: string;
}) {
  const registration = await getRegistration(input.registrationId);
  if (!registration || registration.status !== 'email_verification_pending') {
    throw new NotFoundError('Alta pendiente no encontrada');
  }
  const now = Math.floor(Date.now() / 1000);
  if (registration.expiresAt <= now)
    throw new ConflictError('El alta venció. Iniciá el registro nuevamente.');
  const cognitoUsername = registration.userPoolUsername || registration.email;
  const user = await getCognitoUser(cognitoUsername);
  if (user.UserStatus !== 'UNCONFIRMED')
    throw new ConflictError('La cuenta ya fue confirmada');
  const newEmail = normalizeEmail(input.newEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail))
    throw new BadRequestError('Ingresá un email válido');
  if (newEmail === registration.email)
    return resendRegistrationCode(registration.registrationId);
  if (
    (await findCognitoUsersByEmail(newEmail)).some(
      candidate => candidate.Username !== user.Username
    )
  )
    throw new ConflictError('No se pudo utilizar ese email');
  if (!input.password) {
    return {
      passwordRequired: true,
      message: 'Volvé a ingresar tu contraseña para aplicar el cambio.',
    };
  }
  if (input.password.length < 8)
    throw new BadRequestError('Ingresá tu contraseña');
  await assertUnconfirmedCredentials(cognitoUsername, input.password);
  if (
    (registration.lastEmailChangedAt ?? 0) +
      REGISTRATION_EMAIL_CHANGE_COOLDOWN_SECONDS >
    now
  ) {
    throw new ConflictError(
      'Esperá unos minutos antes de volver a cambiar el email'
    );
  }
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: requireEnv('TABLE_NAME'),
        Key: registrationKey(registration.registrationId),
        UpdateExpression: 'SET lastEmailChangedAt = :now, updatedAt = :updated',
        ConditionExpression:
          '#status = :pending AND (attribute_not_exists(lastEmailChangedAt) OR lastEmailChangedAt <= :availableAt)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':now': now,
          ':updated': nowIso(),
          ':pending': 'email_verification_pending',
          ':availableAt': now - REGISTRATION_EMAIL_CHANGE_COOLDOWN_SECONDS,
        },
      })
    );
  } catch (error: any) {
    if (error?.name === 'ConditionalCheckFailedException') {
      throw new ConflictError(
        'Esperá unos minutos antes de volver a cambiar el email'
      );
    }
    throw error;
  }
  try {
    const latest = await getCognitoUser(cognitoUsername);
    if (latest.UserStatus !== 'UNCONFIRMED')
      throw new ConflictError('La cuenta ya fue confirmada');

    // UsernameAttributes=email stores a stable UUID username equal to sub.
    // Activate the corrected email on that same identity, immediately mark it
    // unverified again, and use the normal sign-up OTP to verify and confirm it.
    await cognitoClient.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: requireEnv('COGNITO_USER_POOL_ID'),
        Username: cognitoUsername,
        UserAttributes: [
          { Name: 'email', Value: newEmail },
          { Name: 'email_verified', Value: 'true' },
        ],
      })
    );
    await cognitoClient.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: requireEnv('COGNITO_USER_POOL_ID'),
        Username: cognitoUsername,
        UserAttributes: [{ Name: 'email_verified', Value: 'false' }],
      })
    );
    const resent = await cognitoClient.send(
      new ResendConfirmationCodeCommand({
        ClientId: requireEnv('COGNITO_CLIENT_ID'),
        Username: cognitoUsername,
      })
    );
    if (resent.CodeDeliveryDetails?.DeliveryMedium !== 'EMAIL') {
      throw new Error('Cognito did not select email for the corrected address');
    }

    const updatedAt = nowIso();
    const updated: RegistrationRecord = {
      ...registration,
      email: newEmail,
      emailLookupPk: emailLookupKey(newEmail),
      emailLookupSk: `${updatedAt}#${registration.registrationId}`,
      userPoolUsername: cognitoUsername,
      lastEmailChangedAt: now,
      lastCodeSentAt: now,
      updatedAt,
      retryCount: registration.retryCount + 1,
    };
    await docClient.send(
      new PutCommand({
        TableName: requireEnv('TABLE_NAME'),
        Item: updated,
        ConditionExpression: '#status = :pending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':pending': 'email_verification_pending',
        },
      })
    );
  } catch (error) {
    // Release the reservation so a transient Cognito/DynamoDB failure can be
    // retried against the stable internal username without recreating the user.
    await docClient
      .send(
        new UpdateCommand({
          TableName: requireEnv('TABLE_NAME'),
          Key: registrationKey(registration.registrationId),
          UpdateExpression:
            'SET updatedAt = :updated REMOVE lastEmailChangedAt',
          ConditionExpression: 'lastEmailChangedAt = :now',
          ExpressionAttributeValues: { ':updated': nowIso(), ':now': now },
        })
      )
      .catch(() => undefined);
    throw error;
  }
  return {
    passwordRequired: false,
    email: newEmail,
    maskedEmail: maskEmail(newEmail),
    cooldownSeconds: REGISTRATION_RESEND_COOLDOWN_SECONDS,
  };
}

export async function getRegistrationStatus(
  registrationId: string
): Promise<RegistrationStatusResponse> {
  const registration = await getRegistration(registrationId);
  if (!registration) throw new NotFoundError('Alta pendiente no encontrada');
  return {
    registrationId,
    status: registration.status,
    maskedEmail: maskEmail(registration.email),
    merchantName: registration.merchantName,
  };
}

export async function cleanupExpiredRegistrations(): Promise<{
  inspected: number;
  deleted: number;
  completed: number;
}> {
  let inspected = 0;
  let deleted = 0;
  let completed = 0;
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  const now = Math.floor(Date.now() / 1000);
  do {
    const page = await docClient.send(
      new ScanCommand({
        TableName: requireEnv('TABLE_NAME'),
        FilterExpression:
          '#type = :type AND #status = :pending AND expiresAt <= :now',
        ExpressionAttributeNames: { '#type': 'type', '#status': 'status' },
        ExpressionAttributeValues: {
          ':type': 'REGISTRATION',
          ':pending': 'email_verification_pending',
          ':now': now,
        },
        ExclusiveStartKey,
      })
    );
    for (const registration of (page.Items ?? []) as RegistrationRecord[]) {
      inspected += 1;
      try {
        const user = await getCognitoUser(registration.email);
        if (user.UserStatus === 'CONFIRMED') {
          await materializeConfirmedRegistration(registration);
          completed += 1;
          continue;
        }
        if (user.UserStatus === 'UNCONFIRMED') {
          await cognitoClient.send(
            new AdminDeleteUserCommand({
              UserPoolId: requireEnv('COGNITO_USER_POOL_ID'),
              Username: user.Username!,
            })
          );
        }
      } catch (error: any) {
        if (error?.name !== 'UserNotFoundException') throw error;
      }
      await docClient.send(
        new DeleteCommand({
          TableName: requireEnv('TABLE_NAME'),
          Key: registrationKey(registration.registrationId),
        })
      );
      deleted += 1;
    }
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return { inspected, deleted, completed };
}
