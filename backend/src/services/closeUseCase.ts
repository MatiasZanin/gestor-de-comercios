import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { BadRequestError } from '../helpers/errors';
import { logAudit } from '../helpers/auditLogger';
import { CashClose } from '../models/cashClose';
import { Sale } from '../models/sale';
import { computeCashCloseTotals } from './domain';
import { formatArtDay, startOfArtDayIso } from './time';

export interface CloseRegisterInput {
  commerceId: string;
  userId: string;
  userEmail?: string;
  declaredCash: number;
  expenses: number;
  initialFund: number;
  notes?: string;
  closedAt?: string;
  auditAt?: string;
  closureId?: string;
  auditId?: string;
}

async function fetchLastClosure(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  commerceId: string
): Promise<CashClose | undefined> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ConsistentRead: true,
      ExpressionAttributeValues: {
        ':pk': `COM#${commerceId}`,
        ':prefix': 'CLOSE#',
      },
      ScanIndexForward: false,
      Limit: 1,
    })
  );

  return (result.Items?.[0] as CashClose | undefined) ?? undefined;
}

async function fetchSalesForWindow(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  commerceId: string,
  openedAt: string,
  closedAt: string
): Promise<Sale[]> {
  const sales: Sale[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND SK BETWEEN :startSk AND :endSk',
        ConsistentRead: true,
        ExpressionAttributeValues: {
          ':pk': `COM#${commerceId}`,
          ':startSk': `SALE#${openedAt}`,
          ':endSk': `SALE#${closedAt}~`,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (result.Items) {
      sales.push(...(result.Items as Sale[]));
    }
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return sales;
}

export async function closeRegisterUseCase(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  input: CloseRegisterInput
): Promise<CashClose> {
  if (typeof input.declaredCash !== 'number') {
    throw new BadRequestError('declaredCash is required and must be a number');
  }
  if (typeof input.expenses !== 'number') {
    throw new BadRequestError('expenses is required and must be a number');
  }
  if (typeof input.initialFund !== 'number') {
    throw new BadRequestError('initialFund is required and must be a number');
  }

  const closedAt = input.closedAt ?? new Date().toISOString();
  const closedDay = formatArtDay(closedAt);
  const lastClosure = await fetchLastClosure(docClient, tableName, input.commerceId);

  if (lastClosure && closedAt <= lastClosure.closedAt) {
    throw new BadRequestError('closedAt must be after the previous register close');
  }

  const openedAt = lastClosure
    ? lastClosure.closedAt
    : startOfArtDayIso(closedDay);

  const sales = await fetchSalesForWindow(docClient, tableName, input.commerceId, openedAt, closedAt);
  const totals = computeCashCloseTotals({
    sales,
    declaredCash: input.declaredCash,
    expenses: input.expenses,
    initialFund: input.initialFund,
  });

  const closureId = input.closureId ?? randomUUID();
  const cashClose: CashClose = {
    PK: `COM#${input.commerceId}`,
    SK: `CLOSE#${closedAt}#${closureId}`,
    GSI1PK: `COM#${input.commerceId}#${closedDay}`,
    GSI1SK: closedAt,
    closureId,
    commerceId: input.commerceId,
    userId: input.userId,
    openedAt,
    closedAt,
    systemTotalCash: totals.systemTotalCash,
    systemTotalCard: totals.systemTotalCard,
    systemTotalTransfer: totals.systemTotalTransfer,
    systemTotalOther: totals.systemTotalOther,
    declaredCash: input.declaredCash,
    expenses: input.expenses,
    initialFund: input.initialFund,
    difference: totals.difference,
    notes: input.notes,
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: cashClose,
    })
  );

  await logAudit(
    tableName,
    input.commerceId,
    input.userId,
    input.userEmail ?? '',
    'REGISTER_CLOSE',
    { difference: cashClose.difference, declaredCash: input.declaredCash },
    input.auditAt ?? closedAt,
    input.auditId
  );

  return cashClose;
}
