import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { logAudit } from '../helpers/auditLogger';
import { BadRequestError, NotFoundError } from '../helpers/errors';
import {
  SUPPORT_PROBLEM_TYPES,
  SUPPORT_PROBLEM_TYPE_LABELS,
  type CreateSupportRequest,
  type SupportProblemType,
  type SupportRequestActor,
  type SupportRequestResponse,
} from '../models/support';
import {
  getCommerceProfile,
  getUserProfile,
} from '../repositories/userRepository';

const ses = new SESv2Client({});

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required`);
  return value;
}

function cleanString(
  value: unknown,
  field: string,
  min: number,
  max: number
): string {
  if (typeof value !== 'string')
    throw new BadRequestError(`${field} es obligatorio`);
  const clean = value.trim();
  if (clean.length < min)
    throw new BadRequestError(`${field} debe tener al menos ${min} caracteres`);
  if (clean.length > max)
    throw new BadRequestError(
      `${field} no puede superar los ${max} caracteres`
    );
  return clean;
}

function optionalString(
  value: unknown,
  field: string,
  max: number
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string')
    throw new BadRequestError(`${field} debe ser texto`);
  const clean = value.trim();
  if (!clean) return undefined;
  if (clean.length > max)
    throw new BadRequestError(
      `${field} no puede superar los ${max} caracteres`
    );
  return clean;
}

function validateProblemType(value: unknown): SupportProblemType {
  if (
    typeof value !== 'string' ||
    !SUPPORT_PROBLEM_TYPES.includes(value as SupportProblemType)
  ) {
    throw new BadRequestError('Tipo de problema inválido');
  }
  return value as SupportProblemType;
}

export function validateSupportRequest(
  input: Record<string, unknown>
): CreateSupportRequest {
  const allowed = [
    'title',
    'problemType',
    'phone',
    'saleTicketNumber',
    'productCode',
    'description',
  ];
  const unexpected = Object.keys(input).filter(
    field => !allowed.includes(field)
  );
  if (unexpected.length)
    throw new BadRequestError(`Campos no permitidos: ${unexpected.join(', ')}`);

  const problemType = validateProblemType(input.problemType);
  const phone = optionalString(input.phone, 'Número de teléfono', 30);
  if (
    phone &&
    (!/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 6)
  ) {
    throw new BadRequestError('Ingresá un número de teléfono válido');
  }

  const title = cleanString(input.title, 'Título', 3, 120);
  if (/[\r\n]/.test(title))
    throw new BadRequestError('El título no puede contener saltos de línea');

  return {
    title,
    problemType,
    phone,
    saleTicketNumber:
      problemType === 'SALES'
        ? optionalString(input.saleTicketNumber, 'Número de ticket', 100)
        : undefined,
    productCode:
      problemType === 'PRODUCTS'
        ? optionalString(input.productCode, 'Código del producto', 100)
        : undefined,
    description: cleanString(input.description, 'Descripción', 20, 5000),
  };
}

function supportEmailText(input: {
  request: CreateSupportRequest;
  actor: SupportRequestActor;
  user: Awaited<ReturnType<typeof getUserProfile>>;
  commerce: NonNullable<Awaited<ReturnType<typeof getCommerceProfile>>>;
  sentAt: string;
}): string {
  const { request, actor, user, commerce, sentAt } = input;
  return [
    'Nueva solicitud de soporte desde Gestión & Stock',
    '',
    'SOLICITUD',
    `Título: ${request.title}`,
    `Tipo de problema: ${SUPPORT_PROBLEM_TYPE_LABELS[request.problemType]}`,
    `Teléfono: ${request.phone || 'No informado'}`,
    ...(request.saleTicketNumber
      ? [`Número de ticket: ${request.saleTicketNumber}`]
      : []),
    ...(request.productCode
      ? [`Código del producto: ${request.productCode}`]
      : []),
    `Fecha y hora: ${sentAt}`,
    '',
    'Descripción:',
    request.description,
    '',
    'USUARIO',
    `ID: ${actor.sub}`,
    `Nombre: ${user?.firstName || 'No disponible'}`,
    `Apellido: ${user?.lastName || 'No disponible'}`,
    `Email: ${user?.email || actor.email || 'No disponible'}`,
    `Rol: ${user?.role || actor.role || 'No disponible'}`,
    `Usuario de Cognito: ${user?.cognitoUsername || 'No disponible'}`,
    '',
    'COMERCIO',
    `ID: ${commerce.commerceId}`,
    `Nombre: ${commerce.merchantName || 'No disponible'}`,
    `Email del propietario: ${commerce.ownerEmail || 'No disponible'}`,
    `ID del propietario: ${commerce.ownerCognitoSub || 'No disponible'}`,
  ].join('\n');
}

export async function sendSupportRequest(
  commerceId: string,
  actor: SupportRequestActor,
  request: CreateSupportRequest
): Promise<SupportRequestResponse> {
  const [commerce, user] = await Promise.all([
    getCommerceProfile(commerceId),
    getUserProfile(commerceId, actor.sub),
  ]);
  if (!commerce) throw new NotFoundError('No se encontró el comercio asociado');

  const sentAt = new Date().toISOString();
  const userEmail = user?.email || actor.email;
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: requiredEnv('SUPPORT_EMAIL_FROM'),
      Destination: { ToAddresses: [requiredEnv('SUPPORT_EMAIL_TO')] },
      ReplyToAddresses: userEmail ? [userEmail] : undefined,
      Content: {
        Simple: {
          Subject: { Data: `SOPORTE - ${request.title}`, Charset: 'UTF-8' },
          Body: {
            Text: {
              Data: supportEmailText({
                request,
                actor,
                user,
                commerce,
                sentAt,
              }),
              Charset: 'UTF-8',
            },
          },
        },
      },
    })
  );

  await logAudit(
    requiredEnv('TABLE_NAME'),
    commerceId,
    actor.sub,
    userEmail,
    'SUPPORT_REQUEST_SENT',
    { title: request.title, problemType: request.problemType },
    sentAt,
    undefined,
    true
  );

  return { message: 'Solicitud enviada', sentAt };
}
