import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  TransactionalEmailMessage,
  TransactionalEmailRecord,
  TransactionalEmailTemplate,
} from '../models/transactionalEmail';

const sqs = new SQSClient({});
const ses = new SESv2Client({});
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const CONTACT_EMAIL = 'clientes@gestionystock.com';
const CONTACT_PHONE = '+54 11 3359-30078';
const CONTACT_WHATSAPP_URL = 'https://wa.me/5411335930078';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function baseUrl(): string {
  return env('FRONTEND_BASE_URL').replace(/\/+$/, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function notificationKey(notificationId: string) {
  return { PK: `EMAIL#${notificationId}`, SK: 'NOTIFICATION' as const };
}

function isConditionalConflict(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'ConditionalCheckFailedException'
  );
}

async function createNotification(
  notificationId: string,
  input: Omit<
    TransactionalEmailRecord,
    | 'PK'
    | 'SK'
    | 'type'
    | 'notificationId'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
  >
): Promise<void> {
  const now = new Date().toISOString();
  const record: TransactionalEmailRecord = {
    ...notificationKey(notificationId),
    type: 'TRANSACTIONAL_EMAIL',
    notificationId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  try {
    await documentClient.send(
      new PutCommand({
        TableName: env('TABLE_NAME'),
        Item: record,
        ConditionExpression:
          'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      })
    );
  } catch (error) {
    if (!isConditionalConflict(error)) throw error;
  }
}

export async function createWelcomeEmailNotification(input: {
  registrationId: string;
  email: string;
  firstName: string;
  merchantName: string;
}): Promise<void> {
  const appUrl = baseUrl();
  await createNotification(`WELCOME#${input.registrationId}`, {
    template: 'WELCOME',
    to: input.email,
    firstName: input.firstName,
    merchantName: input.merchantName,
    subscriptionUrl: `${appUrl}/suscripcion`,
    appUrl,
    logoUrl: `${appUrl}/logo.png`,
  });
}

export async function createTrialActivatedEmailNotification(input: {
  commerceId: string;
  email: string;
  firstName: string;
  merchantName: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
}): Promise<void> {
  const appUrl = baseUrl();
  await createNotification(`TRIAL_ACTIVATED#${input.commerceId}`, {
    template: 'TRIAL_ACTIVATED',
    to: input.email,
    firstName: input.firstName,
    merchantName: input.merchantName,
    appUrl,
    logoUrl: `${appUrl}/logo.png`,
    trialStartedAt: input.trialStartedAt,
    trialEndsAt: input.trialEndsAt,
  });
}

export async function enqueueTransactionalEmail(
  record: TransactionalEmailRecord
): Promise<void> {
  const message: TransactionalEmailMessage = {
    notificationId: record.notificationId,
    recordKey: { PK: record.PK, SK: record.SK },
  };
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: env('TRANSACTIONAL_EMAIL_QUEUE_URL'),
      MessageBody: JSON.stringify(message),
      MessageGroupId: record.notificationId,
      MessageDeduplicationId: record.notificationId,
    })
  );
  await documentClient.send(
    new UpdateCommand({
      TableName: env('TABLE_NAME'),
      Key: message.recordKey,
      UpdateExpression: 'SET #status = :queued, updatedAt = :updatedAt',
      ConditionExpression: '#status = :pending',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':pending': 'pending',
        ':queued': 'queued',
        ':updatedAt': new Date().toISOString(),
      },
    })
  );
}

function formattedDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date);
}

function button(label: string, url: string, secondary = false): string {
  const background = secondary ? '#ffffff' : '#009A61';
  const color = secondary ? '#007a4d' : '#ffffff';
  const border = secondary ? '1px solid #009A61' : '1px solid #009A61';
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td align="center" bgcolor="${background}" style="border:${border};border-radius:9px;"><a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;font-weight:700;color:${color};text-decoration:none;border-radius:9px;">${escapeHtml(label)}</a></td></tr></table>`;
}

function brandHeader(record: TransactionalEmailRecord): string {
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 24px 26px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding-right:12px;"><img src="${escapeHtml(record.logoUrl)}" width="44" height="44" alt="G&amp;S" style="display:block;width:44px;height:44px;border:0;border-radius:10px;" /></td><td style="font-family:Crimson,Georgia,'Times New Roman',serif;font-size:24px;line-height:28px;font-weight:600;white-space:nowrap;color:#B9040C;">Gestor <span style="color:#032F65;">de</span> Comercios</td></tr></table></td></tr></table>`;
}

function details(record: TransactionalEmailRecord): string {
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;"><tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#475569;"><strong style="color:#0f172a;">Comercio:</strong> ${escapeHtml(record.merchantName)}<br /><strong style="color:#0f172a;">Nombre:</strong> ${escapeHtml(record.firstName)}<br /><strong style="color:#0f172a;">Email:</strong> <a href="mailto:${escapeHtml(record.to)}" style="color:#007a4d;text-decoration:none;">${escapeHtml(record.to)}</a></td></tr></table>`;
}

function trialHighlight(): string {
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;"><tr><td align="center" style="padding:23px 20px;"><div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#047857;">Prueba gratuita</div><div style="padding-top:5px;font-family:Arial,Helvetica,sans-serif;font-size:25px;line-height:32px;font-weight:700;color:#065f46;">Tu primer mes es GRATIS</div><div style="padding-top:7px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#047857;">Usá todas las herramientas durante el primer mes sin costo.</div></td></tr></table>`;
}

function contactBlock(): string {
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;"><tr><td align="center" style="padding:24px 20px 4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#64748b;"><strong style="color:#334155;">¿Necesitás ayuda?</strong><br /><a href="mailto:${CONTACT_EMAIL}" style="color:#007a4d;text-decoration:underline;">${CONTACT_EMAIL}</a><span style="color:#cbd5e1;"> &nbsp;·&nbsp; </span><a href="${CONTACT_WHATSAPP_URL}" target="_blank" style="color:#007a4d;text-decoration:underline;">WhatsApp ${CONTACT_PHONE}</a></td></tr></table>`;
}

function shell(
  record: TransactionalEmailRecord,
  preheader: string,
  content: string
): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>Gestor de Comercios</title><style>@media only screen and (max-width:640px){.email-card{width:100%!important}.email-content{padding-left:22px!important;padding-right:22px!important}.mobile-title{font-size:27px!important;line-height:34px!important}}</style></head><body style="margin:0;padding:0;background-color:#f1f5f9;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;background:#f1f5f9;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="620" class="email-card" border="0" cellpadding="0" cellspacing="0" style="width:620px;max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,.08);">${brandHeader(record)}<tr><td class="email-content" style="padding:0 44px 36px;">${content}${contactBlock()}</td></tr></table><div style="padding:20px 16px 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#94a3b8;">© ${new Date().getUTCFullYear()} G&amp;S. Este es un email transaccional de Gestor de Comercios.</div></td></tr></table></body></html>`;
}

function welcomeHtml(record: TransactionalEmailRecord): string {
  const subscriptionUrl =
    record.subscriptionUrl ?? `${record.appUrl}/suscripcion`;
  return shell(
    record,
    `Tu comercio ${record.merchantName} ya fue creado. Activá tu primer mes gratis.`,
    `<h1 class="mobile-title" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:31px;line-height:39px;font-weight:700;color:#0f172a;">¡Bienvenido a Gestor de Comercios, ${escapeHtml(record.firstName)}!</h1><p style="margin:14px 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#475569;">Tu comercio <strong style="color:#0f172a;">${escapeHtml(record.merchantName)}</strong> ya fue creado correctamente.</p>${details(record)}<div style="height:22px;line-height:22px;">&nbsp;</div>${trialHighlight()}<p style="margin:22px 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#475569;">Para comenzar a utilizar Gestor de Comercios, terminá de activar tu suscripción mediante Mercado Pago. <strong style="color:#0f172a;">El primer mes no tiene costo</strong> y podés cancelar la suscripción cuando quieras.</p>${button('Activar mi mes gratis', subscriptionUrl)}<div style="height:30px;line-height:30px;">&nbsp;</div><h2 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:27px;color:#0f172a;">Acceso a Gestor de Comercios</h2><p style="margin:10px 0 17px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#475569;">Para ingresar utilizá el email y la contraseña con los que creaste tu cuenta. Por seguridad, nunca enviamos tu contraseña por email.</p>${button('Ir a Gestor de Comercios', record.appUrl, true)}<div style="height:28px;line-height:28px;">&nbsp;</div>`
  );
}

function trialActivatedHtml(record: TransactionalEmailRecord): string {
  const start = formattedDate(record.trialStartedAt);
  const end = formattedDate(record.trialEndsAt);
  const dates =
    start || end
      ? `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;"><tr><td style="padding:17px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#475569;">${start ? `<strong style="color:#0f172a;">Inicio de la prueba:</strong> ${escapeHtml(start)}<br />` : ''}${end ? `<strong style="color:#0f172a;">Fin estimado del período gratuito:</strong> ${escapeHtml(end)}` : ''}</td></tr></table><div style="height:22px;line-height:22px;">&nbsp;</div>`
      : '';
  return shell(
    record,
    `El período de prueba de ${record.merchantName} ya está activo.`,
    `<h1 class="mobile-title" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:31px;line-height:39px;font-weight:700;color:#0f172a;">Tu período de prueba ya está activo</h1><p style="margin:14px 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#475569;">¡Listo, ${escapeHtml(record.firstName)}! Mercado Pago confirmó correctamente la suscripción de <strong style="color:#0f172a;">${escapeHtml(record.merchantName)}</strong>. Ya podés utilizar Gestor de Comercios.</p>${details(record)}<div style="height:22px;line-height:22px;">&nbsp;</div>${dates}${trialHighlight()}<p style="margin:22px 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#475569;">El primer mes no tiene costo. La suscripción se administra mediante Mercado Pago y podés cancelarla cuando quieras.</p>${button('Ingresar a Gestor de Comercios', record.appUrl)}<p style="margin:18px 0 28px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#64748b;">Para iniciar sesión utilizá tu email y contraseña.</p>`
  );
}

function emailText(record: TransactionalEmailRecord): string {
  const common = [
    `Comercio: ${record.merchantName}`,
    `Nombre: ${record.firstName}`,
    `Email: ${record.to}`,
    '',
    'Tu primer mes es GRATIS.',
  ];
  if (record.template === 'WELCOME') {
    return [
      `¡Bienvenido a Gestor de Comercios, ${record.firstName}!`,
      `Tu comercio ${record.merchantName} ya fue creado correctamente.`,
      '',
      ...common,
      'Terminá de activar tu suscripción mediante Mercado Pago. Podés cancelarla cuando quieras.',
      `Activar mi mes gratis: ${record.subscriptionUrl ?? `${record.appUrl}/suscripcion`}`,
      '',
      `Ir a Gestor de Comercios: ${record.appUrl}`,
      'Para ingresar utilizá el email y la contraseña con los que creaste tu cuenta.',
      '',
      `Ayuda: ${CONTACT_EMAIL} | WhatsApp ${CONTACT_PHONE}: ${CONTACT_WHATSAPP_URL}`,
    ].join('\n');
  }
  const start = formattedDate(record.trialStartedAt);
  const end = formattedDate(record.trialEndsAt);
  return [
    `Tu período de prueba ya está activo, ${record.firstName}.`,
    `Mercado Pago confirmó correctamente la suscripción de ${record.merchantName}.`,
    '',
    ...common,
    ...(start ? [`Inicio de la prueba: ${start}`] : []),
    ...(end ? [`Fin estimado del período gratuito: ${end}`] : []),
    'Ya podés utilizar Gestor de Comercios y cancelar la suscripción cuando quieras.',
    `Ingresar a Gestor de Comercios: ${record.appUrl}`,
    'Para iniciar sesión utilizá tu email y contraseña.',
    '',
    `Ayuda: ${CONTACT_EMAIL} | WhatsApp ${CONTACT_PHONE}: ${CONTACT_WHATSAPP_URL}`,
  ].join('\n');
}

export function renderTransactionalEmail(record: TransactionalEmailRecord): {
  subject: string;
  html: string;
  text: string;
} {
  const template: Record<
    TransactionalEmailTemplate,
    { subject: string; html: () => string }
  > = {
    WELCOME: {
      subject: 'Bienvenido a Gestor de Comercios — activá tu mes gratis',
      html: () => welcomeHtml(record),
    },
    TRIAL_ACTIVATED: {
      subject: 'Tu período de prueba ya está activo',
      html: () => trialActivatedHtml(record),
    },
  };
  return {
    subject: template[record.template].subject,
    html: template[record.template].html(),
    text: emailText(record),
  };
}

export async function deliverTransactionalEmail(
  message: TransactionalEmailMessage
): Promise<void> {
  const result = await documentClient.send(
    new GetCommand({
      TableName: env('TABLE_NAME'),
      Key: message.recordKey,
      ConsistentRead: true,
    })
  );
  const record = result.Item as TransactionalEmailRecord | undefined;
  if (
    !record ||
    record.type !== 'TRANSACTIONAL_EMAIL' ||
    record.status === 'sent'
  )
    return;
  const rendered = renderTransactionalEmail(record);
  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: env('TRANSACTIONAL_EMAIL_FROM'),
        Destination: { ToAddresses: [record.to] },
        ReplyToAddresses: [CONTACT_EMAIL],
        Content: {
          Simple: {
            Subject: { Data: rendered.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: rendered.html, Charset: 'UTF-8' },
              Text: { Data: rendered.text, Charset: 'UTF-8' },
            },
          },
        },
      })
    );
    await documentClient.send(
      new UpdateCommand({
        TableName: env('TABLE_NAME'),
        Key: message.recordKey,
        UpdateExpression: 'SET #status = :sent, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':sent': 'sent',
          ':updatedAt': new Date().toISOString(),
        },
      })
    );
  } catch (error) {
    await documentClient
      .send(
        new UpdateCommand({
          TableName: env('TABLE_NAME'),
          Key: message.recordKey,
          UpdateExpression: 'SET #status = :failed, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':failed': 'failed',
            ':updatedAt': new Date().toISOString(),
          },
        })
      )
      .catch(() => undefined);
    throw error;
  }
}
