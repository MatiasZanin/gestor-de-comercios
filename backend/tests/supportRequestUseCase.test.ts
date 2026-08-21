const mockSesSend = jest.fn();
const mockLogAudit = jest.fn();
const userRepo = {
  getCommerceProfile: jest.fn(),
  getUserProfile: jest.fn(),
};

jest.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: jest.fn().mockImplementation(() => ({ send: mockSesSend })),
  SendEmailCommand: jest.fn().mockImplementation(input => ({ input })),
}));
jest.mock('../src/helpers/auditLogger', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));
jest.mock('../src/repositories/userRepository', () => userRepo);

import {
  sendSupportRequest,
  validateSupportRequest,
} from '../src/services/supportRequestUseCase';

const commerce = {
  PK: 'COM#commerce-1',
  SK: 'PROFILE',
  type: 'COMMERCE',
  commerceId: 'commerce-1',
  merchantName: 'Almacén Demo',
  ownerCognitoSub: 'owner-sub',
  ownerEmail: 'owner@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const user = {
  PK: 'COM#commerce-1',
  SK: 'USER#user-sub',
  type: 'COMMERCE_USER',
  commerceId: 'commerce-1',
  cognitoSub: 'user-sub',
  cognitoUsername: 'ana@example.com',
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: 'Pérez',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('support request use case', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TABLE_NAME = 'table';
    process.env.SUPPORT_EMAIL_FROM = 'verified@example.com';
    process.env.SUPPORT_EMAIL_TO = 'clientes@gestionystock.com';
    userRepo.getCommerceProfile.mockResolvedValue(commerce);
    userRepo.getUserProfile.mockResolvedValue(user);
    mockSesSend.mockResolvedValue({});
    mockLogAudit.mockResolvedValue(undefined);
  });

  it('validates and strips fields that do not correspond to the selected type', () => {
    expect(
      validateSupportRequest({
        title: 'Problema con usuario',
        problemType: 'USERS',
        saleTicketNumber: 'ticket-no-permitido',
        productCode: 'producto-no-permitido',
        description: 'No puedo cambiar los permisos del usuario seleccionado.',
      })
    ).toEqual({
      title: 'Problema con usuario',
      problemType: 'USERS',
      phone: undefined,
      saleTicketNumber: undefined,
      productCode: undefined,
      description: 'No puedo cambiar los permisos del usuario seleccionado.',
    });
  });

  it('rejects invalid categories, short descriptions and malformed phones', () => {
    expect(() =>
      validateSupportRequest({
        title: 'Ayuda',
        problemType: 'INVALID',
        description: 'Una descripción suficientemente larga',
      })
    ).toThrow('Tipo de problema inválido');
    expect(() =>
      validateSupportRequest({
        title: 'Ayuda',
        problemType: 'OTHER',
        description: 'Muy corta',
      })
    ).toThrow('al menos 20');
    expect(() =>
      validateSupportRequest({
        title: 'Ayuda',
        problemType: 'OTHER',
        phone: 'teléfono',
        description: 'Una descripción suficientemente larga',
      })
    ).toThrow('teléfono válido');
  });

  it('uses the fixed destination, exact subject, real profiles and the existing audit logger', async () => {
    const request = validateSupportRequest({
      title: 'No encuentro una venta',
      problemType: 'SALES',
      phone: '+54 11 5555-5555',
      saleTicketNumber: 'T-123',
      description:
        'La venta fue realizada pero no aparece en el listado de hoy.',
    });

    await sendSupportRequest(
      'commerce-1',
      { sub: 'user-sub', email: 'claim@example.com', role: 'admin' },
      request
    );

    const command = mockSesSend.mock.calls[0][0];
    expect(command.input.Destination.ToAddresses).toEqual([
      'clientes@gestionystock.com',
    ]);
    expect(command.input.Content.Simple.Subject.Data).toBe(
      'SOPORTE - No encuentro una venta'
    );
    expect(command.input.Content.Simple.Body.Text.Data).toContain(
      'Almacén Demo'
    );
    expect(command.input.Content.Simple.Body.Text.Data).toContain('Ana');
    expect(command.input.Content.Simple.Body.Text.Data).toContain('T-123');
    expect(mockLogAudit).toHaveBeenCalledWith(
      'table',
      'commerce-1',
      'user-sub',
      'ana@example.com',
      'SUPPORT_REQUEST_SENT',
      { title: 'No encuentro una venta', problemType: 'SALES' },
      expect.any(String),
      undefined,
      true
    );
  });

  it('does not audit or report success when email delivery fails', async () => {
    mockSesSend.mockRejectedValue(new Error('SES unavailable'));
    await expect(
      sendSupportRequest(
        'commerce-1',
        { sub: 'user-sub', email: 'ana@example.com' },
        validateSupportRequest({
          title: 'Error general',
          problemType: 'OTHER',
          description: 'La aplicación muestra un error inesperado al guardar.',
        })
      )
    ).rejects.toThrow('SES unavailable');
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});
