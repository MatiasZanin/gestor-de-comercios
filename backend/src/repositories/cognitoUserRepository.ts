import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminResetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type AttributeType,
  type UserStatusType,
} from '@aws-sdk/client-cognito-identity-provider';
import type { Role } from '../helpers/assertRole';

const client = new CognitoIdentityProviderClient({});

function userPoolId(): string {
  const value = process.env.COGNITO_USER_POOL_ID;
  if (!value) throw new Error('COGNITO_USER_POOL_ID env var is required');
  return value;
}

export interface CognitoUserSnapshot {
  username: string;
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  enabled: boolean;
  status?: UserStatusType;
  role?: Role;
}

function value(attributes: AttributeType[] | undefined, name: string): string {
  return attributes?.find(attribute => attribute.Name === name)?.Value ?? '';
}

async function getRole(username: string): Promise<Role | undefined> {
  const result = await client.send(
    new AdminListGroupsForUserCommand({
      UserPoolId: userPoolId(),
      Username: username,
    })
  );
  const names = new Set((result.Groups ?? []).map(group => group.GroupName));
  if (names.has('admin')) return 'admin';
  if (names.has('vendedor')) return 'vendedor';
  return undefined;
}

export async function getCognitoUser(
  username: string
): Promise<CognitoUserSnapshot> {
  const result = await client.send(
    new AdminGetUserCommand({
      UserPoolId: userPoolId(),
      Username: username,
    })
  );
  return {
    username: result.Username ?? username,
    sub: value(result.UserAttributes, 'sub'),
    email: value(result.UserAttributes, 'email'),
    firstName: value(result.UserAttributes, 'given_name'),
    lastName: value(result.UserAttributes, 'family_name'),
    emailVerified: value(result.UserAttributes, 'email_verified') === 'true',
    enabled: result.Enabled !== false,
    status: result.UserStatus,
    role: await getRole(result.Username ?? username),
  };
}

export async function findCognitoUserBySub(
  sub: string
): Promise<CognitoUserSnapshot | null> {
  const escaped = sub.replace(/\\/g, '\\\\').replace(/\"/g, '\\"');
  const result = await client.send(
    new ListUsersCommand({
      UserPoolId: userPoolId(),
      Filter: `sub = "${escaped}"`,
      Limit: 1,
    })
  );
  const username = result.Users?.[0]?.Username;
  return username ? getCognitoUser(username) : null;
}

export async function findCognitoUsersByEmail(
  email: string
): Promise<CognitoUserSnapshot[]> {
  const escaped = email.replace(/\\/g, '\\\\').replace(/\"/g, '\\"');
  const result = await client.send(
    new ListUsersCommand({
      UserPoolId: userPoolId(),
      Filter: `email = "${escaped}"`,
      Limit: 2,
    })
  );
  return Promise.all(
    (result.Users ?? [])
      .filter(user => !!user.Username)
      .map(user => getCognitoUser(user.Username!))
  );
}

export async function createCognitoUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  commerceId: string;
  accountStatus: string;
}): Promise<CognitoUserSnapshot> {
  const result = await client.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId(),
      Username: input.email,
      DesiredDeliveryMediums: ['EMAIL'],
      ForceAliasCreation: false,
      UserAttributes: [
        { Name: 'email', Value: input.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: input.firstName },
        { Name: 'family_name', Value: input.lastName },
        { Name: 'custom:commerceIds', Value: input.commerceId },
        { Name: 'custom:accountStatus', Value: input.accountStatus },
      ],
    })
  );
  const username = result.User?.Username ?? input.email;
  return getCognitoUser(username);
}

export async function updateCognitoNames(
  username: string,
  firstName: string,
  lastName: string
): Promise<void> {
  await client.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId(),
      Username: username,
      UserAttributes: [
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName },
      ],
    })
  );
}

export async function addUserToRole(
  username: string,
  role: Role
): Promise<void> {
  await client.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId(),
      Username: username,
      GroupName: role,
    })
  );
}

export async function removeUserFromRole(
  username: string,
  role: Role
): Promise<void> {
  await client.send(
    new AdminRemoveUserFromGroupCommand({
      UserPoolId: userPoolId(),
      Username: username,
      GroupName: role,
    })
  );
}

export async function replaceUserRole(
  username: string,
  previousRole: Role,
  nextRole: Role
): Promise<void> {
  if (previousRole === nextRole) return;
  await addUserToRole(username, nextRole);
  try {
    await removeUserFromRole(username, previousRole);
  } catch (error) {
    await removeUserFromRole(username, nextRole).catch(() => undefined);
    throw error;
  }
}

export async function resetCognitoPassword(username: string): Promise<void> {
  await client.send(
    new AdminResetUserPasswordCommand({
      UserPoolId: userPoolId(),
      Username: username,
    })
  );
}

export async function disableCognitoUser(username: string): Promise<void> {
  await client.send(
    new AdminDisableUserCommand({
      UserPoolId: userPoolId(),
      Username: username,
    })
  );
}

export async function deleteCognitoUser(username: string): Promise<void> {
  await client.send(
    new AdminDeleteUserCommand({ UserPoolId: userPoolId(), Username: username })
  );
}
