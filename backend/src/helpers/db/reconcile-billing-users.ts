import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand, AdminGetUserCommand, AdminUpdateUserAttributesCommand } from "@aws-sdk/client-cognito-identity-provider"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"
import type { BillingProfile, RegistrationRecord } from "../../models/billing"

const tableName = process.env.TABLE_NAME
const userPoolId = process.env.COGNITO_USER_POOL_ID
const apply = process.argv.includes("--apply")
if (!tableName || !userPoolId) throw new Error("TABLE_NAME and COGNITO_USER_POOL_ID are required")

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const cognito = new CognitoIdentityProviderClient({})

async function scanAll() {
  const items: Record<string, any>[] = []
  let ExclusiveStartKey: Record<string, any> | undefined
  do {
    const page = await documentClient.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }))
    items.push(...(page.Items ?? []))
    ExclusiveStartKey = page.LastEvaluatedKey
  } while (ExclusiveStartKey)
  return items
}

async function main() {
  const items = await scanAll()
  const registrations = items.filter((item) => item.type === "REGISTRATION") as RegistrationRecord[]
  const profiles = items.filter((item) => item.type === "BILLING_PROFILE") as BillingProfile[]

  for (const profile of profiles) {
    const registration = registrations.find((item) => item.commerceId === profile.commerceId)
    const operation = {
      email: profile.ownerEmail,
      commerceId: profile.commerceId,
      status: profile.status,
      registrationId: registration?.registrationId,
    }
    console.log(apply ? "APPLY" : "DRY-RUN", operation)
    if (!apply) continue

    const user = await cognito.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: profile.ownerEmail }))
    const sub = user.UserAttributes?.find((attribute) => attribute.Name === "sub")?.Value ?? profile.ownerCognitoSub
    await cognito.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId,
      Username: profile.ownerEmail,
      UserAttributes: [
        { Name: "custom:commerceIds", Value: profile.commerceId },
        { Name: "custom:accountStatus", Value: profile.status },
        ...(registration ? [{ Name: "custom:regId", Value: registration.registrationId }] : []),
      ],
    }))
    await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: profile.ownerEmail, GroupName: "admin" }))
    await documentClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: `COM#${profile.commerceId}`,
        SK: "PROFILE",
        type: "COMMERCE",
        commerceId: profile.commerceId,
        merchantName: profile.merchantName,
        ownerCognitoSub: sub,
        ownerEmail: profile.ownerEmail,
        createdAt: profile.createdAt,
        updatedAt: new Date().toISOString(),
      },
    }))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
