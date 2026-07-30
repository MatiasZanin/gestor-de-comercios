import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { buildDailySummaryDelta, monthFromIso } from '../../../services/domain';
import { Sale } from '../../../models/sale';
import { formatArtDay } from '../../../services/time';
import {
  cleanCommerceItems,
  chunkArray,
  queryAllCommerceItems,
} from './runtime';
import { SEED_CONFIG } from './shared';

const TABLE_NAME = process.env.TABLE_NAME || 'GestionComercios-dev';
const COMMERCE_ID = SEED_CONFIG.commerceId;
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

interface DailySummaryAggregate {
  totalDay: number;
  txCount: number;
  method_CASH: number;
  method_CARD: number;
  method_TRANSFER: number;
  method_OTHER: number;
  h0: number;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
  h7: number;
  h8: number;
  h9: number;
  h10: number;
  h11: number;
  h12: number;
  h13: number;
  h14: number;
  h15: number;
  h16: number;
  h17: number;
  h18: number;
  h19: number;
  h20: number;
  h21: number;
  h22: number;
  h23: number;
}

interface MonthlyStatAggregate {
  code: string;
  name: string;
  uom: string;
  priceSale: number;
  monthlyUnits: number;
}

function createEmptySummary(): DailySummaryAggregate {
  return {
    totalDay: 0,
    txCount: 0,
    method_CASH: 0,
    method_CARD: 0,
    method_TRANSFER: 0,
    method_OTHER: 0,
    h0: 0,
    h1: 0,
    h2: 0,
    h3: 0,
    h4: 0,
    h5: 0,
    h6: 0,
    h7: 0,
    h8: 0,
    h9: 0,
    h10: 0,
    h11: 0,
    h12: 0,
    h13: 0,
    h14: 0,
    h15: 0,
    h16: 0,
    h17: 0,
    h18: 0,
    h19: 0,
    h20: 0,
    h21: 0,
    h22: 0,
    h23: 0,
  };
}

async function main(): Promise<void> {
  console.log(`Rebuilding sales reports for COM#${COMMERCE_ID}`);

  await cleanCommerceItems(docClient, TABLE_NAME, COMMERCE_ID, 'SUMMARY#');
  await cleanCommerceItems(docClient, TABLE_NAME, COMMERCE_ID, 'STAT#');

  const sales = (await queryAllCommerceItems(docClient, TABLE_NAME, COMMERCE_ID, 'SALE#')) as Sale[];
  if (sales.length === 0) {
    console.log('No sales found. Nothing to aggregate.');
    return;
  }

  const summaries = new Map<string, DailySummaryAggregate>();
  const stats = new Map<string, MonthlyStatAggregate>();

  for (const sale of sales) {
    const summaryKey = formatArtDay(sale.createdAt);
    const summary = summaries.get(summaryKey) ?? createEmptySummary();
    const delta = buildDailySummaryDelta(sale.createdAt, sale.total || 0, sale.paymentMethod ?? 'CASH');

    summary.totalDay += delta.totalDay;
    summary.txCount += delta.txCount;
    summary[delta.methodKey as keyof DailySummaryAggregate] += delta.totalDay;
    summary[delta.hourKey as keyof DailySummaryAggregate] += 1;
    summaries.set(summaryKey, summary);

    const month = monthFromIso(sale.createdAt);
    for (const item of sale.items ?? []) {
      if (item.code === '-1') {
        continue;
      }

      const statKey = `${month}#${item.code}`;
      const current = stats.get(statKey) ?? {
        code: item.code,
        name: item.name,
        uom: item.uom,
        priceSale: item.priceSale,
        monthlyUnits: 0,
      };

      current.monthlyUnits += item.qty ?? 0;
      stats.set(statKey, current);
    }
  }

  const summaryWrites = [...summaries.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, data]) => ({
      PutRequest: {
        Item: {
          PK: `COM#${COMMERCE_ID}`,
          SK: `SUMMARY#${day}`,
          commerceId: COMMERCE_ID,
          ...data,
        },
      },
    }));

  const statWrites = [...stats.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      const [month, code] = key.split('#');
      return {
        PutRequest: {
          Item: {
            PK: `COM#${COMMERCE_ID}`,
            SK: `STAT#${month}#PRODUCT#${code}`,
            statPK: `COM#${COMMERCE_ID}#${month}`,
            ...data,
            ttl: Math.floor(new Date().getTime() / 1000) + 365 * 24 * 60 * 60,
          },
        },
      };
    });

  const writes = [...summaryWrites, ...statWrites];
  for (const batch of chunkArray(writes, 25)) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: batch,
        },
      })
    );
  }

  console.log(`Generated ${summaries.size} daily summaries and ${stats.size} monthly stats.`);
}

main().catch((error) => {
  console.error('Sales report seed failed:', error);
  process.exitCode = 1;
});
