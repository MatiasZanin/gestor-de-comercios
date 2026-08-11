import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb"
import {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerWithContextResult,
} from "aws-lambda"
import { BILLING_STATUS, isIsoAfterOrEqual, type BillingStatus } from "../config/billing"
import type { BillingProfile } from "../models/billing"

interface JwtPayload {
  [key: string]: any
}

const dynamoClient = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(dynamoClient)

function getTableName() {
  const tableName = process.env.TABLE_NAME
  if (!tableName) {
    throw new Error("TABLE_NAME env var is required")
  }
  return tableName
}

function billingKey(commerceId: string) {
  return { PK: `COM#${commerceId}`, SK: "BILLING#PROFILE" as const }
}

function isBillingRoute(path: string): boolean {
  const segments = path.split("/").filter(Boolean)
  return segments.length >= 2 && segments[1] === "billing"
}

function canAccessByBilling(profile: BillingProfile | null, nowIso: string): boolean {
  if (!profile) {
    return true
  }

  switch (profile.status) {
    case BILLING_STATUS.PENDING_SUBSCRIPTION:
      return false
    case BILLING_STATUS.TRIAL:
    case BILLING_STATUS.ACTIVE:
      return true
    case BILLING_STATUS.PAST_DUE:
      return !!profile.graceUntil && isIsoAfterOrEqual(profile.graceUntil, nowIso)
    case BILLING_STATUS.CANCELLED:
      return !!profile.currentPeriodEndsAt && isIsoAfterOrEqual(profile.currentPeriodEndsAt, nowIso)
    default:
      return true
  }
}

async function getBillingProfile(commerceId: string): Promise<BillingProfile | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: billingKey(commerceId),
    })
  )
  return (result.Item as BillingProfile | undefined) ?? null
}

export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2
): Promise<
  APIGatewaySimpleAuthorizerWithContextResult<{
    role: string
    commerceIds: string
    accountStatus: string
    billingStatus: string
    billingAccess: string
  } | null>
> => {
  try {
    const token = event.headers?.authorization || event.headers?.Authorization
    if (!token || !token.startsWith("Bearer ")) {
      return { isAuthorized: false, context: null }
    }

    const jwt = token.substring("Bearer ".length)
    const parts = jwt.split(".")
    if (parts.length < 2) {
      return { isAuthorized: false, context: null }
    }

    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8")) as JwtPayload
    const groups: string[] = Array.isArray(payload["cognito:groups"]) ? payload["cognito:groups"] : []
    const role = groups.includes("admin") ? "admin" : groups.includes("vendedor") ? "vendedor" : ""
    const commerceIdsString = typeof payload["custom:commerceIds"] === "string" ? payload["custom:commerceIds"] : ""
    const commerceIds = commerceIdsString
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
    const accountStatus = typeof payload["custom:accountStatus"] === "string" ? payload["custom:accountStatus"] : ""
    const path = event.requestContext?.http?.path || ""
    const segments = path.split("/").filter(Boolean)
    const commerceId = segments[0]

    if (!role || !commerceId || !commerceIds.includes(commerceId)) {
      return {
        isAuthorized: false,
        context: {
          role,
          commerceIds: commerceIds.join(","),
          accountStatus,
          billingStatus: accountStatus,
          billingAccess: "denied",
        },
      }
    }

    if (isBillingRoute(path)) {
      return {
        isAuthorized: true,
        context: {
          role,
          commerceIds: commerceIds.join(","),
          accountStatus,
          billingStatus: accountStatus,
          billingAccess: "billing_route",
        },
      }
    }

    const billingProfile = await getBillingProfile(commerceId)
    const nowIso = new Date().toISOString()
    const billingAllowed = canAccessByBilling(billingProfile, nowIso)
    const billingStatus = billingProfile?.status ?? accountStatus

    return {
      isAuthorized: billingAllowed,
      context: {
        role,
        commerceIds: commerceIds.join(","),
        accountStatus,
        billingStatus,
        billingAccess: billingAllowed ? "allowed" : "blocked",
      },
    }
  } catch {
    return { isAuthorized: false, context: null }
  }
}
