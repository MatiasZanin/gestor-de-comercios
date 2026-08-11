import { createHash, randomUUID } from "crypto"
import {
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  ListUsersCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb"
import { BadRequestError, ConflictError, NotFoundError } from "../helpers/errors"
import { addDays, billingConfig, BILLING_STATUS, nowIso, type BillingStatus } from "../config/billing"
import type {
  BillingProfile,
  BillingStatusResponse,
  CreateSubscriptionResponse,
  PublicBillingConfigResponse,
  PublicRegistrationRequest,
  PublicRegistrationResponse,
  RegistrationRecord,
  RegistrationStatusResponse,
  SubscriptionRecord,
  WebhookEventRecord,
} from "../models/billing"
import type { CommerceProfile } from "../models/commerce"
import {
  MercadoPagoClient,
  type MercadoPagoPayment,
  type MercadoPagoSubscription,
} from "./mercadoPagoClient"

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const cognitoClient = new CognitoIdentityProviderClient({})

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeMerchantName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/\s+/g, " ")
}

function registrationIdForEmail(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 24)
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  return `${local.slice(0, 1)}***@${domain}`
}

function registrationKey(registrationId: string) {
  return { PK: `REG#${registrationId}`, SK: "REGISTRATION" as const }
}

function commerceKey(commerceId: string) {
  return { PK: `COM#${commerceId}`, SK: "PROFILE" as const }
}

function billingKey(commerceId: string) {
  return { PK: `COM#${commerceId}`, SK: "BILLING#PROFILE" as const }
}

function subscriptionKey(commerceId: string, subscriptionId: string) {
  return { PK: `COM#${commerceId}`, SK: `SUBSCRIPTION#${subscriptionId}` }
}

function webhookEventKey(eventId: string) {
  return { PK: "MP#WEBHOOK", SK: `EVENT#${eventId}` }
}

async function getItem<T>(key: { PK: string; SK: string }): Promise<T | null> {
  const result = await docClient.send(new GetCommand({ TableName: requireEnv("TABLE_NAME"), Key: key }))
  return (result.Item as T | undefined) ?? null
}

async function putItem(item: object, createOnly = false) {
  await docClient.send(
    new PutCommand({
      TableName: requireEnv("TABLE_NAME"),
      Item: item as Record<string, unknown>,
      ...(createOnly ? { ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)" } : {}),
    })
  )
}

async function getRegistration(registrationId: string) {
  return getItem<RegistrationRecord>(registrationKey(registrationId))
}

async function getBillingProfile(commerceId: string) {
  return getItem<BillingProfile>(billingKey(commerceId))
}

async function getSubscriptionRecord(commerceId: string, subscriptionId: string) {
  return getItem<SubscriptionRecord>(subscriptionKey(commerceId, subscriptionId))
}

function getMpClient() {
  return new MercadoPagoClient(requireEnv("MERCADO_PAGO_ACCESS_TOKEN"))
}

async function findCognitoUsersByEmail(email: string) {
  const escaped = email.replace(/\\/g, "\\\\").replace(/\"/g, '\\"')
  const result = await cognitoClient.send(
    new ListUsersCommand({
      UserPoolId: requireEnv("COGNITO_USER_POOL_ID"),
      Filter: `email = "${escaped}"`,
      Limit: 2,
    })
  )
  return result.Users ?? []
}

async function updateCognitoAttributes(input: {
  username: string
  status: BillingStatus
  commerceId?: string
  registrationId?: string
}) {
  const attributes: Array<{ Name: string; Value: string }> = [
    { Name: "custom:accountStatus", Value: input.status },
  ]
  if (input.commerceId) attributes.push({ Name: "custom:commerceIds", Value: input.commerceId })
  if (input.registrationId) attributes.push({ Name: "custom:regId", Value: input.registrationId })

  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: requireEnv("COGNITO_USER_POOL_ID"),
      Username: input.username,
      UserAttributes: attributes,
    })
  )
}

async function createCognitoUser(input: PublicRegistrationRequest, registrationId: string, commerceId: string) {
  const email = normalizeEmail(input.email)
  const result = await cognitoClient.send(
    new SignUpCommand({
      ClientId: requireEnv("COGNITO_CLIENT_ID"),
      Username: email,
      Password: input.password,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "given_name", Value: input.firstName.trim() },
        { Name: "family_name", Value: input.lastName.trim() },
      ],
    })
  )

  await updateCognitoAttributes({
    username: email,
    status: BILLING_STATUS.PENDING_SUBSCRIPTION,
    commerceId,
    registrationId,
  })
  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: requireEnv("COGNITO_USER_POOL_ID"),
      Username: email,
      GroupName: "admin",
    })
  )
  return result.UserSub ?? ""
}

export async function getPublicBillingConfig(): Promise<PublicBillingConfigResponse> {
  return {
    monthlyAmount: billingConfig.monthlyAmount,
    currencyId: billingConfig.currencyId,
    trialDays: billingConfig.trialDays,
    graceDays: billingConfig.graceDays,
    planReason: billingConfig.planReason,
  }
}

export async function createPublicRegistration(
  input: PublicRegistrationRequest
): Promise<PublicRegistrationResponse> {
  if (!input.acceptTerms) throw new BadRequestError("Debe aceptar los términos y condiciones")

  requireEnv("TABLE_NAME")
  requireEnv("COGNITO_USER_POOL_ID")
  requireEnv("COGNITO_CLIENT_ID")

  const email = normalizeEmail(input.email)
  const registrationId = registrationIdForEmail(email)
  const existingRegistration = await getRegistration(registrationId)
  const cognitoUsers = await findCognitoUsersByEmail(email)

  if (existingRegistration) {
    return {
      registrationId,
      status: existingRegistration.status,
      maskedEmail: maskEmail(email),
    }
  }
  if (cognitoUsers.length > 0) throw new ConflictError("Ya existe una cuenta para ese email")

  const commerceId = randomUUID()
  const createdAt = nowIso()
  const merchantName = normalizeMerchantName(input.merchantName)
  const registration: RegistrationRecord = {
    ...registrationKey(registrationId),
    type: "REGISTRATION",
    registrationId,
    commerceId,
    email,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    merchantName,
    status: "email_verification_pending",
    userPoolUsername: email,
    createdAt,
    updatedAt: createdAt,
    retryCount: 1,
  }

  await putItem(registration, true)
  try {
    const ownerCognitoSub = await createCognitoUser(input, registrationId, commerceId)
    const commerce: CommerceProfile = {
      ...commerceKey(commerceId),
      type: "COMMERCE",
      commerceId,
      merchantName,
      ownerCognitoSub,
      ownerEmail: email,
      createdAt,
      updatedAt: createdAt,
    }
    const billing: BillingProfile = {
      ...billingKey(commerceId),
      type: "BILLING_PROFILE",
      commerceId,
      merchantName,
      ownerEmail: email,
      ownerCognitoSub,
      status: BILLING_STATUS.PENDING_SUBSCRIPTION,
      mercadoPagoPlanId: billingConfig.planId,
      createdAt,
      updatedAt: createdAt,
    }
    await Promise.all([
      putItem({ ...registration, ownerCognitoSub }),
      putItem(commerce),
      putItem(billing),
    ])
  } catch (error) {
    // The durable registration makes a partial signup observable and recoverable.
    throw error
  }

  return { registrationId, status: registration.status, maskedEmail: maskEmail(email) }
}

export async function confirmRegistrationEmail(registrationId: string, code: string) {
  const registration = await getRegistration(registrationId)
  if (!registration) throw new NotFoundError("Registration not found")

  try {
    await cognitoClient.send(
      new ConfirmSignUpCommand({
        ClientId: requireEnv("COGNITO_CLIENT_ID"),
        Username: registration.email,
        ConfirmationCode: code,
      })
    )
  } catch (error: any) {
    if (error?.name !== "NotAuthorizedException") throw error
    const user = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: requireEnv("COGNITO_USER_POOL_ID"),
        Username: registration.email,
      })
    )
    if (user.UserStatus !== "CONFIRMED") throw error
  }

  const updated: RegistrationRecord = {
    ...registration,
    status: "pending_subscription",
    updatedAt: nowIso(),
  }
  await putItem(updated)
  return { registrationId, status: updated.status, loginUrl: "/login?next=/suscripcion" }
}

export async function resendRegistrationCode(registrationId: string) {
  const registration = await getRegistration(registrationId)
  if (!registration) throw new NotFoundError("Registration not found")
  if (registration.status !== "email_verification_pending") {
    throw new ConflictError("El email ya fue confirmado")
  }
  await cognitoClient.send(
    new ResendConfirmationCodeCommand({
      ClientId: requireEnv("COGNITO_CLIENT_ID"),
      Username: registration.email,
    })
  )
}

export async function getRegistrationStatus(registrationId: string): Promise<RegistrationStatusResponse> {
  const registration = await getRegistration(registrationId)
  if (!registration) throw new NotFoundError("Registration not found")
  return {
    registrationId,
    status: registration.status,
    maskedEmail: maskEmail(registration.email),
    merchantName: registration.merchantName,
  }
}

export async function createBillingSubscription(
  commerceId: string,
  payerEmailInput: string
): Promise<CreateSubscriptionResponse> {
  const payerEmail = normalizeEmail(payerEmailInput)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
    throw new BadRequestError("Invalid Mercado Pago email")
  }
  const profile = await getBillingProfile(commerceId)
  if (!profile) throw new NotFoundError("Billing profile not found")
  if (profile.status === BILLING_STATUS.TRIAL || profile.status === BILLING_STATUS.ACTIVE) {
    throw new ConflictError("La suscripción ya está habilitada")
  }

  if (profile.currentSubscriptionId) {
    const current = await getSubscriptionRecord(commerceId, profile.currentSubscriptionId)
    if (current?.status === "pending" && current.checkoutUrl) {
      return {
        subscriptionId: current.subscriptionId,
        checkoutUrl: current.checkoutUrl,
        status: BILLING_STATUS.PENDING_SUBSCRIPTION,
        includesTrial: current.includesTrial,
      }
    }
    if (current && !["cancelled", "canceled"].includes(current.status)) {
      try {
        await getMpClient().cancelSubscription(current.subscriptionId)
      } catch {
        // A remote subscription may already be terminal; the new preapproval remains authoritative.
      }
      await putItem({ ...current, replacedAt: nowIso(), updatedAt: nowIso() })
    }
  }

  const includesTrial = !profile.trialConsumedAt
  const planId = includesTrial ? billingConfig.planId : billingConfig.reactivationPlanId
  if (!planId) {
    throw new Error(
      includesTrial
        ? "MERCADO_PAGO_PREAPPROVAL_PLAN_ID is required"
        : "MERCADO_PAGO_REACTIVATION_PLAN_ID is required"
    )
  }

  const attemptId = randomUUID()
  const subscription = await getMpClient().createSubscription({
    planId,
    payerEmail,
    externalReference: commerceId,
    backUrl: `${billingConfig.frontendBaseUrl.replace(/\/$/, "")}/suscripcion`,
    idempotencyKey: `${commerceId}:${attemptId}`,
  })
  if (!subscription.id || !subscription.init_point) {
    throw new Error("Mercado Pago did not return a checkout URL")
  }

  const now = nowIso()
  const record: SubscriptionRecord = {
    ...subscriptionKey(commerceId, subscription.id),
    type: "BILLING_SUBSCRIPTION",
    commerceId,
    subscriptionId: subscription.id,
    planId,
    payerEmail,
    status: subscription.status ?? "pending",
    includesTrial,
    checkoutUrl: subscription.init_point,
    createdAt: now,
    updatedAt: now,
  }
  const updatedProfile: BillingProfile = {
    ...profile,
    status: BILLING_STATUS.PENDING_SUBSCRIPTION,
    billingPayerEmail: payerEmail,
    mercadoPagoPlanId: planId,
    mercadoPagoSubscriptionId: subscription.id,
    currentSubscriptionId: subscription.id,
    updatedAt: now,
  }
  await Promise.all([putItem(record), putItem(updatedProfile)])
  await updateCognitoAttributes({ username: profile.ownerEmail, status: updatedProfile.status })

  return {
    subscriptionId: subscription.id,
    checkoutUrl: subscription.init_point,
    status: updatedProfile.status,
    includesTrial,
  }
}

interface SubscriptionState {
  status: BillingStatus
  trialStartedAt?: string
  trialEndsAt?: string
  currentPeriodEndsAt?: string
  graceUntil?: string
  lastPaymentStatus?: string
}

function mapSubscriptionToStatus(
  subscription: MercadoPagoSubscription,
  profile: BillingProfile,
  includesTrial: boolean
): SubscriptionState {
  const now = nowIso()
  const status = (subscription.status ?? "").toLowerCase()
  if (status === "cancelled" || status === "canceled") {
    return {
      status: BILLING_STATUS.CANCELLED,
      currentPeriodEndsAt: subscription.next_payment_date ?? profile.currentPeriodEndsAt,
      lastPaymentStatus: status,
    }
  }
  if (status === "paused" || status === "rejected") {
    return {
      status: BILLING_STATUS.PAST_DUE,
      graceUntil: addDays(now, billingConfig.graceDays),
      currentPeriodEndsAt: subscription.next_payment_date ?? profile.currentPeriodEndsAt,
      lastPaymentStatus: status,
    }
  }
  if (status === "authorized" || status === "active") {
    if (includesTrial && !profile.trialConsumedAt) {
      return {
        status: BILLING_STATUS.TRIAL,
        trialStartedAt: now,
        trialEndsAt: subscription.next_payment_date ?? addDays(now, billingConfig.trialDays),
        currentPeriodEndsAt: subscription.next_payment_date,
        lastPaymentStatus: status,
      }
    }
    return {
      status: BILLING_STATUS.ACTIVE,
      currentPeriodEndsAt: subscription.next_payment_date ?? profile.currentPeriodEndsAt,
      lastPaymentStatus: status,
    }
  }
  return { status: BILLING_STATUS.PENDING_SUBSCRIPTION, lastPaymentStatus: status || "unknown" }
}

export async function syncBillingFromSubscription(subscription: MercadoPagoSubscription) {
  const commerceId = subscription.external_reference
  if (!commerceId) throw new BadRequestError("Missing external_reference on Mercado Pago subscription")
  const profile = await getBillingProfile(commerceId)
  if (!profile) throw new NotFoundError(`Billing profile not found for commerce ${commerceId}`)

  const existingRecord = await getSubscriptionRecord(commerceId, subscription.id)
  const includesTrial = existingRecord?.includesTrial ?? subscription.preapproval_plan_id === billingConfig.planId
  const now = nowIso()
  const record: SubscriptionRecord = {
    ...subscriptionKey(commerceId, subscription.id),
    type: "BILLING_SUBSCRIPTION",
    commerceId,
    subscriptionId: subscription.id,
    planId: subscription.preapproval_plan_id ?? existingRecord?.planId ?? profile.mercadoPagoPlanId,
    payerEmail: subscription.payer_email ?? existingRecord?.payerEmail ?? profile.billingPayerEmail ?? "",
    status: subscription.status ?? "unknown",
    includesTrial,
    checkoutUrl: subscription.init_point ?? existingRecord?.checkoutUrl,
    createdAt: existingRecord?.createdAt ?? now,
    updatedAt: now,
  }
  await putItem(record)

  if (profile.currentSubscriptionId && profile.currentSubscriptionId !== subscription.id) {
    return profile
  }

  const next = mapSubscriptionToStatus(subscription, profile, includesTrial)
  const updated: BillingProfile = {
    ...profile,
    status: next.status,
    currentSubscriptionId: subscription.id,
    mercadoPagoSubscriptionId: subscription.id,
    mercadoPagoPlanId: record.planId,
    billingPayerEmail: record.payerEmail,
    trialConsumedAt:
      next.status === BILLING_STATUS.TRIAL ? profile.trialConsumedAt ?? now : profile.trialConsumedAt,
    trialStartedAt: next.trialStartedAt ?? profile.trialStartedAt,
    trialEndsAt: next.trialEndsAt ?? profile.trialEndsAt,
    currentPeriodEndsAt: next.currentPeriodEndsAt ?? profile.currentPeriodEndsAt,
    graceUntil: next.graceUntil ?? profile.graceUntil,
    lastPaymentStatus: next.lastPaymentStatus,
    lastWebhookAt: now,
    updatedAt: now,
  }
  await putItem(updated)
  await updateCognitoAttributes({ username: profile.ownerEmail, status: updated.status })
  return updated
}

async function syncBillingFromPayment(payment: MercadoPagoPayment) {
  if (!payment.preapproval_id) return { ignored: true as const }
  const subscription = await getMpClient().getSubscription(payment.preapproval_id)
  const profile = await syncBillingFromSubscription(subscription)
  if (payment.status === "rejected" && "commerceId" in profile) {
    const updated: BillingProfile = {
      ...profile,
      status: BILLING_STATUS.PAST_DUE,
      graceUntil: addDays(nowIso(), billingConfig.graceDays),
      lastPaymentStatus: payment.status,
      updatedAt: nowIso(),
    }
    await putItem(updated)
    await updateCognitoAttributes({ username: profile.ownerEmail, status: updated.status })
    return updated
  }
  return profile
}

export async function getProtectedBillingStatus(commerceId: string): Promise<BillingStatusResponse | null> {
  const profile = await getBillingProfile(commerceId)
  if (!profile) return null
  const current = profile.currentSubscriptionId
    ? await getSubscriptionRecord(commerceId, profile.currentSubscriptionId)
    : null
  return {
    commerceId,
    merchantName: profile.merchantName,
    status: profile.status,
    trialConsumed: !!profile.trialConsumedAt,
    trialEndsAt: profile.trialEndsAt,
    currentPeriodEndsAt: profile.currentPeriodEndsAt,
    graceUntil: profile.graceUntil,
    lastPaymentStatus: profile.lastPaymentStatus,
    checkoutUrl: current?.status === "pending" ? current.checkoutUrl : undefined,
    billingPayerEmail: profile.billingPayerEmail,
  }
}

export async function cancelBilling(commerceId: string) {
  const profile = await getBillingProfile(commerceId)
  if (!profile) throw new NotFoundError("Billing profile not found")
  if (!profile.currentSubscriptionId) throw new BadRequestError("Missing Mercado Pago subscription id")
  const cancelled = await getMpClient().cancelSubscription(profile.currentSubscriptionId)
  return syncBillingFromSubscription({ ...cancelled, external_reference: commerceId })
}

function webhookId(input: { eventId?: string | null; requestId?: string | null; dataId?: string | null }) {
  return input.eventId ?? input.requestId ?? input.dataId ?? randomUUID()
}

export async function processMercadoPagoWebhook(input: {
  eventId?: string | null
  requestId?: string | null
  eventType?: string | null
  dataId?: string | null
  topic?: string | null
  action?: string | null
}) {
  const eventId = webhookId(input)
  const existing = await getItem<WebhookEventRecord>(webhookEventKey(eventId))
  if (existing) return { duplicate: true }

  const mp = getMpClient()
  let result: unknown = { ignored: true }
  if (input.topic === "payment" && input.dataId) {
    result = await syncBillingFromPayment(await mp.getPayment(input.dataId))
  } else if (input.dataId) {
    result = await syncBillingFromSubscription(await mp.getSubscription(input.dataId))
  }

  const event: WebhookEventRecord = {
    ...webhookEventKey(eventId),
    type: "MP_WEBHOOK_EVENT",
    eventId,
    eventType: input.eventType ?? input.topic ?? input.action ?? "unknown",
    paymentId: input.topic === "payment" ? input.dataId ?? undefined : undefined,
    subscriptionId: input.topic !== "payment" ? input.dataId ?? undefined : undefined,
    processedAt: nowIso(),
    rawRequestId: input.requestId ?? undefined,
  }
  try {
    await putItem(event, true)
  } catch (error: any) {
    if (error?.name === "ConditionalCheckFailedException") return { duplicate: true }
    throw error
  }
  return { duplicate: false, result }
}
