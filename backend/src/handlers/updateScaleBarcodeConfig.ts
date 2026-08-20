import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda"
import { assertCommerceAccess } from "../helpers/assertCommerceAccess"
import { assertRole } from "../helpers/assertRole"
import { logAudit } from "../helpers/auditLogger"
import { BadRequestError, NotFoundError, buildErrorResponse } from "../helpers/errors"
import { parseScaleBarcodeConfig } from "../services/scaleBarcodeConfig"
import { formatJSONResponse } from "../utils/api-response"

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const tableName = process.env.TABLE_NAME
    if (!tableName) throw new Error("TABLE_NAME env var is required")

    const commerceId = event.pathParameters?.commerceId
    if (!commerceId) throw new BadRequestError("Missing commerceId")

    await assertCommerceAccess(event, commerceId)
    assertRole(event, "admin")
    if (!event.body) throw new BadRequestError("Missing body")

    let body: unknown
    try {
      body = JSON.parse(event.body)
    } catch {
      throw new BadRequestError("Body must be valid JSON")
    }
    if (!body || typeof body !== "object" || Array.isArray(body) || !("scaleBarcodeConfig" in body)) {
      throw new BadRequestError("Missing scaleBarcodeConfig")
    }

    const config = parseScaleBarcodeConfig((body as Record<string, unknown>).scaleBarcodeConfig)
    const updatedAt = new Date().toISOString()
    let result
    try {
      result = await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: { PK: `COM#${commerceId}`, SK: "PROFILE" },
        UpdateExpression: "SET scaleBarcodeConfig = :config, updatedAt = :updatedAt",
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        ExpressionAttributeValues: { ":config": config, ":updatedAt": updatedAt },
        ReturnValues: "ALL_NEW",
      }))
    } catch (error: any) {
      if (error?.name === "ConditionalCheckFailedException") {
        throw new NotFoundError("Commerce profile not found")
      }
      throw error
    }

    const claims = event.requestContext.authorizer?.jwt?.claims ?? {}
    await logAudit(
      tableName,
      commerceId,
      String(claims.sub ?? "unknown"),
      String(claims.email ?? ""),
      "SCALE_BARCODE_CONFIG_UPDATE",
      { scaleBarcodeConfig: config },
      updatedAt
    )

    return formatJSONResponse({
      scaleBarcodeConfig: result.Attributes?.scaleBarcodeConfig ?? config,
    })
  } catch (error) {
    return buildErrorResponse(error)
  }
}
