import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb"
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda"
import { BILLING_STATUS, isIsoAfterOrEqual } from "../config/billing"
import type { BillingProfile } from "../models/billing"
import { ForbiddenError, PaymentRequiredError } from "./errors"

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

function values(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.map(String)
  if (typeof claim !== "string") return []
  return claim.replace(/[\[\]]/g, "").split(",").map((value) => value.trim()).filter(Boolean)
}

export function billingAllowsAccess(profile: BillingProfile, now = new Date().toISOString()): boolean {
  switch (profile.status) {
    case BILLING_STATUS.TRIAL:
    case BILLING_STATUS.ACTIVE:
      return true
    case BILLING_STATUS.PAST_DUE:
      return !!profile.graceUntil && isIsoAfterOrEqual(profile.graceUntil, now)
    case BILLING_STATUS.CANCELLED:
      return !!profile.currentPeriodEndsAt && isIsoAfterOrEqual(profile.currentPeriodEndsAt, now)
    default:
      return false
  }
}

export async function assertCommerceAccess(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  commerceId: string,
  options: { requireSubscription?: boolean } = {}
): Promise<void> {
  const claims = event.requestContext.authorizer?.jwt?.claims ?? {}
  const groups = values(claims["cognito:groups"])
  if (!groups.some((group) => group === "admin" || group === "vendedor")) {
    throw new ForbiddenError("User has no commerce role configured")
  }

  const commerceIds = values(claims["custom:commerceIds"])
  if (!commerceIds.includes(commerceId)) {
    throw new ForbiddenError(`Access denied to commerce ${commerceId}`)
  }

  if (options.requireSubscription === false) return
  const tableName = process.env.TABLE_NAME
  if (!tableName) throw new Error("TABLE_NAME env var is required")
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: `COM#${commerceId}`, SK: "BILLING#PROFILE" },
    })
  )
  const profile = (result.Item as BillingProfile | undefined) ?? null
  if (!profile) return // Existing commerces without billing remain enabled.
  if (!billingAllowsAccess(profile)) {
    throw new PaymentRequiredError()
  }
}
