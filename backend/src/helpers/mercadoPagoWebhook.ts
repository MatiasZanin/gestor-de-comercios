import crypto from "crypto"

export interface ValidatedMercadoPagoWebhook {
  dataId: string | null
  requestId: string | null
  timestamp: string | null
  signature: string | null
}

function parseSignature(signatureHeader: string | undefined) {
  if (!signatureHeader) {
    return { timestamp: null, hash: null }
  }

  let timestamp: string | null = null
  let hash: string | null = null

  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=")
    if (!key || !value) continue
    const normalizedKey = key.trim()
    const normalizedValue = value.trim()
    if (normalizedKey === "ts") timestamp = normalizedValue
    if (normalizedKey === "v1") hash = normalizedValue
  }

  return { timestamp, hash }
}

export function buildWebhookManifest(params: {
  dataId?: string | null
  requestId?: string | null
  timestamp?: string | null
}): string {
  const parts: string[] = []
  if (params.dataId) {
    parts.push(`id:${params.dataId.toLowerCase()}`)
  }
  if (params.requestId) {
    parts.push(`request-id:${params.requestId}`)
  }
  if (params.timestamp) {
    parts.push(`ts:${params.timestamp}`)
  }
  return parts.join(";")
}

export function validateMercadoPagoWebhookSignature(input: {
  signature?: string
  requestId?: string
  dataId?: string | null
  secret?: string
}): ValidatedMercadoPagoWebhook {
  const secret = input.secret
  if (!secret) {
    throw new Error("MERCADO_PAGO_WEBHOOK_SECRET is required")
  }

  const { timestamp, hash } = parseSignature(input.signature)
  if (!timestamp || !hash) {
    throw new Error("Invalid Mercado Pago signature header")
  }

  const manifest = buildWebhookManifest({
    dataId: input.dataId,
    requestId: input.requestId ?? null,
    timestamp,
  })
  const computed = crypto.createHmac("sha256", secret).update(manifest).digest("hex")

  if (computed !== hash) {
    throw new Error("Invalid Mercado Pago webhook signature")
  }

  return {
    dataId: input.dataId ?? null,
    requestId: input.requestId ?? null,
    timestamp,
    signature: hash,
  }
}
