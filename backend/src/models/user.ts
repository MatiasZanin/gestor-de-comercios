import type { Role } from '../helpers/assertRole';

export interface CommerceUserProfile {
  PK: string;
  SK: `USER#${string}`;
  type: 'COMMERCE_USER';
  commerceId: string;
  cognitoSub: string;
  cognitoUsername: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export type ManagedUserStatus =
  | 'active'
  | 'invited'
  | 'password_reset_required';

export interface ManagedUser {
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  status: ManagedUserStatus;
  isOwner: boolean;
}

export interface CreateManagedUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

export interface UpdateManagedUserRequest {
  firstName: string;
  lastName: string;
  role: Role;
}
