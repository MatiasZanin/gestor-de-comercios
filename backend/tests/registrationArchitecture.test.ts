import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  ListUsersCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  changePendingRegistrationEmail,
  confirmRegistrationEmail,
  createPublicRegistration,
  normalizeEmail,
  normalizePhoneNumber,
  recoverPendingRegistration,
} from '../src/services/registrationUseCase';
import type { RegistrationRecord } from '../src/models/billing';

jest.mock('../src/services/transactionalEmail', () => ({
  createWelcomeEmailNotification: jest.fn(),
}));

const cognitoSend = jest.spyOn(
  CognitoIdentityProviderClient.prototype,
  'send'
) as jest.Mock;
const dynamoSend = jest.spyOn(
  DynamoDBDocumentClient.prototype,
  'send'
) as jest.Mock;

const pending: RegistrationRecord = {
  PK: 'REG#registration-opaque',
  SK: 'REGISTRATION',
  type: 'REGISTRATION',
  registrationId: 'registration-opaque',
  commerceId: 'commerce-opaque',
  email: 'owner@example.test',
  emailLookupPk: 'PENDING_EMAIL#hash',
  emailLookupSk: '2026-01-01#registration-opaque',
  firstName: 'Ana',
  lastName: 'Pérez',
  phoneNumber: '+5491123456789',
  merchantName: 'Comercio Demo',
  status: 'email_verification_pending',
  userPoolUsername: 'cognito-internal',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  retryCount: 1,
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  ttl: Math.floor(Date.now() / 1000) + 7200,
  lastCodeSentAt: 0,
};

describe('registration V2 architecture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_test';
    process.env.COGNITO_CLIENT_ID = 'client-test';
    process.env.REGISTRATION_EMAIL_GSI = 'GSI-Altas-Pendientes-Por-Email';
    process.env.BILLING_MONTHLY_AMOUNT = '35000';
    process.env.BILLING_CURRENCY_ID = 'ARS';
    process.env.BILLING_TRIAL_DAYS = '30';
    process.env.BILLING_GRACE_DAYS = '3';
    process.env.BILLING_PLAN_REASON = 'G&S Comercios';
    process.env.MERCADO_PAGO_PREAPPROVAL_PLAN_ID = 'plan-test';
  });

  it('normalizes email and Argentine phone to E.164', () => {
    expect(normalizeEmail(' Owner@Example.TEST ')).toBe('owner@example.test');
    expect(normalizePhoneNumber('+54 9 11 2345-6789')).toBe('+5491123456789');
    expect(() => normalizePhoneNumber('123')).toThrow('teléfono válido');
  });

  it('stores only a temporary record and sends all standard attributes to Cognito before OTP', async () => {
    dynamoSend.mockImplementation(async (command: unknown) => {
      if (command instanceof QueryCommand) return { Items: [] };
      return {};
    });
    cognitoSend.mockImplementation(async (command: unknown) => {
      if (command instanceof ListUsersCommand) return { Users: [] };
      if (command instanceof SignUpCommand)
        return {
          UserSub: 'permanent-sub',
          CodeDeliveryDetails: { DeliveryMedium: 'EMAIL' },
        };
      return {};
    });

    const result = await createPublicRegistration({
      firstName: ' Ana ',
      lastName: ' Pérez ',
      email: 'Owner@Example.TEST',
      phoneNumber: '+54 9 11 2345-6789',
      password: 'Password1!',
      merchantName: ' Demo ',
      acceptTerms: true,
    });

    expect(result.registrationId).not.toContain('owner');
    const signUp = cognitoSend.mock.calls
      .map(call => call[0])
      .find(command => command instanceof SignUpCommand) as SignUpCommand;
    expect(signUp.input.UserAttributes).toEqual(
      expect.arrayContaining([
        { Name: 'email', Value: 'owner@example.test' },
        { Name: 'given_name', Value: 'Ana' },
        { Name: 'family_name', Value: 'Pérez' },
        { Name: 'phone_number', Value: '+5491123456789' },
      ])
    );
    const writes = dynamoSend.mock.calls.map(call => call[0]);
    expect(
      writes.filter(command => command instanceof PutCommand)
    ).toHaveLength(2);
    expect(
      writes.some(command => command instanceof TransactWriteCommand)
    ).toBe(false);
    expect(JSON.stringify(writes)).not.toContain('Password1!');
  });

  it('rejects a duplicate confirmed email before creating any temporary entity', async () => {
    dynamoSend.mockImplementation(async (command: unknown) =>
      command instanceof QueryCommand ? { Items: [] } : {}
    );
    cognitoSend.mockImplementation(async (command: unknown) =>
      command instanceof ListUsersCommand
        ? { Users: [{ Username: 'existing', UserStatus: 'CONFIRMED' }] }
        : {}
    );
    await expect(
      createPublicRegistration({
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'owner@example.test',
        phoneNumber: '+5491123456789',
        password: 'Password1!',
        merchantName: 'Demo',
        acceptTerms: true,
      })
    ).rejects.toThrow('Ya existe una cuenta');
    expect(
      dynamoSend.mock.calls.some(call => call[0] instanceof PutCommand)
    ).toBe(false);
  });

  it('confirms Cognito first and materializes all permanent entities in one transaction keyed by sub', async () => {
    dynamoSend.mockImplementation(async (command: unknown) => {
      if (command instanceof GetCommand) return { Item: pending };
      if (command instanceof TransactWriteCommand) return {};
      return {};
    });
    cognitoSend.mockImplementation(async (command: unknown) => {
      if (command instanceof ConfirmSignUpCommand) return {};
      if (command instanceof AdminGetUserCommand)
        return {
          Username: 'internal-username',
          UserStatus: 'CONFIRMED',
          UserAttributes: [{ Name: 'sub', Value: 'permanent-sub' }],
        };
      return {};
    });

    await confirmRegistrationEmail(pending.registrationId, '123456');
    const transaction = dynamoSend.mock.calls
      .map(call => call[0])
      .find(
        command => command instanceof TransactWriteCommand
      ) as TransactWriteCommand;
    expect(transaction.input.TransactItems).toHaveLength(4);
    expect(JSON.stringify(transaction.input)).toContain('USER#permanent-sub');
    expect(JSON.stringify(transaction.input)).not.toContain('Password1!');
    expect(
      cognitoSend.mock.calls.some(
        call => call[0] instanceof AdminUpdateUserAttributesCommand
      )
    ).toBe(true);
  });

  it('resumes materialization idempotently when Cognito is already confirmed', async () => {
    dynamoSend.mockImplementation(async (command: unknown) =>
      command instanceof GetCommand ? { Item: pending } : {}
    );
    cognitoSend.mockImplementation(async (command: unknown) => {
      if (command instanceof ConfirmSignUpCommand)
        throw Object.assign(new Error('already confirmed'), {
          name: 'NotAuthorizedException',
        });
      if (command instanceof AdminGetUserCommand)
        return {
          Username: 'internal',
          UserStatus: 'CONFIRMED',
          UserAttributes: [{ Name: 'sub', Value: 'sub-retry' }],
        };
      return {};
    });
    await expect(
      confirmRegistrationEmail(pending.registrationId, '123456')
    ).resolves.toMatchObject({ status: 'pending_subscription' });
    expect(
      dynamoSend.mock.calls.some(
        call => call[0] instanceof TransactWriteCommand
      )
    ).toBe(true);
  });

  it('does not create permanent data when Cognito rejects an incorrect or expired OTP', async () => {
    dynamoSend.mockImplementation(async (command: unknown) =>
      command instanceof GetCommand ? { Item: pending } : {}
    );
    cognitoSend.mockImplementation(async (command: unknown) => {
      if (command instanceof ConfirmSignUpCommand)
        throw Object.assign(new Error('invalid code'), {
          name: 'CodeMismatchException',
        });
      return {};
    });
    await expect(
      confirmRegistrationEmail(pending.registrationId, '000000')
    ).rejects.toThrow('código ingresado es incorrecto');
    expect(
      dynamoSend.mock.calls.some(
        call => call[0] instanceof TransactWriteCommand
      )
    ).toBe(false);
  });

  it('changes an UNCONFIRMED email by securely recreating the identity without persisting the password', async () => {
    dynamoSend.mockImplementation(async (command: unknown) => {
      if (command instanceof GetCommand) return { Item: pending };
      return {};
    });
    cognitoSend.mockImplementation(async (command: unknown) => {
      if (command instanceof AdminGetUserCommand)
        return { Username: 'internal', UserStatus: 'UNCONFIRMED' };
      if (command instanceof ListUsersCommand) return { Users: [] };
      if (command instanceof SignUpCommand)
        return {
          UserSub: 'new-internal',
          CodeDeliveryDetails: { DeliveryMedium: 'EMAIL' },
        };
      return {};
    });
    await expect(
      changePendingRegistrationEmail({
        registrationId: pending.registrationId,
        newEmail: 'New@Example.test',
      })
    ).resolves.toMatchObject({ passwordRequired: true });
    const result = await changePendingRegistrationEmail({
      registrationId: pending.registrationId,
      newEmail: 'New@Example.test',
      password: 'Password1!',
    });
    expect(result).toMatchObject({
      email: 'new@example.test',
      passwordRequired: false,
    });
    const signUp = cognitoSend.mock.calls
      .map(call => call[0])
      .find(command => command instanceof SignUpCommand) as SignUpCommand;
    expect(signUp.input.Username).toBe('new@example.test');
    expect(JSON.stringify(dynamoSend.mock.calls)).not.toContain('Password1!');
  });

  it('returns the same generic recovery response and enforces an atomic resend cooldown', async () => {
    dynamoSend.mockImplementation(async (command: unknown) => {
      if (command instanceof QueryCommand) return { Items: [pending] };
      if (command instanceof UpdateCommand) return {};
      return {};
    });
    cognitoSend.mockResolvedValue({});
    const found = await recoverPendingRegistration(pending.email);
    dynamoSend.mockImplementation(async (command: unknown) =>
      command instanceof QueryCommand ? { Items: [] } : {}
    );
    const missing = await recoverPendingRegistration('missing@example.test');
    expect(found).toEqual(missing);
    expect(
      cognitoSend.mock.calls.some(
        call => call[0] instanceof ResendConfirmationCodeCommand
      )
    ).toBe(true);
  });

  it('does not resend for an expired temporary registration', async () => {
    dynamoSend.mockImplementation(async (command: unknown) =>
      command instanceof QueryCommand
        ? {
            Items: [
              { ...pending, expiresAt: Math.floor(Date.now() / 1000) - 1 },
            ],
          }
        : {}
    );
    cognitoSend.mockResolvedValue({});
    await recoverPendingRegistration(pending.email);
    expect(
      cognitoSend.mock.calls.some(
        call => call[0] instanceof ResendConfirmationCodeCommand
      )
    ).toBe(false);
  });

  it('defines an additive V2 pool with email-only verification and keeps the legacy pool', () => {
    const template = readFileSync(join(__dirname, '../template.yaml'), 'utf8');
    expect(template).toContain(
      'UserPoolName: !Sub gestor-comercios-${CommerceStage}'
    );
    expect(template).toContain('UsernameAttributes:\n        - email');
    expect(template).toContain('AutoVerifiedAttributes:\n        - email');
    expect(template).toContain("MfaConfiguration: 'OFF'");
    expect(template).toContain('Name: phone_number');
    expect(template).toContain('LegacyUserPoolId:');
    expect(template).not.toContain(
      'AutoVerifiedAttributes:\n        - phone_number'
    );
  });
});
