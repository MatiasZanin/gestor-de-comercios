const mockAssertCommerceAccess = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../src/helpers/assertCommerceAccess', () => ({
  assertCommerceAccess: (...args: unknown[]) =>
    mockAssertCommerceAccess(...args),
}));
jest.mock('../src/services/userManagementUseCase', () => ({
  ...jest.requireActual('../src/services/userManagementUseCase'),
  createManagedUser: (...args: unknown[]) => mockCreate(...args),
  updateManagedUser: (...args: unknown[]) => mockUpdate(...args),
  listManagedUsers: jest.fn(),
  resetManagedUserPassword: jest.fn(),
  disableManagedUser: jest.fn(),
}));

import { handler as createHandler } from '../src/handlers/createUser';
import { handler as updateHandler } from '../src/handlers/updateUser';

function event(role: 'admin' | 'vendedor', body: Record<string, unknown>) {
  return {
    pathParameters: { commerceId: 'commerce-1', userId: 'target-sub' },
    body: JSON.stringify(body),
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub: 'actor',
            email: 'actor@example.com',
            'cognito:groups': [role],
          },
        },
      },
    },
  } as never;
}

describe('user handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssertCommerceAccess.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue({ userId: 'new' });
    mockUpdate.mockResolvedValue({ userId: 'target-sub' });
  });

  it('rejects vendors before executing a user operation', async () => {
    const response = (await createHandler(
      event('vendedor', {
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        role: 'vendedor',
      })
    )) as { statusCode: number };
    expect(response.statusCode).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects invalid roles', async () => {
    const response = (await createHandler(
      event('admin', {
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        role: 'superadmin',
      })
    )) as { statusCode: number };
    expect(response.statusCode).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects every attempt to update email', async () => {
    const response = (await updateHandler(
      event('admin', {
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'new@example.com',
        role: 'admin',
      })
    )) as { statusCode: number };
    expect(response.statusCode).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
