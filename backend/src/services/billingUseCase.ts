import { createHash, randomUUID } from "crypto"
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb"
import { BadRequestError, ConflictError, NotFoundError } from "../helpers/errors"
import {
  addDays,
  billingConfig,
  BILLING_STATUS,
  nowIso,
  type BillingStatus,
} from "../config/billing"
import type {
  BillingProfile,
  PublicBillingConfigResponse,
  PublicRegistrationRequest,
  PublicRegistrationResponse,
  RegistrationRecord,
  RegistrationStatusResponse,
  WebhookEventRecord,
} from "../models/billing"
import {
  MercadoPagoClient,
  type MercadoPagoPayment,
  type MercadoPagoSubscription,
} from "./mercadoPagoClient"

const dynamoClient = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(dynamoClient)
const cognitoClient = new CognitoIdentityProviderClient({})

function requireTableName() {
  const tableName = process.env.TABLE_NAME
  if (!tableName) {
    throw new Error("TABLE_NAME env var is required")
  }
  return tableName
}

function requireUserPoolId() {
  const userPoolId = process.env.COGNITO_USER_POOL_ID
  if (!userPoolId) {
    throw new Error("COGNITO_USER_POOL_ID is required")
  }
  return userPoolId
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeMerchantName(name: string): string {
  return name.trim().replace(/\s+/g, " ")
}

function buildRegistrationId(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 24)
}

function buildCommerceId(email: string): string {
  const hash = createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 10)
  return `com_${hash}`
}

function registrationKey(registrationId: string) {
  return { PK: `REG#${registrationId}`, SK: "REGISTRATION" as const }
}

function billingKey(commerceId: string) {
  return { PK: `COM#${commerceId}`, SK: "BILLING#PROFILE" as const }
}

function webhookEventKey(eventId: string) {
  return { PK: "MP#WEBHOOK", SK: `EVENT#${eventId}` }
}

function publicConfigResponse(): PublicBillingConfigResponse {
  return {
    monthlyAmount: billingConfig.monthlyAmount,
    currencyId: billingConfig.currencyId,
    trialDays: billingConfig.trialDays,
    graceDays: billingConfig.graceDays,
    planId: billingConfig.planId,
    planReason: billingConfig.planReason,
    frontendBaseUrl: billingConfig.frontendBaseUrl,
    publicRegistrationPath: billingConfig.publicRegistrationPath,
  }
}

function assertBillingEnv() {
  if (!billingConfig.planId) {
    throw new Error("MERCADO_PAGO_PREAPPROVAL_PLAN_ID is required")
  }
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN is required")
  }
  requireUserPoolId()
  requireTableName()
}

function getMpClient() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN is required")
  }
  return new MercadoPagoClient(accessToken)
}

async function getRegistrationById(registrationId: string): Promise<RegistrationRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: requireTableName(),
      Key: registrationKey(registrationId),
    })
  )
  return (result.Item as RegistrationRecord | undefined) ?? null
}

async function getBillingProfileByCommerceId(commerceId: string): Promise<BillingProfile | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: requireTableName(),
      Key: billingKey(commerceId),
    })
  )
  return (result.Item as BillingProfile | undefined) ?? null
}

async function saveRegistration(record: RegistrationRecord) {
  await docClient.send(
    new PutCommand({
      TableName: requireTableName(),
      Item: record,
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    })
  )
}

async function upsertRegistration(record: RegistrationRecord) {
  await docClient.send(
    new PutCommand({
      TableName: requireTableName(),
      Item: record,
    })
  )
}

async function saveBillingProfile(record: BillingProfile) {
  await docClient.send(
    new PutCommand({
      TableName: requireTableName(),
      Item: record,
    })
  )
}

async function saveWebhookEvent(record: WebhookEventRecord) {
  await docClient.send(
    new PutCommand({
      TableName: requireTableName(),
      Item: record,
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    })
  )
}

async function ensureCognitoUser(input: {
  email: string
  password: string
  firstName: string
  lastName: string
}) {
  const userPoolId = requireUserPoolId()
  const username = input.email

  try {
    await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      })
    )
  } catch (err: any) {
    const notFound = err?.name === "UserNotFoundException"
    if (!notFound) {
      throw err
    }

    await cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: username,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: input.email },
          { Name: "given_name", Value: input.firstName },
          { Name: "family_name", Value: input.lastName },
          { Name: "email_verified", Value: "true" },
        ],
      })
    )
  }

  await cognitoClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
      Password: input.password,
      Permanent: true,
    })
  )
}

async function updateCognitoBillingAttrs(input: {
  email: string
  status: BillingStatus
  commerceId?: string
}) {
  const userPoolId = requireUserPoolId()
  const attributes: Array<{ Name: string; Value: string }> = []

  if (input.commerceId) {
    attributes.push({ Name: "custom:commerceIds", Value: input.commerceId })
  }

  if (attributes.length === 0) {
    return
  }

  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId,
      Username: input.email,
      UserAttributes: attributes,
    })
  )
}

function buildPlanCheckoutUrl(planId: string) {
  return `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${encodeURIComponent(planId)}`
}

interface SubscriptionState {
  status: BillingStatus
  trialStartedAt?: string
  trialEndsAt?: string
  currentPeriodEndsAt?: string
  graceUntil?: string
  lastPaymentStatus?: string
}

function parseIso(value?: string): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

function mapSubscriptionToStatus(
  subscription: MercadoPagoSubscription,
  existingProfile?: BillingProfile | null
): SubscriptionState {
  const now = nowIso()
  const subscriptionStatus = (subscription.status ?? "").toLowerCase()
  const nextPaymentDate = subscription.next_payment_date
  const hasTrialDates = !!existingProfile?.trialStartedAt || !!existingProfile?.trialEndsAt

  if (subscriptionStatus === "cancelled" || subscriptionStatus === "canceled") {
    return {
      status: BILLING_STATUS.CANCELLED,
      currentPeriodEndsAt: nextPaymentDate ?? existingProfile?.currentPeriodEndsAt,
      lastPaymentStatus: subscriptionStatus,
    }
  }

  if (subscriptionStatus === "paused" || subscriptionStatus === "rejected") {
    return {
      status: BILLING_STATUS.PAST_DUE,
      currentPeriodEndsAt: nextPaymentDate ?? existingProfile?.currentPeriodEndsAt,
      graceUntil: addDays(now, billingConfig.graceDays),
      lastPaymentStatus: subscriptionStatus,
    }
  }

  if (subscriptionStatus === "pending") {
    return {
      status: BILLING_STATUS.PENDING_SUBSCRIPTION,
      lastPaymentStatus: subscriptionStatus,
    }
  }

  if (subscriptionStatus === "authorized" || subscriptionStatus === "active") {
    const trialEndsAt = existingProfile?.trialEndsAt ?? nextPaymentDate ?? addDays(now, billingConfig.trialDays)
    const trialStartedAt = existingProfile?.trialStartedAt ?? now
    const trialEndsAtTime = parseIso(trialEndsAt)
    const isTrialActive = !hasTrialDates || (trialEndsAtTime !== null && trialEndsAtTime > Date.now())

    return {
      status: isTrialActive ? BILLING_STATUS.TRIAL : BILLING_STATUS.ACTIVE,
      trialStartedAt,
      trialEndsAt: trialEndsAt ?? undefined,
      currentPeriodEndsAt: nextPaymentDate ?? existingProfile?.currentPeriodEndsAt,
      lastPaymentStatus: subscriptionStatus,
    }
  }

  return {
    status: BILLING_STATUS.PENDING_SUBSCRIPTION,
    lastPaymentStatus: subscriptionStatus || "unknown",
  }
}

function buildRegistrationResponse(
  registrationId: string,
  commerceId: string,
  registration: RegistrationRecord,
  checkoutUrl: string
): PublicRegistrationResponse {
  return {
    registrationId,
    commerceId,
    checkoutUrl,
    status: registration.status,
    email: registration.email,
  }
}

function isRegistrationReusable(registration: RegistrationRecord | null | undefined) {
  if (!registration) return false
  if (registration.expiresAt && registration.expiresAt < Math.floor(Date.now() / 1000)) {
    return false
  }
  return registration.status === "checkout_created" || registration.status === "pending_subscription"
}

function buildWebhookId(input: { eventId?: string | null; requestId?: string | null; dataId?: string | null }) {
  return (
    input.eventId ??
    input.requestId ??
    (input.dataId ? createHash("sha256").update(input.dataId).digest("hex").slice(0, 24) : randomUUID())
  )
}

async function syncBillingFromPayment(payment: MercadoPagoPayment) {
  const subscriptionId = payment.preapproval_id
  if (!subscriptionId) {
    return { ignored: true as const }
  }

  const mp = getMpClient()
  const subscription = await mp.getSubscription(subscriptionId)
  return syncBillingFromSubscription(subscription)
}

export async function getPublicBillingConfig(): Promise<PublicBillingConfigResponse> {
  return publicConfigResponse()
}

export async function createPublicRegistration(
  input: PublicRegistrationRequest
): Promise<PublicRegistrationResponse> {
  assertBillingEnv()

  if (!input.acceptTerms) {
    throw new BadRequestError("Debe aceptar los términos y condiciones")
  }

  const email = normalizeEmail(input.email)
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const merchantName = normalizeMerchantName(input.merchantName)
  const registrationId = buildRegistrationId(email)
  const commerceId = buildCommerceId(email)
  const createdAt = nowIso()
  const existingRegistration = await getRegistrationById(registrationId)
  const existingBillingProfile = await getBillingProfileByCommerceId(commerceId)

  if (existingBillingProfile && existingBillingProfile.status !== BILLING_STATUS.PENDING_SUBSCRIPTION) {
    throw new ConflictError("Email already registered")
  }

  if (isRegistrationReusable(existingRegistration) && existingRegistration?.checkoutUrl) {
    return buildRegistrationResponse(
      registrationId,
      commerceId,
      existingRegistration,
      existingRegistration.checkoutUrl
    )
  }

  const registration: RegistrationRecord = {
    ...registrationKey(registrationId),
    type: "REGISTRATION",
    registrationId,
    commerceId,
    email,
    firstName,
    lastName,
    merchantName,
    status: "pending_subscription",
    checkoutUrl: existingRegistration?.checkoutUrl,
    mercadoPagoSubscriptionId: existingRegistration?.mercadoPagoSubscriptionId,
    userPoolUsername: email,
    createdAt: existingRegistration?.createdAt ?? createdAt,
    updatedAt: createdAt,
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    retryCount: (existingRegistration?.retryCount ?? 0) + 1,
  }

  try {
    await saveRegistration(registration)
  } catch (err: any) {
    if (err?.name !== "ConditionalCheckFailedException") {
      throw err
    }
  }

  await ensureCognitoUser({
    email,
    password: input.password,
    firstName,
    lastName,
  })

  const checkoutUrl = buildPlanCheckoutUrl(billingConfig.planId)

  const nextRegistration: RegistrationRecord = {
    ...registration,
    status: "checkout_created",
    checkoutUrl,
    updatedAt: nowIso(),
  }

  const billingProfile: BillingProfile = {
    ...billingKey(commerceId),
    type: "BILLING_PROFILE",
    commerceId,
    status: BILLING_STATUS.PENDING_SUBSCRIPTION,
    ownerEmail: email,
    ownerCognitoSub: "",
    merchantName,
    mercadoPagoPlanId: billingConfig.planId,
    createdAt,
    updatedAt: createdAt,
  }

  await upsertRegistration(nextRegistration)
  await saveBillingProfile(billingProfile)

  await updateCognitoBillingAttrs({
    email,
    status: BILLING_STATUS.PENDING_SUBSCRIPTION,
  })

  return buildRegistrationResponse(
    registrationId,
    commerceId,
    nextRegistration,
    nextRegistration.checkoutUrl ?? `${billingConfig.frontendBaseUrl}${billingConfig.publicRegistrationPath}`
  )
}

export async function getRegistrationStatus(registrationId: string): Promise<RegistrationStatusResponse> {
  const registration = await getRegistrationById(registrationId)
  if (!registration) {
    throw new NotFoundError("Registration not found")
  }

  const billingProfile = await getBillingProfileByCommerceId(registration.commerceId)
  const fallbackStatus = registration.status === "checkout_created" ? BILLING_STATUS.PENDING_SUBSCRIPTION : registration.status

  return {
    registrationId,
    commerceId: registration.commerceId,
    status: billingProfile?.status ?? fallbackStatus,
    checkoutUrl: registration.checkoutUrl ?? buildPlanCheckoutUrl(billingConfig.planId),
    billingProfile: billingProfile ?? undefined,
    registration,
  }
}

export async function syncBillingFromSubscription(subscription: MercadoPagoSubscription) {
  const payerEmail = subscription.payer_email ? normalizeEmail(subscription.payer_email) : ""
  const commerceId = subscription.external_reference || (payerEmail ? buildCommerceId(payerEmail) : "")
  if (!commerceId) {
    throw new BadRequestError("Missing external_reference or payer_email on Mercado Pago subscription")
  }

  let billingProfile = await getBillingProfileByCommerceId(commerceId)
  if (!billingProfile && payerEmail) {
    const registration = await getRegistrationById(buildRegistrationId(payerEmail))
    if (registration) {
      billingProfile = await getBillingProfileByCommerceId(registration.commerceId)
    }
  }

  if (!billingProfile) {
    throw new NotFoundError(`Billing profile not found for commerce ${commerceId}`)
  }

  const next = mapSubscriptionToStatus(subscription, billingProfile)
  const updatedAt = nowIso()
  const updatedBillingProfile: BillingProfile = {
    ...billingProfile,
    status: next.status,
    mercadoPagoSubscriptionId: subscription.id,
    trialStartedAt: next.trialStartedAt ?? billingProfile.trialStartedAt,
    trialEndsAt: next.trialEndsAt ?? billingProfile.trialEndsAt,
    currentPeriodEndsAt: next.currentPeriodEndsAt ?? billingProfile.currentPeriodEndsAt,
    graceUntil: next.graceUntil ?? billingProfile.graceUntil,
    lastPaymentStatus: next.lastPaymentStatus ?? billingProfile.lastPaymentStatus,
    lastWebhookAt: updatedAt,
    updatedAt,
  }

  await saveBillingProfile(updatedBillingProfile)
  await updateCognitoBillingAttrs({
    email: billingProfile.ownerEmail,
    status: next.status,
    commerceId: next.status === BILLING_STATUS.PENDING_SUBSCRIPTION ? undefined : billingProfile.commerceId,
  })

  return updatedBillingProfile
}

export async function cancelBilling(commerceId: string) {
  const billingProfile = await getBillingProfileByCommerceId(commerceId)
  if (!billingProfile) {
    throw new NotFoundError("Billing profile not found")
  }
  if (!billingProfile.mercadoPagoSubscriptionId) {
    throw new BadRequestError("Missing Mercado Pago subscription id")
  }

  const mp = getMpClient()
  const cancelled = await mp.cancelSubscription(billingProfile.mercadoPagoSubscriptionId)
  const next = mapSubscriptionToStatus(cancelled, billingProfile)
  const updatedAt = nowIso()
  const updatedBillingProfile: BillingProfile = {
    ...billingProfile,
    status: next.status,
    currentPeriodEndsAt: next.currentPeriodEndsAt ?? cancelled.next_payment_date ?? billingProfile.currentPeriodEndsAt,
    graceUntil: next.graceUntil ?? billingProfile.graceUntil,
    lastPaymentStatus: next.lastPaymentStatus ?? cancelled.status ?? billingProfile.lastPaymentStatus,
    lastWebhookAt: updatedAt,
    updatedAt,
  }

  await saveBillingProfile(updatedBillingProfile)
  await updateCognitoBillingAttrs({
    email: billingProfile.ownerEmail,
    status: updatedBillingProfile.status,
    commerceId,
  })

  return updatedBillingProfile
}

export async function getProtectedBillingStatus(commerceId: string) {
  return getBillingProfileByCommerceId(commerceId)
}

export async function processMercadoPagoWebhook(input: {
  eventId?: string | null
  requestId?: string | null
  eventType?: string | null
  dataId?: string | null
  topic?: string | null
  action?: string | null
}) {
  assertBillingEnv()

  const eventId = buildWebhookId(input)
  const eventRecord: WebhookEventRecord = {
    ...webhookEventKey(eventId),
    type: "MP_WEBHOOK_EVENT",
    eventId,
    eventType: input.eventType ?? input.topic ?? input.action ?? "unknown",
    paymentId: input.topic === "payment" ? input.dataId ?? undefined : undefined,
    subscriptionId: input.topic === "preapproval" ? input.dataId ?? undefined : undefined,
    processedAt: nowIso(),
    rawRequestId: input.requestId ?? undefined,
  }

  try {
    await saveWebhookEvent(eventRecord)
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") {
      return { duplicate: true }
    }
    throw err
  }

  const mp = getMpClient()

  if (input.topic === "preapproval" && input.dataId) {
    const subscription = await mp.getSubscription(input.dataId)
    const billingProfile = await syncBillingFromSubscription(subscription)
    return { duplicate: false, billingProfile }
  }

  if (input.topic === "payment" && input.dataId) {
    const payment = await mp.getPayment(input.dataId)
    if (payment.preapproval_id) {
      const subscription = await mp.getSubscription(payment.preapproval_id)
      const billingProfile = await syncBillingFromSubscription(subscription)
      return { duplicate: false, billingProfile }
    }

    return { duplicate: false, ignored: true, paymentStatus: payment.status ?? "unknown" }
  }

  if (input.dataId) {
    const subscription = await mp.getSubscription(input.dataId)
    const billingProfile = await syncBillingFromSubscription(subscription)
    return { duplicate: false, billingProfile }
  }

  return { duplicate: false, ignored: true }
}
