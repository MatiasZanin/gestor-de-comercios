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
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"
import { BadRequestError, ConflictError, NotFoundError } from "../helpers/errors"
import { addDays, billingConfig, BILLING_STATUS, nowIso, type BillingStatus } from "../config/billing"
import type {
  BillingProfile,
  BillingActionRecord,
  BillingCancellationRecord,
  BillingPayerLink,
  BillingSubscriptionLink,
  BillingStatusResponse,
  CancelSubscriptionResponse,
  CreateSubscriptionResponse,
  PublicBillingConfigResponse,
  PublicRegistrationRequest,
  PublicRegistrationResponse,
  RegistrationRecord,
  RegistrationStatusResponse,
  SubscriptionRecord,
  SubscriptionViewState,
  WebhookEventRecord,
} from "../models/billing"
import { DEFAULT_SCALE_BARCODE_CONFIG, type CommerceProfile } from "../models/commerce"
import type { CommerceUserProfile } from "../models/user"
import {
  MercadoPagoApiError,
  MercadoPagoClient,
  type MercadoPagoAuthorizedPayment,
  type MercadoPagoPayment,
  type MercadoPagoSubscription,
} from "./mercadoPagoClient"
import { enqueueCancellationFeedback } from "./cancellationFeedback"

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})
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
  return name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
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

function payerLinkKey(payerEmail: string) {
  const emailHash = createHash("sha256").update(normalizeEmail(payerEmail)).digest("hex")
  return { PK: `MP_PAYER#${emailHash}`, SK: "BILLING" as const }
}

function subscriptionKey(commerceId: string, subscriptionId: string) {
  return { PK: `COM#${commerceId}`, SK: `SUBSCRIPTION#${subscriptionId}` }
}

function subscriptionLinkKey(subscriptionId: string) {
  return { PK: `MP_SUBSCRIPTION#${subscriptionId}`, SK: "BILLING" as const }
}

function actionKey(commerceId: string, action: "subscribe", idempotencyKey: string) {
  const hash = createHash("sha256").update(idempotencyKey).digest("hex")
  return {
    PK: `COM#${commerceId}`,
    SK: `BILLING#ACTION#${action.toUpperCase()}#${hash}`,
  }
}

function cancellationKey(commerceId: string, idempotencyKey: string) {
  const hash = createHash("sha256").update(idempotencyKey).digest("hex")
  return { PK: `COM#${commerceId}`, SK: `BILLING#CANCELLATION#${hash}` }
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
      ...(createOnly
        ? {
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          }
        : {}),
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

async function listSubscriptionRecords(commerceId: string): Promise<SubscriptionRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: requireEnv("TABLE_NAME"),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `COM#${commerceId}`,
        ":prefix": "SUBSCRIPTION#",
      },
      ConsistentRead: true,
    })
  )
  return (result.Items ?? []) as SubscriptionRecord[]
}

async function listCancellationRecords(commerceId: string): Promise<BillingCancellationRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: requireEnv("TABLE_NAME"),
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `COM#${commerceId}`,
        ":prefix": "BILLING#CANCELLATION#",
      },
      ConsistentRead: true,
    })
  )
  return (result.Items ?? []).filter(item => item.type === "BILLING_CANCELLATION") as BillingCancellationRecord[]
}

function requireIdempotencyKey(value: string): string {
  const key = value.trim()
  if (key.length < 8 || key.length > 200) {
    throw new BadRequestError("Invalid Idempotency-Key")
  }
  return key
}

function actionTtl(): number {
  return Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60
}

function isActivatedSubscriptionStatus(status?: string): boolean {
  return ["authorized", "active"].includes((status ?? "").toLowerCase())
}

export function isTrialEligible(profile: BillingProfile, history: SubscriptionRecord[]): boolean {
  const hasTrialMarkers = Boolean(profile.trialConsumedAt || profile.trialStartedAt || profile.trialEndsAt)
  const hasActivatedSubscription = history.some(
    record => Boolean(record.activatedAt) || isActivatedSubscriptionStatus(record.status)
  )
  const currentlyActivated = profile.status === BILLING_STATUS.TRIAL || profile.status === BILLING_STATUS.ACTIVE
  return !hasTrialMarkers && !hasActivatedSubscription && !currentlyActivated
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
  const attributes: Array<{ Name: string; Value: string }> = [{ Name: "custom:accountStatus", Value: input.status }]
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

export async function createPublicRegistration(input: PublicRegistrationRequest): Promise<PublicRegistrationResponse> {
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
      scaleBarcodeConfig: DEFAULT_SCALE_BARCODE_CONFIG,
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
    const ownerUser: CommerceUserProfile = {
      PK: `COM#${commerceId}`,
      SK: `USER#${ownerCognitoSub}`,
      type: "COMMERCE_USER",
      commerceId,
      cognitoSub: ownerCognitoSub,
      cognitoUsername: email,
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      role: "admin",
      createdAt,
      updatedAt: createdAt,
    }
    await Promise.all([
      putItem({ ...registration, ownerCognitoSub }),
      putItem(commerce),
      putItem(billing),
      putItem(ownerUser),
    ])
  } catch (error) {
    // The durable registration makes a partial signup observable and recoverable.
    throw error
  }

  return {
    registrationId,
    status: registration.status,
    maskedEmail: maskEmail(email),
  }
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
  return {
    registrationId,
    status: updated.status,
    loginUrl: "/login?next=/suscripcion",
  }
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
  payerEmailInput: string,
  idempotencyKeyInput: string,
  mercadoPagoReturnUrl: string
): Promise<CreateSubscriptionResponse> {
  const idempotencyKey = requireIdempotencyKey(idempotencyKeyInput)
  const storedActionKey = actionKey(commerceId, "subscribe", idempotencyKey)
  const existingAction = await getItem<BillingActionRecord>(storedActionKey)
  if (existingAction?.status === "completed" && existingAction.response) {
    return existingAction.response
  }

  const actionStartedAt = nowIso()
  const action: BillingActionRecord = {
    ...storedActionKey,
    type: "BILLING_ACTION",
    commerceId,
    action: "subscribe",
    idempotencyKeyHash: storedActionKey.SK.split("#").at(-1) ?? "",
    status: "processing",
    createdAt: existingAction?.createdAt ?? actionStartedAt,
    updatedAt: actionStartedAt,
    ttl: existingAction?.ttl ?? actionTtl(),
  }
  await putItem(action)

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
      const response: CreateSubscriptionResponse = {
        checkoutUrl: current.checkoutUrl,
        status: BILLING_STATUS.PENDING_SUBSCRIPTION,
        includesTrial: current.includesTrial,
      }
      await putItem({
        ...action,
        status: "completed",
        response,
        updatedAt: nowIso(),
      })
      return response
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

  const history = await listSubscriptionRecords(commerceId)

  if (profile.pendingCheckoutUrl && profile.billingPayerEmail === payerEmail) {
    const response: CreateSubscriptionResponse = {
      checkoutUrl: profile.pendingCheckoutUrl,
      status: BILLING_STATUS.PENDING_SUBSCRIPTION,
      includesTrial: profile.pendingIncludesTrial ?? isTrialEligible(profile, history),
    }
    await putItem({
      ...action,
      status: "completed",
      response,
      updatedAt: nowIso(),
    })
    return response
  }

  const includesTrial = isTrialEligible(profile, history)
  const planId = includesTrial ? billingConfig.planId : billingConfig.reactivationPlanId
  if (!planId) {
    throw new Error(
      includesTrial ? "MERCADO_PAGO_PREAPPROVAL_PLAN_ID is required" : "MERCADO_PAGO_REACTIVATION_PLAN_ID is required"
    )
  }

  const now = nowIso()
  const payerKey = payerLinkKey(payerEmail)
  const existingPayerLink = await getItem<BillingPayerLink>(payerKey)
  if (existingPayerLink && existingPayerLink.commerceId !== commerceId) {
    throw new ConflictError("Ese email de Mercado Pago ya está asociado a otro comercio")
  }
  const payerLink: BillingPayerLink = {
    ...payerKey,
    type: "BILLING_PAYER_LINK",
    payerEmail,
    commerceId,
    createdAt: existingPayerLink?.createdAt ?? now,
    updatedAt: now,
  }

  let subscription: MercadoPagoSubscription
  try {
    subscription = await getMpClient().createSubscription({
      payerEmail,
      externalReference: commerceId,
      backUrl: mercadoPagoReturnUrl,
      idempotencyKey: createHash("sha256")
        .update(`${commerceId}:${idempotencyKey}:standalone-v1`)
        .digest("hex"),
      reason: billingConfig.planReason,
      transactionAmount: billingConfig.monthlyAmount,
      currencyId: billingConfig.currencyId,
      trialDays: includesTrial ? billingConfig.trialDays : undefined,
    })
  } catch (error) {
    await putItem({ ...action, status: "failed", updatedAt: nowIso() }).catch(() => undefined)
    throw error
  }
  if (!subscription.id || !subscription.init_point) {
    throw new Error("Mercado Pago did not return a subscription checkout URL")
  }
  if (subscription.preapproval_plan_id && subscription.preapproval_plan_id !== planId) {
    throw new BadRequestError("Mercado Pago created the subscription with an unexpected plan")
  }
  if (subscription.external_reference && subscription.external_reference !== commerceId) {
    throw new BadRequestError("Mercado Pago created the subscription for an unexpected commerce")
  }

  const checkoutUrl = subscription.init_point
  const subscriptionRecord: SubscriptionRecord = {
    ...subscriptionKey(commerceId, subscription.id),
    type: "BILLING_SUBSCRIPTION",
    commerceId,
    subscriptionId: subscription.id,
    planId,
    payerEmail,
    status: subscription.status ?? "pending",
    includesTrial,
    checkoutUrl,
    createdAt: subscription.date_created ?? now,
    updatedAt: now,
  }
  const subscriptionLink: BillingSubscriptionLink = {
    ...subscriptionLinkKey(subscription.id),
    type: "BILLING_SUBSCRIPTION_LINK",
    subscriptionId: subscription.id,
    commerceId,
    createdAt: now,
    updatedAt: now,
  }
  const updatedProfile: BillingProfile = {
    ...profile,
    status: BILLING_STATUS.PENDING_SUBSCRIPTION,
    billingPayerEmail: payerEmail,
    mercadoPagoPlanId: planId,
    currentSubscriptionId: subscription.id,
    mercadoPagoSubscriptionId: subscription.id,
    pendingCheckoutUrl: checkoutUrl,
    pendingIncludesTrial: includesTrial,
    updatedAt: now,
  }
  await Promise.all([
    putItem(payerLink),
    putItem(subscriptionLink),
    putItem(subscriptionRecord),
    putItem(updatedProfile),
  ])
  await updateCognitoAttributes({
    username: profile.ownerEmail,
    status: updatedProfile.status,
  })

  const response: CreateSubscriptionResponse = {
    checkoutUrl,
    status: updatedProfile.status,
    includesTrial,
  }
  await putItem({
    ...action,
    status: "completed",
    response,
    updatedAt: nowIso(),
  })
  return response
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
  return {
    status: BILLING_STATUS.PENDING_SUBSCRIPTION,
    lastPaymentStatus: status || "unknown",
  }
}

async function resolveBillingProfileFromSubscription(subscription: MercadoPagoSubscription) {
  const link = await getItem<BillingSubscriptionLink>(subscriptionLinkKey(subscription.id))
  let profile = link?.commerceId ? await getBillingProfile(link.commerceId) : null
  const commerceId = subscription.external_reference ?? ""
  if (!profile && commerceId) profile = await getBillingProfile(commerceId)
  if (!profile && subscription.payer_email) {
    const payerLink = await getItem<BillingPayerLink>(payerLinkKey(subscription.payer_email))
    const linkedCommerceId = payerLink?.commerceId ?? ""
    profile = linkedCommerceId ? await getBillingProfile(linkedCommerceId) : null
  }
  return profile
}

async function resolveBillingProfileFromPayment(payment: MercadoPagoPayment) {
  const commerceId = payment.external_reference ?? ""
  let profile = commerceId ? await getBillingProfile(commerceId) : null
  if (!profile && payment.payer?.email) {
    const payerLink = await getItem<BillingPayerLink>(payerLinkKey(payment.payer.email))
    const linkedCommerceId = payerLink?.commerceId ?? ""
    profile = linkedCommerceId ? await getBillingProfile(linkedCommerceId) : null
  }
  return profile
}

async function syncBillingFromSubscriptionForProfile(
  subscription: MercadoPagoSubscription,
  profile: BillingProfile,
  source: "webhook" | "reconciliation" | "action" = "action"
) {
  if (
    profile.billingPayerEmail &&
    subscription.payer_email &&
    normalizeEmail(subscription.payer_email) !== normalizeEmail(profile.billingPayerEmail)
  ) {
    throw new BadRequestError("Mercado Pago payer does not match the pending checkout")
  }
  if (subscription.preapproval_plan_id && subscription.preapproval_plan_id !== profile.mercadoPagoPlanId) {
    throw new BadRequestError("Mercado Pago plan does not match the pending checkout")
  }

  const existingRecord = await getSubscriptionRecord(profile.commerceId, subscription.id)
  const includesTrial = existingRecord?.includesTrial ?? subscription.preapproval_plan_id === billingConfig.planId
  const payerEmail = subscription.payer_email?.trim() || existingRecord?.payerEmail || profile.billingPayerEmail || ""
  const now = nowIso()
  const subscriptionLink: BillingSubscriptionLink = {
    ...subscriptionLinkKey(subscription.id),
    type: "BILLING_SUBSCRIPTION_LINK",
    subscriptionId: subscription.id,
    commerceId: profile.commerceId,
    createdAt: existingRecord?.createdAt ?? now,
    updatedAt: now,
  }
  const record: SubscriptionRecord = {
    ...subscriptionKey(profile.commerceId, subscription.id),
    type: "BILLING_SUBSCRIPTION",
    commerceId: profile.commerceId,
    subscriptionId: subscription.id,
    planId: subscription.preapproval_plan_id ?? existingRecord?.planId ?? profile.mercadoPagoPlanId,
    payerEmail,
    status: subscription.status ?? "unknown",
    includesTrial,
    activatedAt: existingRecord?.activatedAt ?? (isActivatedSubscriptionStatus(subscription.status) ? now : undefined),
    checkoutUrl: subscription.init_point ?? existingRecord?.checkoutUrl,
    createdAt: existingRecord?.createdAt ?? now,
    updatedAt: now,
  }
  await Promise.all([putItem(record), putItem(subscriptionLink)])

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
    pendingCheckoutUrl: undefined,
    pendingIncludesTrial: undefined,
    trialConsumedAt: next.status === BILLING_STATUS.TRIAL ? (profile.trialConsumedAt ?? now) : profile.trialConsumedAt,
    trialStartedAt: next.trialStartedAt ?? profile.trialStartedAt,
    trialEndsAt: next.trialEndsAt ?? profile.trialEndsAt,
    currentPeriodEndsAt: next.currentPeriodEndsAt ?? profile.currentPeriodEndsAt,
    graceUntil: next.graceUntil ?? profile.graceUntil,
    lastPaymentStatus: next.lastPaymentStatus,
    lastWebhookAt: source === "webhook" ? now : profile.lastWebhookAt,
    lastReconciledAt: source === "reconciliation" ? now : profile.lastReconciledAt,
    updatedAt: now,
  }
  await putItem(updated)
  await updateCognitoAttributes({
    username: profile.ownerEmail,
    status: updated.status,
  })
  return updated
}

export async function syncBillingFromSubscription(
  subscription: MercadoPagoSubscription,
  source: "webhook" | "reconciliation" | "action" = "action"
) {
  const profile = await resolveBillingProfileFromSubscription(subscription)
  if (!profile) {
    const commerceId = subscription.external_reference ?? subscription.payer_email ?? ""
    throw new NotFoundError(`Billing profile not found for commerce ${commerceId}`)
  }
  return syncBillingFromSubscriptionForProfile(subscription, profile, source)
}

async function syncBillingFromPayment(payment: MercadoPagoPayment, source: "webhook" | "reconciliation" | "action") {
  const mp = getMpClient()
  let subscription: MercadoPagoSubscription | undefined
  if (payment.preapproval_id) {
    subscription = await mp.getSubscription(payment.preapproval_id)
  } else {
    // Subscription payments currently omit preapproval_id in /v1/payments.
    // The authorized-payments API provides the missing, unambiguous link.
    const authorizedPayments = await mp.searchAuthorizedPaymentsByPaymentId(payment.id)
    const authorizedPayment = newestAuthorizedPayment(authorizedPayments.results ?? [])
    if (authorizedPayment?.preapproval_id) {
      subscription = await mp.getSubscription(authorizedPayment.preapproval_id)
    }
  }

  const profile = subscription
    ? await resolveBillingProfileFromSubscription(subscription)
    : await resolveBillingProfileFromPayment(payment)
  if (!profile) return { ignored: true as const, reason: "missing_billing_context" }

  if (!subscription && profile.billingPayerEmail) {
    const search = await mp.searchSubscriptions({
      payerEmail: profile.billingPayerEmail,
      planId: profile.mercadoPagoPlanId,
    })
    subscription = newestSubscription(
      (search.results ?? []).filter(
        candidate =>
          candidate.preapproval_plan_id === profile.mercadoPagoPlanId &&
          (!candidate.payer_email ||
            normalizeEmail(candidate.payer_email) === normalizeEmail(profile.billingPayerEmail!))
      )
    )
  }
  if (!subscription) return { ignored: true as const, reason: "missing_preapproval_id" }
  const synced = await syncBillingFromSubscriptionForProfile(subscription, profile, source)
  if (payment.status === "rejected" && "commerceId" in synced) {
    const updated: BillingProfile = {
      ...synced,
      status: BILLING_STATUS.PAST_DUE,
      graceUntil: addDays(nowIso(), billingConfig.graceDays),
      lastPaymentStatus: payment.status,
      updatedAt: nowIso(),
    }
    await putItem(updated)
    await updateCognitoAttributes({
      username: synced.ownerEmail,
      status: updated.status,
    })
    return updated
  }
  return synced
}

async function syncBillingFromAuthorizedPayment(
  payment: MercadoPagoAuthorizedPayment,
  source: "webhook" | "reconciliation" | "action"
) {
  if (!payment.preapproval_id) return { ignored: true as const, reason: "missing_preapproval_id" }
  if (payment.payment?.id) {
    try {
      return await syncBillingFromPayment(await getMpClient().getPayment(String(payment.payment.id)), source)
    } catch (error) {
      if (!(error instanceof MercadoPagoApiError) || error.statusCode !== 404) throw error
    }
  }
  const subscription = await getMpClient().getSubscription(payment.preapproval_id)
  const profile = await resolveBillingProfileFromSubscription(subscription)
  if (!profile) return { ignored: true as const, reason: "missing_billing_context" }
  const synced = await syncBillingFromSubscriptionForProfile(subscription, profile, source)
  if (!("commerceId" in synced)) return synced

  return applyAuthorizedPaymentStatus(payment, synced)
}

async function applyAuthorizedPaymentStatus(
  payment: MercadoPagoAuthorizedPayment,
  profile: BillingProfile
): Promise<BillingProfile> {
  // The invoice status can be "scheduled" while the nested payment carries the
  // actual collection result (approved/rejected).
  const paymentStatus = (payment.payment?.status ?? payment.status ?? "unknown").toLowerCase()
  const failed = ["rejected", "cancelled", "canceled", "refunded", "charged_back"].includes(paymentStatus)
  const updated: BillingProfile = {
    ...profile,
    status: failed ? BILLING_STATUS.PAST_DUE : profile.status,
    graceUntil: failed ? addDays(nowIso(), billingConfig.graceDays) : profile.graceUntil,
    lastPaymentStatus: paymentStatus,
    updatedAt: nowIso(),
  }
  await putItem(updated)
  await updateCognitoAttributes({
    username: profile.ownerEmail,
    status: updated.status,
  })
  return updated
}

function reconciliationIsFresh(profile: BillingProfile) {
  if (!profile.lastReconciledAt) return false
  const intervalSeconds = Number(process.env.BILLING_RECONCILIATION_INTERVAL_SECONDS ?? "60")
  const intervalMs = Number.isFinite(intervalSeconds) ? Math.max(0, intervalSeconds) * 1000 : 300_000
  return Date.now() - new Date(profile.lastReconciledAt).getTime() < intervalMs
}

function newestSubscription(subscriptions: MercadoPagoSubscription[]) {
  return [...subscriptions].sort((left, right) => {
    const leftTime = new Date(left.last_modified ?? left.date_created ?? 0).getTime()
    const rightTime = new Date(right.last_modified ?? right.date_created ?? 0).getTime()
    return rightTime - leftTime
  })[0]
}

function newestAuthorizedPayment(payments: MercadoPagoAuthorizedPayment[]) {
  return [...payments].sort((left, right) => {
    const leftTime = new Date(left.last_modified ?? left.debit_date ?? left.date_created ?? 0).getTime()
    const rightTime = new Date(right.last_modified ?? right.debit_date ?? right.date_created ?? 0).getTime()
    return rightTime - leftTime
  })[0]
}

function dateIsFuture(value?: string): boolean {
  return !!value && new Date(value).getTime() >= Date.now()
}

export function deriveSubscriptionViewState(
  profile: BillingProfile,
  history: SubscriptionRecord[]
): SubscriptionViewState {
  if (profile.status === BILLING_STATUS.TRIAL) return "trial_active"
  if (profile.status === BILLING_STATUS.ACTIVE) return "active"
  if (isTrialEligible(profile, history)) {
    return profile.pendingCheckoutUrl || history.some(item => item.status.toLowerCase() === "pending")
      ? "checkout_pending"
      : "never_subscribed"
  }
  if (profile.status === BILLING_STATUS.PAST_DUE) {
    const paymentStatus = (profile.lastPaymentStatus ?? "").toLowerCase()
    return ["rejected", "cancelled", "canceled", "refunded", "charged_back"].includes(paymentStatus)
      ? "payment_rejected"
      : "payment_pending"
  }
  if (profile.status === BILLING_STATUS.CANCELLED) {
    if (dateIsFuture(profile.currentPeriodEndsAt)) return "cancellation_scheduled"
    const remoteStatus = (profile.lastPaymentStatus ?? "").toLowerCase()
    return ["cancelled", "canceled"].includes(remoteStatus) ? "cancelled" : "expired"
  }
  if (profile.pendingCheckoutUrl || history.some(item => item.status === "pending")) {
    return "checkout_pending"
  }
  const hasHistory = history.length > 0 || !!profile.currentSubscriptionId || !!profile.trialConsumedAt
  return hasHistory ? "expired" : "never_subscribed"
}

export function deriveRelevantBillingDate(
  profile: BillingProfile,
  viewState: SubscriptionViewState
): BillingStatusResponse["relevantDate"] {
  if (viewState === "trial_active" && profile.trialEndsAt) {
    return { kind: "trial_ends", value: profile.trialEndsAt }
  }
  if (viewState === "active" && profile.currentPeriodEndsAt) {
    return { kind: "renews", value: profile.currentPeriodEndsAt }
  }
  if (viewState === "cancellation_scheduled" && profile.currentPeriodEndsAt) {
    return { kind: "access_until", value: profile.currentPeriodEndsAt }
  }
  if ((viewState === "payment_pending" || viewState === "payment_rejected") && profile.graceUntil) {
    return { kind: "grace_until", value: profile.graceUntil }
  }
  if ((viewState === "cancelled" || viewState === "expired") && profile.currentPeriodEndsAt) {
    return { kind: "ended", value: profile.currentPeriodEndsAt }
  }
  return undefined
}

export async function reconcileBillingWithMercadoPago(
  profile: BillingProfile,
  options: { forceRefresh?: boolean } = {}
): Promise<BillingProfile> {
  if (!options.forceRefresh && reconciliationIsFresh(profile)) return profile

  const mp = getMpClient()
  let subscription: MercadoPagoSubscription | undefined
  if (profile.currentSubscriptionId) {
    subscription = await mp.getSubscription(profile.currentSubscriptionId)
  } else if (profile.billingPayerEmail) {
    const search = await mp.searchSubscriptions({
      payerEmail: profile.billingPayerEmail,
      planId: profile.mercadoPagoPlanId,
    })
    subscription = newestSubscription(
      (search.results ?? []).filter(
        candidate =>
          candidate.preapproval_plan_id === profile.mercadoPagoPlanId &&
          (!candidate.payer_email ||
            normalizeEmail(candidate.payer_email) === normalizeEmail(profile.billingPayerEmail!))
      )
    )
  }

  if (subscription) {
    const synced = await syncBillingFromSubscriptionForProfile(subscription, profile, "reconciliation")
    const payments = await mp.searchAuthorizedPayments(subscription.id)
    const latestPayment = newestAuthorizedPayment(payments.results ?? [])
    return latestPayment ? applyAuthorizedPaymentStatus(latestPayment, synced) : synced
  }

  const checked: BillingProfile = { ...profile, lastReconciledAt: nowIso() }
  await putItem(checked)
  return checked
}

export function buildBillingStatusResponse(input: {
  profile: BillingProfile
  commerce: Pick<CommerceProfile, "merchantName" | "ownerCognitoSub"> | null
  history: SubscriptionRecord[]
  current: SubscriptionRecord | null
  actorSub?: string
}): BillingStatusResponse {
  const { profile, commerce, history, current, actorSub } = input
  const canManageSubscription = !!actorSub && actorSub === commerce?.ownerCognitoSub
  const trialConsumed = !isTrialEligible(profile, history)
  const viewState = deriveSubscriptionViewState(profile, history)
  return {
    commerceId: profile.commerceId,
    merchantName: commerce?.merchantName?.trim() ?? "",
    status: profile.status,
    viewState,
    canManageSubscription,
    trialConsumed,
    trialEligible: !trialConsumed,
    relevantDate: deriveRelevantBillingDate(profile, viewState),
    trialEndsAt: profile.trialEndsAt,
    currentPeriodEndsAt: profile.currentPeriodEndsAt,
    graceUntil: profile.graceUntil,
    lastPaymentStatus: profile.lastPaymentStatus,
    checkoutUrl: canManageSubscription
      ? (profile.pendingCheckoutUrl ?? (current?.status === "pending" ? current.checkoutUrl : undefined))
      : undefined,
    billingPayerEmail: canManageSubscription ? profile.billingPayerEmail : undefined,
  }
}

export async function getProtectedBillingStatus(
  commerceId: string,
  options: { forceRefresh?: boolean; actorSub?: string } = {}
): Promise<BillingStatusResponse | null> {
  let profile = await getBillingProfile(commerceId)
  if (!profile) return null
  try {
    profile = await reconcileBillingWithMercadoPago(profile, options)
  } catch (error) {
    // Mercado Pago must not make profile reads unavailable. The webhook remains the primary path.
    console.warn("Mercado Pago billing reconciliation failed", {
      commerceId,
      error: error instanceof Error ? { name: error.name, message: error.message } : "unknown",
    })
  }
  const [commerce, history] = await Promise.all([
    getItem<CommerceProfile>(commerceKey(commerceId)),
    listSubscriptionRecords(commerceId),
  ])
  const current = profile.currentSubscriptionId
    ? await getSubscriptionRecord(commerceId, profile.currentSubscriptionId)
    : null
  return buildBillingStatusResponse({
    profile,
    commerce,
    history,
    current,
    actorSub: options.actorSub,
  })
}

export async function reconcileBillingFromMercadoPagoReturn(preapprovalId: string) {
  const mp = getMpClient()
  const subscription = await mp.getSubscription(preapprovalId)
  const authorizedPayments = await mp.searchAuthorizedPayments(subscription.id)
  const authorizedPayment = newestAuthorizedPayment(authorizedPayments.results ?? [])
  const paymentId = authorizedPayment?.payment?.id

  if (paymentId !== undefined) {
    return syncBillingFromPayment(await mp.getPayment(String(paymentId)), "reconciliation")
  }

  return syncBillingFromSubscription(subscription, "reconciliation")
}

export function sanitizeCancellationReason(value: string): string {
  const reason = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
  if (!reason) throw new BadRequestError("Ingresá el motivo de la cancelación")
  if (reason.length > 1000) throw new BadRequestError("El motivo no puede superar los 1000 caracteres")
  return reason
}

export async function cancelBilling(input: {
  commerceId: string
  reason: string
  idempotencyKey: string
  actorSub: string
  actorEmail?: string
}): Promise<CancelSubscriptionResponse> {
  const { commerceId } = input
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKey)
  const reason = sanitizeCancellationReason(input.reason)
  const recordKey = cancellationKey(commerceId, idempotencyKey)
  const existing = await getItem<BillingCancellationRecord>(recordKey)
  if (existing?.status === "completed") {
    let notificationStatus = existing.notificationStatus
    if (notificationStatus === "pending" || notificationStatus === "failed") {
      try {
        notificationStatus = await enqueueCancellationFeedback(existing)
      } catch (error) {
        console.warn("Cancellation feedback remains pending", {
          commerceId,
          cancellationId: existing.cancellationId,
        })
      }
    }
    const billing = await getProtectedBillingStatus(commerceId, {
      forceRefresh: true,
      actorSub: input.actorSub,
    })
    if (!billing) throw new NotFoundError("Billing profile not found")
    return { billing, notificationStatus }
  }

  const profile = await getBillingProfile(commerceId)
  if (!profile) throw new NotFoundError("Billing profile not found")
  if (!profile.currentSubscriptionId) throw new BadRequestError("Missing Mercado Pago subscription id")

  const previousCancellation = (await listCancellationRecords(commerceId)).find(
    record => record.subscriptionId === profile.currentSubscriptionId && record.status === "completed"
  )
  if (previousCancellation) {
    let notificationStatus = previousCancellation.notificationStatus
    if (notificationStatus === "pending" || notificationStatus === "failed") {
      try {
        notificationStatus = await enqueueCancellationFeedback(previousCancellation)
      } catch (error) {
        console.warn("Cancellation feedback remains pending", {
          commerceId,
          cancellationId: previousCancellation.cancellationId,
        })
      }
    }
    const billing = await getProtectedBillingStatus(commerceId, {
      forceRefresh: true,
      actorSub: input.actorSub,
    })
    if (!billing) throw new NotFoundError("Billing profile not found")
    return { billing, notificationStatus }
  }

  const commerce = await getItem<CommerceProfile>(commerceKey(commerceId))
  if (!commerce) throw new NotFoundError("Commerce profile not found")

  const now = nowIso()
  const processing: BillingCancellationRecord = {
    ...recordKey,
    type: "BILLING_CANCELLATION",
    commerceId,
    cancellationId: existing?.cancellationId ?? randomUUID(),
    idempotencyKeyHash: recordKey.SK.split("#").at(-1) ?? "",
    status: "processing",
    notificationStatus: existing?.notificationStatus ?? "pending",
    subscriptionId: profile.currentSubscriptionId,
    merchantName: commerce.merchantName?.trim() ?? "",
    ownerEmail: commerce.ownerEmail,
    actorEmail: input.actorEmail,
    billingPayerEmail: profile.billingPayerEmail,
    reason,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ttl: existing?.ttl ?? actionTtl(),
  }
  if (existing) {
    await putItem(processing)
  } else {
    try {
      await putItem(processing, true)
    } catch (error) {
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
        throw new ConflictError("La cancelación ya está siendo procesada")
      }
      throw error
    }
  }

  try {
    if (profile.status !== BILLING_STATUS.CANCELLED) {
      const cancelled = await getMpClient().cancelSubscription(profile.currentSubscriptionId)
      await syncBillingFromSubscription({
        ...cancelled,
        external_reference: commerceId,
      })
    }
  } catch (error) {
    await putItem({
      ...processing,
      status: "failed",
      updatedAt: nowIso(),
    }).catch(() => undefined)
    throw error
  }

  const completed: BillingCancellationRecord = {
    ...processing,
    status: "completed",
    notificationStatus: "pending",
    cancelledAt: nowIso(),
    updatedAt: nowIso(),
  }
  await putItem(completed)

  let notificationStatus = completed.notificationStatus
  try {
    notificationStatus = await enqueueCancellationFeedback(completed)
  } catch (error) {
    console.warn("Cancellation feedback enqueue failed", {
      commerceId,
      cancellationId: completed.cancellationId,
      error: error instanceof Error ? error.message : "unknown",
    })
  }
  const billing = await getProtectedBillingStatus(commerceId, {
    forceRefresh: true,
    actorSub: input.actorSub,
  })
  if (!billing) throw new NotFoundError("Billing profile not found")
  return { billing, notificationStatus }
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
  const topic = (input.topic ?? "").toLowerCase()
  try {
    if (topic === "payment" && input.dataId) {
      result = await syncBillingFromPayment(await mp.getPayment(input.dataId), "webhook")
    } else if (topic === "subscription_authorized_payment" && input.dataId) {
      result = await syncBillingFromAuthorizedPayment(await mp.getAuthorizedPayment(input.dataId), "webhook")
    } else if (topic === "subscription_preapproval" && input.dataId) {
      result = await syncBillingFromSubscription(await mp.getSubscription(input.dataId), "webhook")
    }
  } catch (error) {
    if (!(error instanceof MercadoPagoApiError) || error.statusCode !== 404) throw error
    // Mercado Pago's URL simulator uses a synthetic data.id (123456). A valid,
    // signed test must be acknowledged even though that resource cannot be fetched.
    console.warn("Mercado Pago webhook resource was not found", {
      eventId,
      topic,
      dataId: input.dataId,
      path: error.path,
    })
    result = { ignored: true, reason: "resource_not_found" }
  }

  const event: WebhookEventRecord = {
    ...webhookEventKey(eventId),
    type: "MP_WEBHOOK_EVENT",
    eventId,
    eventType: input.eventType ?? input.topic ?? input.action ?? "unknown",
    paymentId: input.topic === "payment" ? (input.dataId ?? undefined) : undefined,
    subscriptionId: input.topic !== "payment" ? (input.dataId ?? undefined) : undefined,
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
