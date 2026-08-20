import { logAudit } from '../helpers/auditLogger';
import type { Role } from '../helpers/assertRole';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../helpers/errors';
import type { CommerceProfile } from '../models/commerce';
import type {
  CommerceUserProfile,
  CreateManagedUserRequest,
  ManagedUser,
  ManagedUserStatus,
  UpdateManagedUserRequest,
} from '../models/user';
import {
  addUserToRole,
  createCognitoUser,
  deleteCognitoUser,
  disableCognitoUser,
  findCognitoUserBySub,
  findCognitoUsersByEmail,
  getCognitoUser,
  removeUserFromRole,
  replaceUserRole,
  resetCognitoPassword,
  updateCognitoNames,
  type CognitoUserSnapshot,
} from '../repositories/cognitoUserRepository';
import {
  createUserProfile,
  deleteUserProfile,
  getBillingProfile,
  getCommerceProfile,
  getUserProfile,
  listUserProfiles,
  putUserProfile,
  userKey,
} from '../repositories/userRepository';

export interface UserActor {
  sub: string;
  email: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function cleanName(name: string): string {
  return name
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function tableName(): string {
  const value = process.env.TABLE_NAME;
  if (!value) throw new Error('TABLE_NAME env var is required');
  return value;
}

function statusFor(user: CognitoUserSnapshot): ManagedUserStatus {
  if (user.status === 'FORCE_CHANGE_PASSWORD') return 'invited';
  if (user.status === 'RESET_REQUIRED') return 'password_reset_required';
  return 'active';
}

function toManagedUser(
  profile: CommerceUserProfile,
  cognito: CognitoUserSnapshot,
  ownerCognitoSub: string
): ManagedUser {
  const firstName = cognito.firstName || profile.firstName;
  const lastName = cognito.lastName || profile.lastName;
  return {
    userId: profile.cognitoSub,
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' ') || profile.email,
    email: cognito.email || profile.email,
    emailVerified: cognito.emailVerified,
    role: cognito.role ?? profile.role,
    status: statusFor(cognito),
    isOwner: profile.cognitoSub === ownerCognitoSub,
  };
}

async function requireCommerce(commerceId: string): Promise<CommerceProfile> {
  const commerce = await getCommerceProfile(commerceId);
  if (!commerce) throw new NotFoundError('Comercio no encontrado');
  return commerce;
}

async function legacyOwnerProfile(
  commerce: CommerceProfile
): Promise<CommerceUserProfile> {
  const cognito = await findCognitoUserBySub(commerce.ownerCognitoSub);
  if (!cognito)
    throw new NotFoundError('No se encontró al creador del comercio');
  return {
    ...userKey(commerce.commerceId, commerce.ownerCognitoSub),
    type: 'COMMERCE_USER',
    commerceId: commerce.commerceId,
    cognitoSub: commerce.ownerCognitoSub,
    cognitoUsername: cognito.username,
    email: normalizeEmail(cognito.email || commerce.ownerEmail),
    firstName: cognito.firstName || cognito.username,
    lastName: cognito.lastName,
    role: 'admin',
    createdAt: commerce.createdAt,
    updatedAt: commerce.updatedAt,
  };
}

async function allProfiles(
  commerce: CommerceProfile
): Promise<CommerceUserProfile[]> {
  const profiles = await listUserProfiles(commerce.commerceId);
  if (
    !profiles.some(profile => profile.cognitoSub === commerce.ownerCognitoSub)
  ) {
    profiles.unshift(await legacyOwnerProfile(commerce));
  }
  return profiles;
}

async function requireTarget(
  commerce: CommerceProfile,
  userId: string
): Promise<CommerceUserProfile> {
  const profile = await getUserProfile(commerce.commerceId, userId);
  if (profile) return profile;
  if (userId === commerce.ownerCognitoSub) return legacyOwnerProfile(commerce);
  throw new NotFoundError('Usuario no encontrado');
}

async function assertAnotherEnabledAdmin(
  commerce: CommerceProfile,
  targetSub: string
): Promise<void> {
  const profiles = await allProfiles(commerce);
  let enabledAdmins = 0;
  for (const profile of profiles) {
    if (profile.role !== 'admin') continue;
    try {
      const current = await getCognitoUser(profile.cognitoUsername);
      if (current.enabled && (current.role ?? profile.role) === 'admin')
        enabledAdmins += 1;
    } catch {
      // Missing Cognito users cannot keep a commerce administrable.
    }
  }
  const target = profiles.find(profile => profile.cognitoSub === targetSub);
  if (target?.role === 'admin' && enabledAdmins <= 1) {
    throw new ConflictError(
      'El comercio debe conservar al menos un administrador habilitado'
    );
  }
}

function audit(
  actor: UserActor,
  commerceId: string,
  action: Parameters<typeof logAudit>[4],
  details: Record<string, unknown>
) {
  return logAudit(
    tableName(),
    commerceId,
    actor.sub,
    actor.email,
    action,
    details
  );
}

export async function listManagedUsers(
  commerceId: string
): Promise<{ items: ManagedUser[] }> {
  const commerce = await requireCommerce(commerceId);
  const profiles = await allProfiles(commerce);
  const users = await Promise.all(
    profiles.map(async profile => {
      try {
        const cognito = await getCognitoUser(profile.cognitoUsername);
        return cognito.enabled
          ? toManagedUser(profile, cognito, commerce.ownerCognitoSub)
          : null;
      } catch {
        return null;
      }
    })
  );
  return {
    items: users
      .filter((user): user is ManagedUser => user !== null)
      .sort((left, right) => left.fullName.localeCompare(right.fullName, 'es')),
  };
}

export async function createManagedUser(
  commerceId: string,
  actor: UserActor,
  input: CreateManagedUserRequest
): Promise<ManagedUser> {
  const commerce = await requireCommerce(commerceId);
  const email = normalizeEmail(input.email);
  const firstName = cleanName(input.firstName);
  const lastName = cleanName(input.lastName);
  if ((await findCognitoUsersByEmail(email)).length > 0) {
    throw new ConflictError('Ya existe una cuenta para ese email');
  }
  const billing = await getBillingProfile(commerceId);
  let created: CognitoUserSnapshot | null = null;
  let profileCreated = false;
  try {
    created = await createCognitoUser({
      email,
      firstName,
      lastName,
      commerceId,
      accountStatus: billing?.status ?? 'active',
    });
    await addUserToRole(created.username, input.role);
    const now = new Date().toISOString();
    const profile: CommerceUserProfile = {
      ...userKey(commerceId, created.sub),
      type: 'COMMERCE_USER',
      commerceId,
      cognitoSub: created.sub,
      cognitoUsername: created.username,
      email,
      firstName,
      lastName,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    };
    await createUserProfile(profile);
    profileCreated = true;
    const current = await getCognitoUser(created.username);
    await audit(actor, commerceId, 'USER_CREATE', {
      targetUserId: created.sub,
      targetEmail: email,
      role: input.role,
    });
    return toManagedUser(profile, current, commerce.ownerCognitoSub);
  } catch (error) {
    if (created) {
      if (profileCreated) {
        await deleteUserProfile(commerceId, created.sub).catch(
          rollbackError => {
            console.error('Failed to compensate incomplete user profile', {
              userId: created?.sub,
              error:
                rollbackError instanceof Error ? rollbackError.name : 'unknown',
            });
          }
        );
      }
      await removeUserFromRole(created.username, input.role).catch(
        () => undefined
      );
      await deleteCognitoUser(created.username).catch(rollbackError => {
        console.error('Failed to compensate incomplete Cognito user creation', {
          username: created?.username,
          error:
            rollbackError instanceof Error ? rollbackError.name : 'unknown',
        });
      });
    }
    if ((error as { name?: string }).name === 'UsernameExistsException') {
      throw new ConflictError('Ya existe una cuenta para ese email');
    }
    throw error;
  }
}

export async function updateManagedUser(
  commerceId: string,
  userId: string,
  actor: UserActor,
  input: UpdateManagedUserRequest
): Promise<ManagedUser> {
  const commerce = await requireCommerce(commerceId);
  const profile = await requireTarget(commerce, userId);
  if (userId === commerce.ownerCognitoSub) {
    throw new ForbiddenError('El creador del comercio no puede ser modificado');
  }
  const previousCognito = await getCognitoUser(profile.cognitoUsername);
  const previousRole = previousCognito.role ?? profile.role;
  if (previousRole === 'admin' && input.role === 'vendedor') {
    await assertAnotherEnabledAdmin(commerce, userId);
  }
  const firstName = cleanName(input.firstName);
  const lastName = cleanName(input.lastName);
  let namesUpdated = false;
  let roleUpdated = false;
  try {
    await updateCognitoNames(profile.cognitoUsername, firstName, lastName);
    namesUpdated = true;
    if (previousRole !== input.role) {
      await replaceUserRole(profile.cognitoUsername, previousRole, input.role);
      roleUpdated = true;
    }
    const updated: CommerceUserProfile = {
      ...profile,
      firstName,
      lastName,
      role: input.role,
      updatedAt: new Date().toISOString(),
    };
    await putUserProfile(updated);
    const current = await getCognitoUser(profile.cognitoUsername);
    await audit(actor, commerceId, 'USER_UPDATE', {
      targetUserId: userId,
      targetEmail: profile.email,
      changes: {
        firstName: { old: profile.firstName, new: firstName },
        lastName: { old: profile.lastName, new: lastName },
        role: { old: previousRole, new: input.role },
      },
    });
    return toManagedUser(updated, current, commerce.ownerCognitoSub);
  } catch (error) {
    if (roleUpdated) {
      await replaceUserRole(
        profile.cognitoUsername,
        input.role,
        previousRole
      ).catch(() => undefined);
    }
    if (namesUpdated) {
      await updateCognitoNames(
        profile.cognitoUsername,
        previousCognito.firstName || profile.firstName,
        previousCognito.lastName || profile.lastName
      ).catch(() => undefined);
    }
    throw error;
  }
}

export async function resetManagedUserPassword(
  commerceId: string,
  userId: string,
  actor: UserActor
): Promise<{ message: string }> {
  const commerce = await requireCommerce(commerceId);
  const profile = await requireTarget(commerce, userId);
  if (userId === commerce.ownerCognitoSub && actor.sub !== userId) {
    throw new ForbiddenError(
      'Solo el creador puede restablecer su propia contraseña'
    );
  }
  const cognito = await getCognitoUser(profile.cognitoUsername);
  if (!cognito.emailVerified) {
    throw new ConflictError(
      'El usuario debe tener un email verificado para restablecer su contraseña'
    );
  }
  if (cognito.status === 'FORCE_CHANGE_PASSWORD') {
    throw new ConflictError(
      'El usuario debe completar primero la invitación con su contraseña temporal'
    );
  }
  await resetCognitoPassword(profile.cognitoUsername);
  await audit(actor, commerceId, 'USER_PASSWORD_RESET', {
    targetUserId: userId,
    targetEmail: profile.email,
  });
  return {
    message:
      'Cognito envió un código. El usuario debe completar Restablecer contraseña desde el acceso.',
  };
}

export async function disableManagedUser(
  commerceId: string,
  userId: string,
  actor: UserActor
): Promise<{ message: string }> {
  const commerce = await requireCommerce(commerceId);
  const profile = await requireTarget(commerce, userId);
  if (userId === commerce.ownerCognitoSub) {
    throw new ForbiddenError('El creador del comercio no puede ser eliminado');
  }
  const cognito = await getCognitoUser(profile.cognitoUsername);
  if ((cognito.role ?? profile.role) === 'admin') {
    await assertAnotherEnabledAdmin(commerce, userId);
  }
  await disableCognitoUser(profile.cognitoUsername);
  await audit(actor, commerceId, 'USER_DISABLE', {
    targetUserId: userId,
    targetEmail: profile.email,
    role: cognito.role ?? profile.role,
  });
  return { message: 'Usuario deshabilitado correctamente' };
}

export function validateRole(value: unknown): Role {
  if (value !== 'admin' && value !== 'vendedor')
    throw new BadRequestError('Rol inválido');
  return value;
}

export function validateName(value: unknown, field: string): string {
  if (typeof value !== 'string')
    throw new BadRequestError(`${field} es obligatorio`);
  const cleaned = cleanName(value);
  if (cleaned.length < 2 || cleaned.length > 80) {
    throw new BadRequestError(`${field} debe tener entre 2 y 80 caracteres`);
  }
  return cleaned;
}

export function validateEmail(value: unknown): string {
  if (typeof value !== 'string')
    throw new BadRequestError('Email es obligatorio');
  const email = normalizeEmail(value);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestError('Email inválido');
  }
  return email;
}
