import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { closeRegisterUseCase } from '../../../services/closeUseCase';
import { computeCashCloseTotals } from '../../../services/domain';
import { Sale } from '../../../models/sale';
import { startOfArtDayIso } from '../../../services/time';
import {
  cleanAuditItemsByAction,
  cleanCommerceItems,
  queryAllCommerceItems,
} from './runtime';
import { buildSeedClosures, closureIso } from './scenario';
import { deterministicId, SEED_CONFIG } from './shared';

const TABLE_NAME = process.env.TABLE_NAME || 'GestionComercios-dev';
const COMMERCE_ID = SEED_CONFIG.commerceId;
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function cleanSeedArtifacts(): Promise<void> {
  await cleanCommerceItems(docClient, TABLE_NAME, COMMERCE_ID, 'CLOSE#');
  await cleanAuditItemsByAction(docClient, TABLE_NAME, COMMERCE_ID, ['REGISTER_CLOSE']);
}

function selectWindowSales(sales: Sale[], openedAt: string, closedAt: string): Sale[] {
  return sales.filter((sale) => sale.createdAt > openedAt && sale.createdAt <= closedAt);
}

async function main(): Promise<void> {
  console.log(`Seeding register closures for COM#${COMMERCE_ID}`);
  await cleanSeedArtifacts();

  const allSales = (await queryAllCommerceItems(docClient, TABLE_NAME, COMMERCE_ID, 'SALE#')) as Sale[];
  const closures = buildSeedClosures(SEED_CONFIG.salesStartDay, SEED_CONFIG.salesEndDay).sort((a, b) =>
    closureIso(a).localeCompare(closureIso(b))
  );

  if (closures.length === 0) {
    console.log('No closure templates configured.');
    return;
  }

  let openedAt = startOfArtDayIso(closures[0].day);

  for (const [index, template] of closures.entries()) {
    const closedAt = closureIso(template);
    const windowSales = selectWindowSales(allSales, openedAt, closedAt);
    const expectedCash = computeCashCloseTotals({
      sales: windowSales,
      declaredCash: 0,
      expenses: template.expenses,
      initialFund: template.initialFund,
    }).expectedCash;
    const declaredCash = expectedCash + template.difference;

    await closeRegisterUseCase(docClient, TABLE_NAME, {
      commerceId: COMMERCE_ID,
      userId: SEED_CONFIG.seedActorId,
      userEmail: SEED_CONFIG.seedActorEmail,
      declaredCash,
      expenses: template.expenses,
      initialFund: template.initialFund,
      notes: template.notes,
      closedAt,
      auditAt: closedAt,
      closureId: deterministicId('closure', index, closedAt),
      auditId: deterministicId('audit-register-close', index, closedAt),
    });

    openedAt = closedAt;
  }

  console.log(`Created ${closures.length} deterministic cash closes.`);
}

main().catch((error) => {
  console.error('Closure seed failed:', error);
  process.exitCode = 1;
});
