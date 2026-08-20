import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda"
import { getCommerceProfile } from "../repositories/userRepository"
import { assertCommerceAccess } from "./assertCommerceAccess"
import { ForbiddenError, NotFoundError } from "./errors"

export async function assertCommerceOwner(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  commerceId: string,
): Promise<void> {
  await assertCommerceAccess(event, commerceId, { requireSubscription: false })
  const profile = await getCommerceProfile(commerceId)
  if (!profile) throw new NotFoundError("Commerce profile not found")

  const subject = event.requestContext?.authorizer?.jwt?.claims?.sub
  if (typeof subject !== "string" || subject !== profile.ownerCognitoSub) {
    throw new ForbiddenError("Only the commerce owner can manage the subscription")
  }
}

export function authenticatedSubject(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const subject = event.requestContext?.authorizer?.jwt?.claims?.sub
  return typeof subject === "string" ? subject : ""
}

export function authenticatedEmail(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const email = event.requestContext?.authorizer?.jwt?.claims?.email
  return typeof email === "string" ? email : ""
}
