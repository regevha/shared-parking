import { FullConfig } from '@playwright/test';

export default async function globalSetup(_config: FullConfig) {
  const check = async (url: string, label: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok && res.status !== 401 && res.status !== 422) {
        throw new Error(`${label} responded with ${res.status}`);
      }
    } catch (err: any) {
      if (err.message?.startsWith(label)) throw err;
      throw new Error(
        `${label} not reachable at ${url} — make sure both servers are running.\n` +
        `Run: bash start.sh  (or start backend + frontend separately)\n` +
        `Original error: ${err.message}`
      );
    }
  };

  await check('http://localhost:8000/auth/me', 'Backend');
  await check('http://localhost:3000', 'Frontend');
}
