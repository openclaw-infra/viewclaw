import fs from 'node:fs';
import path from 'node:path';

const appJsonPath = path.resolve(process.cwd(), 'mobile/app.json');
const raw = fs.readFileSync(appJsonPath, 'utf8');
const app = JSON.parse(raw);

const current = app?.expo?.version || '0.1.0';
const [maj, min, patch] = current.split('.').map((n) => Number(n || 0));
const next = `${maj}.${min}.${patch + 1}`;

app.expo.version = next;
fs.writeFileSync(appJsonPath, `${JSON.stringify(app, null, 2)}\n`, 'utf8');

console.log(next);
