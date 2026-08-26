import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { TransactionalEmailRecord } from '../src/models/transactionalEmail';

const mockSqsSend = jest.fn();
const mockSesSend = jest.fn();
const mockDynamoSend = jest.fn();

jest.mock('@aws-sdk/client-sqs', () => {
  const actual = jest.requireActual('@aws-sdk/client-sqs');
  return { ...actual, SQSClient: jest.fn(() => ({ send: mockSqsSend })) };
});

jest.mock('@aws-sdk/client-sesv2', () => {
  const actual = jest.requireActual('@aws-sdk/client-sesv2');
  return { ...actual, SESv2Client: jest.fn(() => ({ send: mockSesSend })) };
});

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDynamoSend })) },
  };
});

import {
  createTrialActivatedEmailNotification,
  createWelcomeEmailNotification,
  deliverTransactionalEmail,
  enqueueTransactionalEmail,
  renderTransactionalEmail,
} from '../src/services/transactionalEmail';

function record(
  template: TransactionalEmailRecord['template']
): TransactionalEmailRecord {
  return {
    PK: `EMAIL#${template}`,
    SK: 'NOTIFICATION',
    type: 'TRANSACTIONAL_EMAIL',
    notificationId: template,
    template,
    status: 'queued',
    to: 'ana@example.com',
    firstName: 'Ana',
    merchantName: 'Almacén & Amigos',
    subscriptionUrl: 'https://comercios.gestionystock.com/suscripcion',
    appUrl: 'https://comercios.gestionystock.com',
    logoUrl: 'https://comercios.gestionystock.com/logo.png',
    trialStartedAt: '2026-08-25T12:00:00.000Z',
    trialEndsAt: '2026-09-24T12:00:00.000Z',
    createdAt: '2026-08-25T12:00:00.000Z',
    updatedAt: '2026-08-25T12:00:00.000Z',
  };
}

describe('transactional emails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TABLE_NAME = 'table';
    process.env.FRONTEND_BASE_URL = 'https://comercios.gestionystock.com/';
    process.env.TRANSACTIONAL_EMAIL_FROM = 'clientes@gestionystock.com';
    process.env.TRANSACTIONAL_EMAIL_QUEUE_URL =
      'https://sqs.test/transactional.fifo';
  });

  it('renders a responsive, branded welcome email with dynamic account and checkout data', () => {
    const rendered = renderTransactionalEmail(record('WELCOME'));

    expect(rendered.subject).toContain('activá tu mes gratis');
    expect(rendered.html).toContain('<meta name="viewport"');
    expect(rendered.html).toContain(
      'https://comercios.gestionystock.com/logo.png'
    );
    expect(rendered.html).toContain('color:#B9040C;">Gestor');
    expect(rendered.html).toContain('color:#032F65;">de</span> Comercios');
    expect(rendered.html).toContain('Tu primer mes es GRATIS');
    expect(rendered.html).toContain('Activar mi mes gratis');
    expect(rendered.html).toContain(
      'https://comercios.gestionystock.com/suscripcion'
    );
    expect(rendered.html).toContain('mailto:clientes@gestionystock.com');
    expect(rendered.html).toContain('https://wa.me/5411335930078');
    expect(rendered.html).toContain('Almacén &amp; Amigos');
    expect(rendered.html).not.toContain('confirmPassword');
    expect(rendered.text).not.toMatch(/contraseña:\s*\S+/i);
  });

  it('renders only reliable trial dates in the activation email', () => {
    const rendered = renderTransactionalEmail(record('TRIAL_ACTIVATED'));

    expect(rendered.subject).toBe('Tu período de prueba ya está activo');
    expect(rendered.html).toContain('Mercado Pago confirmó correctamente');
    expect(rendered.html).toContain('25 de agosto de 2026');
    expect(rendered.html).toContain('24 de septiembre de 2026');
    expect(rendered.html).toContain('Ingresar a Gestor de Comercios');
    expect(rendered.text).toContain(
      'Para iniciar sesión utilizá tu email y contraseña.'
    );
  });

  it('creates deterministic outbox records using the app subscription route', async () => {
    mockDynamoSend.mockResolvedValue({});

    await createWelcomeEmailNotification({
      registrationId: 'registration-1',
      email: 'ana@example.com',
      firstName: 'Ana',
      merchantName: 'Almacén Demo',
    });
    await createTrialActivatedEmailNotification({
      commerceId: 'commerce-1',
      email: 'ana@example.com',
      firstName: 'Ana',
      merchantName: 'Almacén Demo',
    });

    const welcome = mockDynamoSend.mock.calls[0][0];
    const activation = mockDynamoSend.mock.calls[1][0];
    expect(welcome).toBeInstanceOf(PutCommand);
    expect(welcome.input.Item).toMatchObject({
      PK: 'EMAIL#WELCOME#registration-1',
      status: 'pending',
      subscriptionUrl: 'https://comercios.gestionystock.com/suscripcion',
    });
    expect(activation.input.Item).toMatchObject({
      PK: 'EMAIL#TRIAL_ACTIVATED#commerce-1',
      template: 'TRIAL_ACTIVATED',
    });
  });

  it('queues the outbox once and marks it queued', async () => {
    mockSqsSend.mockResolvedValue({ MessageId: 'message-1' });
    mockDynamoSend.mockResolvedValue({});

    await enqueueTransactionalEmail(record('WELCOME'));

    expect(mockSqsSend.mock.calls[0][0]).toBeInstanceOf(SendMessageCommand);
    expect(mockSqsSend.mock.calls[0][0].input).toMatchObject({
      MessageGroupId: 'WELCOME',
      MessageDeduplicationId: 'WELCOME',
    });
    expect(mockDynamoSend.mock.calls[0][0]).toBeInstanceOf(UpdateCommand);
  });

  it('delivers multipart HTML/text through SES and marks success', async () => {
    mockDynamoSend
      .mockResolvedValueOnce({ Item: record('WELCOME') })
      .mockResolvedValueOnce({});
    mockSesSend.mockResolvedValue({ MessageId: 'ses-1' });

    await deliverTransactionalEmail({
      notificationId: 'WELCOME',
      recordKey: { PK: 'EMAIL#WELCOME', SK: 'NOTIFICATION' },
    });

    expect(mockDynamoSend.mock.calls[0][0]).toBeInstanceOf(GetCommand);
    const command = mockSesSend.mock.calls[0][0];
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect(command.input.Destination.ToAddresses).toEqual(['ana@example.com']);
    expect(command.input.Content.Simple.Body.Html.Data).toContain(
      'Activar mi mes gratis'
    );
    expect(command.input.Content.Simple.Body.Text.Data).toContain(
      'Tu primer mes es GRATIS'
    );
    expect(
      mockDynamoSend.mock.calls[1][0].input.ExpressionAttributeValues
    ).toMatchObject({
      ':sent': 'sent',
    });
  });

  it('does not resend a notification already marked sent', async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { ...record('WELCOME'), status: 'sent' },
    });

    await deliverTransactionalEmail({
      notificationId: 'WELCOME',
      recordKey: { PK: 'EMAIL#WELCOME', SK: 'NOTIFICATION' },
    });

    expect(mockSesSend).not.toHaveBeenCalled();
  });
});
