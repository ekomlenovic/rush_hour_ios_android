// Playwright + Chromium: the project's own install, or the paths given by PLAYWRIGHT_PATH / CHROMIUM_PATH
import fs from 'fs';

export async function launchBrowser(args = []) {
  let pw;
  try {
    pw = await import('playwright');
  } catch {
    const fallback = process.env.PLAYWRIGHT_PATH || '/opt/node-tools/node_modules/playwright/index.mjs';
    pw = await import(fallback);
  }
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return pw.chromium.launch({ executablePath, args });
}
