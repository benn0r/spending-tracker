import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';

const port = Number(process.env.IOS_E2E_MOCK_PORT || 3210);
const token = 'native-e2e-token';
const transactions = [
  {
    id: 'moonbeam-transaction-1',
    date: '2026-08-25',
    amount: -42.75,
    account: 'Moonlight Wallet',
    category: 'Enchanted Groceries',
    payee: 'Moonbeam Market',
    notes: 'Supplies for the observatory',
    tags: ['Weekly Quest'],
    isSplit: false,
  },
  {
    id: 'split-transaction-1',
    date: '2026-08-24',
    amount: -30,
    account: 'Moonlight Wallet',
    category: 'Split transaction',
    payee: 'Guild supplies',
    notes: 'A complete split purchase',
    tags: ['Guild Shared'],
    isSplit: true,
    cleared: true,
    children: [
      { id: 'split-child-1', category: 'Enchanted Groceries', amount: -18, tags: [] },
      { id: 'split-child-2', category: 'Skyship Travel', amount: -12, tags: ['Weekly Quest'] },
    ],
  },
  {
    id: 'income-transaction-1',
    date: '2026-08-23',
    amount: 250,
    account: 'Moonlight Wallet',
    category: 'Skyship Travel',
    payee: 'Royal stipend',
    tags: [],
    isSplit: false,
    type: 'Income',
  },
];

const receipts = [
  {
    id: 41,
    filename: 'moonbeam-market.png',
    account: 'moonlight-wallet',
    mimeType: 'image/png',
    status: 'processed',
    submitted: false,
    actualId: null,
    createdAt: '2026-08-25T10:00:00.000Z',
    processedAt: '2026-08-25T10:00:01.000Z',
    submittedAt: null,
    error: null,
    suggestion: {
      merchant: 'Starlight Apothecary',
      date: '2026-08-25',
      amount: 12.5,
      currency: 'CHF',
      category: 'Enchanted Groceries',
      notes: 'Healing herbs',
      tags: ['Weekly Quest'],
      confidence: 0.97,
      items: [{ description: 'Moon herb', quantity: 1, unitAmount: 12.5, totalAmount: 12.5 }],
      splits: [],
    },
  },
];

const sharedExpenses = [
  {
    id: 7,
    title: 'Dragon expedition',
    splitCount: 3,
    transactionCount: 2,
    totalAmount: 90,
    splitAmount: 30,
    settlementAmount: 0,
    balance: 60,
    currency: 'CHF',
    entryCount: 2,
    settlementCount: 0,
  },
];

const references = {
  accounts: [
    { id: 'moonlight-wallet', name: 'Moonlight Wallet' },
    { id: 'dragon-hoard', name: 'Dragon Hoard' },
  ],
  categories: [
    {
      id: 'enchanted-groceries',
      name: 'Enchanted Groceries',
      icon: 'basket-outline',
      color: '#B87545',
    },
    {
      id: 'skyship-travel',
      name: 'Skyship Travel',
      icon: 'airplane-outline',
      color: '#3C91C9',
    },
  ],
  tags: [
    { id: 'weekly-quest', name: 'Weekly Quest' },
    { id: 'guild-shared', name: 'Guild Shared' },
  ],
};

const cashFlow = {
  currency: 'CHF',
  currentMonth: '2026-08',
  months: [
    { month: '2026-03', income: 5200, expenses: 4100, net: 1100 },
    { month: '2026-04', income: 5400, expenses: 4300, net: 1100 },
    { month: '2026-05', income: 5600, expenses: 4450, net: 1150 },
    { month: '2026-06', income: 5500, expenses: 4700, net: 800 },
    { month: '2026-07', income: 5700, expenses: 4500, net: 1200 },
    { month: '2026-08', income: 4900, expenses: 3200, net: 1700 },
  ],
};

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  let pathname = url.pathname;
  const scenario = pathname.match(/^\/(slow|server-error|offline)(\/|$)/)?.[1];
  if (scenario) pathname = pathname.slice(scenario.length + 1) || '/';
  if (scenario === 'slow') await new Promise((resolve) => setTimeout(resolve, 4_000));
  if (scenario === 'offline') {
    request.socket.destroy();
    return;
  }
  if (scenario === 'server-error' && pathname !== '/health') {
    response.setHeader('x-request-id', 'native-e2e-request');
    return json(response, 503, { error: 'The fantasy ledger is temporarily unavailable.' });
  }
  if (pathname === '/health') return json(response, 200, { ok: true });
  if (request.headers.authorization !== `Bearer ${token}`) {
    return json(response, 401, { error: 'Invalid native e2e token' });
  }

  if (request.method === 'GET' && pathname === '/api/references') {
    return json(response, 200, references);
  }
  if (request.method === 'GET' && pathname === '/api/cash-flow') {
    return json(
      response,
      200,
      url.searchParams.has('account') ? { ...cashFlow, balance: 254 } : cashFlow,
    );
  }
  if (request.method === 'GET' && pathname === '/api/transactions') {
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || 20);
    const start = (page - 1) * pageSize;
    return json(response, 200, {
      transactions: transactions.slice(start, start + pageSize),
      total: transactions.length,
      page,
      pageSize,
    });
  }
  if (request.method === 'POST' && pathname === '/api/transactions') {
    const payload = await readJson(request);
    const created = {
      id: payload.id || `native-e2e-${transactions.length + 1}`,
      date: payload.date || '2026-08-25',
      amount: payload.amount,
      account:
        references.accounts.find(({ id }) => id === payload.account)?.name || payload.account,
      category:
        references.categories.find(({ id }) => id === payload.category)?.name || payload.category,
      payee: payload.payee || payload.notes || 'Native e2e transaction',
      notes: payload.notes,
      tags: payload.tags || [],
      isSplit: false,
    };
    transactions.unshift(created);
    return json(response, 201, { id: created.id, status: 'created' });
  }
  if (request.method === 'PATCH' && pathname.startsWith('/api/transactions/')) {
    const payload = await readJson(request);
    const id = decodeURIComponent(pathname.slice('/api/transactions/'.length));
    const item = transactions.find((transaction) => transaction.id === id);
    if (!item) return json(response, 404, { error: 'Transaction not found' });
    Object.assign(item, payload, {
      account: references.accounts.find(({ id: value }) => value === payload.account)?.name,
      category: references.categories.find(({ id: value }) => value === payload.category)?.name,
    });
    return json(response, 200, { id, status: 'updated' });
  }
  if (request.method === 'DELETE' && pathname.startsWith('/api/transactions/')) {
    const id = decodeURIComponent(pathname.slice('/api/transactions/'.length));
    const index = transactions.findIndex((transaction) => transaction.id === id);
    if (index >= 0) transactions.splice(index, 1);
    response.writeHead(204);
    return response.end();
  }
  if (request.method === 'POST' && pathname === '/api/references/tags') {
    const { name } = await readJson(request);
    const tag = { id: `tag-${references.tags.length + 1}`, name };
    references.tags.push(tag);
    return json(response, 201, tag);
  }
  if (request.method === 'GET' && pathname === '/api/receipts') {
    return json(response, 200, receipts);
  }
  if (request.method === 'GET' && pathname === '/api/receipts/41/file') {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
      'base64',
    );
    response.writeHead(200, { 'content-type': 'image/png' });
    return response.end(png);
  }
  if (request.method === 'POST' && pathname === '/api/receipts/41/submit') {
    receipts[0].submitted = true;
    receipts[0].actualId = 'receipt-transaction-41';
    return json(response, 201, { id: 'receipt-transaction-41', status: 'created' });
  }
  if (request.method === 'GET' && pathname === '/api/splits') {
    return json(response, 200, { splits: sharedExpenses });
  }
  if (request.method === 'GET' && pathname === '/api/splits/7') {
    return json(response, 200, {
      ...sharedExpenses[0],
      entries: [
        {
          id: 71,
          kind: 'transaction',
          transactionId: 'moonbeam-transaction-1',
          description: 'Moonbeam Market',
          amount: 90,
          date: '2026-08-25',
          wallet: 'Moonlight Wallet',
          categoryName: 'Enchanted Groceries',
        },
      ],
      settlements: [],
    });
  }
  return json(response, 404, {
    error: `No native e2e route for ${request.method} ${pathname}`,
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Native iOS mock API listening on http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
