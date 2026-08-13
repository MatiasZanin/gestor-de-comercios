import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb"

type TableItem = Record<string, unknown> & {
  PK?: string
  SK?: string
  type?: string
  commerceId?: string
  ownerEmail?: string
  email?: string
  payerEmail?: string
  registrationId?: string
  userPoolUsername?: string
}

type CliOptions = {
  email: string
  apply: boolean
  tableName: string
  userPoolId: string
  region: string
}

function loadDotEnvIfPresent() {
  const envPath = resolve(process.cwd(), ".env")
  if (!existsSync(envPath)) return

  const raw = readFileSync(envPath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    if (process.env[key]) continue

    let value = trimmed.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function parseArgs(): CliOptions {
  const argv = process.argv.slice(2)
  const args = new Map<string, string>()
  let apply = false

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === "--apply") {
      apply = true
      continue
    }

    if (token === "--email" || token === "--table-name" || token === "--user-pool-id" || token === "--region") {
      const next = argv[index + 1]
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${token}`)
      }
      args.set(token, next)
      index += 1
      continue
    }

    if (token.startsWith("--email=")) args.set("--email", token.slice("--email=".length))
    else if (token.startsWith("--table-name=")) args.set("--table-name", token.slice("--table-name=".length))
    else if (token.startsWith("--user-pool-id=")) args.set("--user-pool-id", token.slice("--user-pool-id=".length))
    else if (token.startsWith("--region=")) args.set("--region", token.slice("--region=".length))
    else if (token === "--help" || token === "-h") {
      printUsageAndExit(0)
    } else {
      throw new Error(`Unknown argument: ${token}`)
    }
  }

  const email = normalizeEmail(args.get("--email") ?? "test_user_7185563138506731919@testuser.com")
  return {
    email,
    apply,
    tableName: args.get("--table-name") ?? requireEnv("TABLE_NAME"),
    userPoolId: args.get("--user-pool-id") ?? requireEnv("COGNITO_USER_POOL_ID"),
    region: args.get("--region") ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
  }
}

function printUsageAndExit(code: number): never {
  console.log(`
Uso:
  tsx src/helpers/db/delete-user-data.ts --email user@example.com [--apply]

Opciones:
  --email         Email del usuario a eliminar. Default: test_user_7185563138506731919@testuser.com
  --apply         Ejecuta el borrado real. Sin este flag corre en dry-run.
  --table-name    Sobrescribe TABLE_NAME.
  --user-pool-id  Sobrescribe COGNITO_USER_POOL_ID.
  --region        Sobrescribe la región AWS.
`)
  process.exit(code)
}

async function scanAllItems(docClient: DynamoDBDocumentClient, tableName: string): Promise<TableItem[]> {
  const items: TableItem[] = []
  let ExclusiveStartKey: Record<string, unknown> | undefined

  do {
    const page = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
        ProjectionExpression: "#pk, #sk, #type, commerceId, ownerEmail, email, payerEmail, registrationId, userPoolUsername",
        ExpressionAttributeNames: {
          "#pk": "PK",
          "#sk": "SK",
          "#type": "type",
        },
      })
    )
    items.push(...((page.Items ?? []) as TableItem[]))
    ExclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined
  } while (ExclusiveStartKey)

  return items
}

function dedupeKeys(items: Array<{ PK: string; SK: string }>) {
  const map = new Map<string, { PK: string; SK: string }>()
  for (const item of items) {
    map.set(`${item.PK}||${item.SK}`, item)
  }
  return [...map.values()]
}

async function deleteKeys(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  keys: Array<{ PK: string; SK: string }>
) {
  const batches: Array<Array<{ PK: string; SK: string }>> = []
  for (let index = 0; index < keys.length; index += 25) {
    batches.push(keys.slice(index, index + 25))
  }

  for (const batch of batches) {
    await Promise.all(
      batch.map((key) =>
        docClient.send(
          new DeleteCommand({
            TableName: tableName,
            Key: key,
          })
        )
      )
    )
  }
}

async function deleteCommerceItems(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  commerceId: string
) {
  const deletedKeys: Array<{ PK: string; SK: string }> = []
  let ExclusiveStartKey: Record<string, unknown> | undefined

  do {
    const page = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `COM#${commerceId}`,
        },
        ExclusiveStartKey,
      })
    )
    const pageKeys =
      (page.Items ?? [])
        .map((item) => {
          const PK = typeof item.PK === "string" ? item.PK : ""
          const SK = typeof item.SK === "string" ? item.SK : ""
          return PK && SK ? { PK, SK } : null
        })
        .filter((item): item is { PK: string; SK: string } => !!item) ?? []
    deletedKeys.push(...pageKeys)
    ExclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined
  } while (ExclusiveStartKey)

  await deleteKeys(docClient, tableName, dedupeKeys(deletedKeys))
  return deletedKeys.length
}

function buildCleanupPlan(items: TableItem[], email: string) {
  const matchingItems = items.filter((item) => {
    const itemEmail = normalizeEmail(
      String(item.ownerEmail ?? item.email ?? item.payerEmail ?? item.userPoolUsername ?? "")
    )
    return itemEmail === email
  })

  const commerceIds = [...new Set(matchingItems.map((item) => String(item.commerceId ?? "")).filter(Boolean))]
  const registrationKeys = matchingItems
    .filter((item) => item.type === "REGISTRATION")
    .map((item) => {
      const PK = typeof item.PK === "string" ? item.PK : ""
      const SK = typeof item.SK === "string" ? item.SK : ""
      return PK && SK ? { PK, SK } : null
    })
    .filter((item): item is { PK: string; SK: string } => !!item)

  const payerLinkKeys = matchingItems
    .filter((item) => item.type === "BILLING_PAYER_LINK")
    .map((item) => {
      const PK = typeof item.PK === "string" ? item.PK : ""
      const SK = typeof item.SK === "string" ? item.SK : ""
      return PK && SK ? { PK, SK } : null
    })
    .filter((item): item is { PK: string; SK: string } => !!item)

  return {
    commerceIds,
    registrationKeys,
    payerLinkKeys,
  }
}

async function findCognitoUsers(cognito: CognitoIdentityProviderClient, userPoolId: string, email: string) {
  const response = await cognito.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `email = "${email.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
      Limit: 10,
    })
  )

  return (response.Users ?? []).filter((user) =>
    user.Attributes?.some((attribute) => attribute.Name === "email" && normalizeEmail(attribute.Value ?? "") === email)
  )
}

async function main() {
  loadDotEnvIfPresent()
  const options = parseArgs()
  const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: options.region }))
  const cognito = new CognitoIdentityProviderClient({ region: options.region })

  const users = await findCognitoUsers(cognito, options.userPoolId, options.email)
  const items = await scanAllItems(documentClient, options.tableName)
  const plan = buildCleanupPlan(items, options.email)

  console.log(`Usuario: ${options.email}`)
  console.log(`Modo: ${options.apply ? "APPLY" : "DRY-RUN"}`)
  console.log(`Cognito users encontrados: ${users.length}`)
  console.log(`Commerce IDs asociados: ${plan.commerceIds.length ? plan.commerceIds.join(", ") : "(ninguno)"}`)
  console.log(`Registration items: ${plan.registrationKeys.length}`)
  console.log(`Billing payer links: ${plan.payerLinkKeys.length}`)

  const commerceDeletes = plan.commerceIds.length
    ? plan.commerceIds.map((commerceId) => ({ commerceId }))
    : []

  if (!options.apply) {
    for (const commerceId of plan.commerceIds) {
      const commerceItems = items.filter(
        (item) => typeof item.PK === "string" && item.PK === `COM#${commerceId}` && typeof item.SK === "string"
      )
      console.log(`- ${commerceId}: ${commerceItems.length} items a borrar en Dynamo`)
    }
    return
  }

  const keysToDelete = [...plan.registrationKeys, ...plan.payerLinkKeys]
  await deleteKeys(documentClient, options.tableName, dedupeKeys(keysToDelete))

  for (const { commerceId } of commerceDeletes) {
    const count = await deleteCommerceItems(documentClient, options.tableName, commerceId)
    console.log(`Eliminados ${count} items del comercio ${commerceId}`)
  }

  for (const user of users) {
    const username = user.Username
    if (!username) continue
    await cognito.send(
      new AdminDeleteUserCommand({
        UserPoolId: options.userPoolId,
        Username: username,
      })
    )
    console.log(`Usuario Cognito eliminado: ${username}`)
  }

  console.log("Borrado completo finalizado")
}

main().catch((error) => {
  console.error("Error al eliminar datos del usuario")
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : error)
  process.exitCode = 1
})
