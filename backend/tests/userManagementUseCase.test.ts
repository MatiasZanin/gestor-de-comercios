const userRepo = {
  createUserProfile: jest.fn(),
  deleteUserProfile: jest.fn(),
  getBillingProfile: jest.fn(),
  getCommerceProfile: jest.fn(),
  getUserProfile: jest.fn(),
  listUserProfiles: jest.fn(),
  putUserProfile: jest.fn(),
  userKey: (commerceId: string, sub: string) => ({
    PK: `COM#${commerceId}`,
    SK: `USER#${sub}`,
  }),
};

const cognitoRepo = {
  addUserToRole: jest.fn(),
  createCognitoUser: jest.fn(),
  deleteCognitoUser: jest.fn(),
  disableCognitoUser: jest.fn(),
  findCognitoUserBySub: jest.fn(),
  findCognitoUsersByEmail: jest.fn(),
  getCognitoUser: jest.fn(),
  removeUserFromRole: jest.fn(),
  replaceUserRole: jest.fn(),
  resetCognitoPassword: jest.fn(),
  updateCognitoNames: jest.fn(),
};

const mockLogAudit = jest.fn();

jest.mock('../src/repositories/userRepository', () => userRepo);
jest.mock('../src/repositories/cognitoUserRepository', () => cognitoRepo);
jest.mock('../src/helpers/auditLogger', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

import {
  createManagedUser,
  disableManagedUser,
  resetManagedUserPassword,
  updateManagedUser,
} from '../src/services/userManagementUseCase';

const commerce = {
  PK: 'COM#commerce-1',
  SK: 'PROFILE',
  type: 'COMMERCE',
  commerceId: 'commerce-1',
  merchantName: 'Demo',
  ownerCognitoSub: 'owner-sub',
  ownerEmail: 'owner@example.com',
  scaleBarcodeConfig: { valueType: 'weight', unit: 'kg', decimals: 3 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const ownerProfile = {
  PK: 'COM#commerce-1',
  SK: 'USER#owner-sub',
  type: 'COMMERCE_USER',
  commerceId: 'commerce-1',
  cognitoSub: 'owner-sub',
  cognitoUsername: 'owner',
  email: 'owner@example.com',
  firstName: 'Owner',
  lastName: 'Demo',
  role: 'admin',
  createdAt: commerce.createdAt,
  updatedAt: commerce.updatedAt,
};
const targetProfile = {
  ...ownerProfile,
  SK: 'USER#target-sub',
  cognitoSub: 'target-sub',
  cognitoUsername: 'target@example.com',
  email: 'target@example.com',
  firstName: 'Target',
  lastName: 'User',
  role: 'vendedor',
};
const actor = { sub: 'owner-sub', email: 'owner@example.com' };

function cognito(overrides: Record<string, unknown> = {}) {
  return {
    username: 'target@example.com',
    sub: 'target-sub',
    email: 'target@example.com',
    firstName: 'Target',
    lastName: 'User',
    emailVerified: true,
    enabled: true,
    status: 'CONFIRMED',
    role: 'vendedor',
    ...overrides,
  };
}

describe('user management use case', () => {
  beforeEach(() => {
    process.env.TABLE_NAME = 'table';
    jest.clearAllMocks();
    userRepo.getCommerceProfile.mockResolvedValue(commerce);
    userRepo.getBillingProfile.mockResolvedValue({ status: 'active' });
    userRepo.listUserProfiles.mockResolvedValue([ownerProfile, targetProfile]);
    userRepo.getUserProfile.mockResolvedValue(targetProfile);
    userRepo.createUserProfile.mockResolvedValue(undefined);
    userRepo.deleteUserProfile.mockResolvedValue(undefined);
    userRepo.putUserProfile.mockResolvedValue(undefined);
    cognitoRepo.findCognitoUsersByEmail.mockResolvedValue([]);
    cognitoRepo.createCognitoUser.mockResolvedValue(cognito());
    cognitoRepo.getCognitoUser.mockResolvedValue(cognito());
    cognitoRepo.addUserToRole.mockResolvedValue(undefined);
    cognitoRepo.deleteCognitoUser.mockResolvedValue(undefined);
    cognitoRepo.removeUserFromRole.mockResolvedValue(undefined);
    cognitoRepo.updateCognitoNames.mockResolvedValue(undefined);
    cognitoRepo.replaceUserRole.mockResolvedValue(undefined);
    cognitoRepo.resetCognitoPassword.mockResolvedValue(undefined);
    cognitoRepo.disableCognitoUser.mockResolvedValue(undefined);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it('creates a normalized user in Cognito, its group and DynamoDB', async () => {
    const result = await createManagedUser('commerce-1', actor, {
      firstName: '  Ana ',
      lastName: ' Pérez ',
      email: ' ANA@Example.com ',
      role: 'admin',
    });
    expect(cognitoRepo.createCognitoUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ana@example.com',
        commerceId: 'commerce-1',
        accountStatus: 'active',
      })
    );
    expect(cognitoRepo.addUserToRole).toHaveBeenCalledWith(
      'target@example.com',
      'admin'
    );
    expect(userRepo.createUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        commerceId: 'commerce-1',
        email: 'ana@example.com',
        role: 'admin',
      })
    );
    expect(result.userId).toBe('target-sub');
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.any(String),
      'commerce-1',
      actor.sub,
      actor.email,
      'USER_CREATE',
      expect.any(Object)
    );
  });

  it('rejects an existing email before creating anything', async () => {
    cognitoRepo.findCognitoUsersByEmail.mockResolvedValue([cognito()]);
    await expect(
      createManagedUser('commerce-1', actor, {
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        role: 'vendedor',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(cognitoRepo.createCognitoUser).not.toHaveBeenCalled();
  });

  it('deletes the uncommitted Cognito identity when DynamoDB creation fails', async () => {
    userRepo.createUserProfile.mockRejectedValue(new Error('dynamo failed'));
    await expect(
      createManagedUser('commerce-1', actor, {
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        role: 'vendedor',
      })
    ).rejects.toThrow('dynamo failed');
    expect(cognitoRepo.deleteCognitoUser).toHaveBeenCalledWith(
      'target@example.com'
    );
    expect(cognitoRepo.removeUserFromRole).toHaveBeenCalledWith(
      'target@example.com',
      'vendedor'
    );
    expect(userRepo.deleteUserProfile).not.toHaveBeenCalled();
  });

  it('removes the profile, group and identity when a post-write stage fails', async () => {
    mockLogAudit.mockRejectedValue(new Error('audit failed'));
    await expect(
      createManagedUser('commerce-1', actor, {
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        role: 'admin',
      })
    ).rejects.toThrow('audit failed');
    expect(userRepo.deleteUserProfile).toHaveBeenCalledWith(
      'commerce-1',
      'target-sub'
    );
    expect(cognitoRepo.removeUserFromRole).toHaveBeenCalledWith(
      'target@example.com',
      'admin'
    );
    expect(cognitoRepo.deleteCognitoUser).toHaveBeenCalledWith(
      'target@example.com'
    );
  });

  it('never allows editing or disabling the commerce owner', async () => {
    userRepo.getUserProfile.mockResolvedValue(ownerProfile);
    await expect(
      updateManagedUser('commerce-1', 'owner-sub', actor, {
        firstName: 'Owner',
        lastName: 'Demo',
        role: 'admin',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      disableManagedUser('commerce-1', 'owner-sub', actor)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(cognitoRepo.disableCognitoUser).not.toHaveBeenCalled();
  });

  it('only lets the owner reset their own password', async () => {
    userRepo.getUserProfile.mockResolvedValue(ownerProfile);
    cognitoRepo.getCognitoUser.mockResolvedValue(
      cognito({ username: 'owner', sub: 'owner-sub' })
    );
    await expect(
      resetManagedUserPassword('commerce-1', 'owner-sub', {
        sub: 'other-admin',
        email: 'other@example.com',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      resetManagedUserPassword('commerce-1', 'owner-sub', actor)
    ).resolves.toMatchObject({ message: expect.any(String) });
    expect(cognitoRepo.resetCognitoPassword).toHaveBeenCalledWith('owner');
  });

  it('does not reset a password while the initial invitation is pending', async () => {
    cognitoRepo.getCognitoUser.mockResolvedValue(
      cognito({ status: 'FORCE_CHANGE_PASSWORD' })
    );
    await expect(
      resetManagedUserPassword('commerce-1', 'target-sub', actor)
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(cognitoRepo.resetCognitoPassword).not.toHaveBeenCalled();
  });

  it('updates names and role in both stores', async () => {
    const result = await updateManagedUser('commerce-1', 'target-sub', actor, {
      firstName: 'Nuevo',
      lastName: 'Nombre',
      role: 'admin',
    });
    expect(cognitoRepo.updateCognitoNames).toHaveBeenCalledWith(
      'target@example.com',
      'Nuevo',
      'Nombre'
    );
    expect(cognitoRepo.replaceUserRole).toHaveBeenCalledWith(
      'target@example.com',
      'vendedor',
      'admin'
    );
    expect(userRepo.putUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin' })
    );
    expect(result.role).toBe('vendedor');
  });

  it('disables Cognito without modifying the DynamoDB user profile', async () => {
    await disableManagedUser('commerce-1', 'target-sub', actor);
    expect(cognitoRepo.disableCognitoUser).toHaveBeenCalledWith(
      'target@example.com'
    );
    expect(userRepo.putUserProfile).not.toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.any(String),
      'commerce-1',
      actor.sub,
      actor.email,
      'USER_DISABLE',
      expect.any(Object)
    );
  });

  it('protects the last enabled administrator', async () => {
    const soleAdmin = { ...targetProfile, role: 'admin' };
    userRepo.getUserProfile.mockResolvedValue(soleAdmin);
    userRepo.listUserProfiles.mockResolvedValue([soleAdmin]);
    cognitoRepo.findCognitoUserBySub.mockResolvedValue(
      cognito({
        username: 'owner',
        sub: 'owner-sub',
        enabled: false,
        role: 'admin',
      })
    );
    cognitoRepo.getCognitoUser.mockImplementation(async (username: string) =>
      username === 'owner'
        ? cognito({
            username: 'owner',
            sub: 'owner-sub',
            enabled: false,
            role: 'admin',
          })
        : cognito({ role: 'admin' })
    );
    await expect(
      disableManagedUser('commerce-1', 'target-sub', actor)
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(cognitoRepo.disableCognitoUser).not.toHaveBeenCalled();
  });
});
