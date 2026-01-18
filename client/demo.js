/* eslint-disable no-console */

// Optional demo client: calls your four services.
// Requires Node 18+ (built-in fetch).

const USERS = process.env.USERS_URL || 'http://USERS_BASE_URL:3001';
const COSTS = process.env.COSTS_URL || 'http://COSTS_BASE_URL:3002';
const LOGS  = process.env.LOGS_URL  || 'http://BASE_URL:3003';
const ADMIN = process.env.ADMIN_URL || 'http://ADMIN_BASE_URL:3004';

async function http(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }

  if (!res.ok) {
    throw new Error(`${method} ${url} -> ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  const user = {
    id: 123123,
    first_name: 'Dana',
    last_name: 'Levi',
    birthday: '1999-04-21'
  };

  console.log('1) Add user');
  try {
    console.log(await http('POST', `${USERS}/api/add`, user));
  } catch (e) {
    console.log('(ok if already exists)', String(e.message));
  }

  console.log('\n2) Add cost');
  console.log(await http('POST', `${COSTS}/api/add`, {
    description: 'choco',
    category: 'food',
    userid: user.id,
    sum: 12
  }));

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  console.log('\n3) Monthly report');
  console.log(await http('GET', `${COSTS}/api/report?id=${user.id}&year=${year}&month=${month}`));

  console.log('\n4) User details');
  console.log(await http('GET', `${USERS}/api/users/${user.id}`));

  console.log('\n5) About/team');
  console.log(await http('GET', `${ADMIN}/api/about`));

  console.log('\n6) Logs (latest 10)');
  console.log(await http('GET', `${LOGS}/api/logs?limit=10`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
