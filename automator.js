import { execSync } from 'child_process';
import fs from 'fs';
import https from 'https';

const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'Gamer69a';
const GITHUB_PAT = process.env.GITHUB_PAT || process.env.GH_PAT;
const NPM_TOKEN = process.env.NPM_TOKEN;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

if (!GITHUB_PAT) {
  console.error('Error: GITHUB_PAT (or GH_PAT) environment variable is required.');
  process.exit(1);
}

function createNewRepo(repoName) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ name: repoName, private: false });
    const req = https.request({
      hostname: 'api.github.com',
      path: '/user/repos',
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_PAT}`,
        'User-Agent': 'NodeJS-Automator',
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runPipeline() {
  const timeStamp = Date.now();
  const buildName = `build-${timeStamp}`;
  const npmScopedName = `@${GITHUB_USERNAME}/${buildName}`;
  
  console.log(`\n[Automator] Starting execution for unique build: ${buildName}...\n`);

  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.name = npmScopedName;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log(`[npm] Updated package name to: ${npmScopedName}`);
  }

  console.log(`[GitHub] Creating new repository: ${buildName}...`);
  await createNewRepo(buildName);
  const repoUrl = `https://${GITHUB_PAT}@github.com/${GITHUB_USERNAME}/${buildName}.git`;
  
  execSync('rm -rf .git', { stdio: 'ignore' });
  execSync(`git init && git add . && git commit -m "Auto-generated release ${timeStamp}"`, { stdio: 'ignore' });
  execSync(`git branch -M main && git remote add origin ${repoUrl} && git push -u origin main`, { stdio: 'ignore' });
  console.log(`[GitHub] Code pushed to new repository.`);

  if (NPM_TOKEN) {
    console.log(`[npm] Publishing new package...`);
    try {
      execSync('npm publish --access public', { stdio: 'inherit' });
    } catch (err) {
      console.warn('[npm] Warning: Publish failed or skipped.');
    }
  }

  if (VERCEL_TOKEN) {
    console.log(`[Vercel] Triggering fresh project deployment...`);
    execSync('rm -rf .vercel', { stdio: 'ignore' });
    try {
      execSync(`npx vercel --prod --name ${buildName} --token ${VERCEL_TOKEN} --confirm`, { stdio: 'inherit' });
    } catch (err) {
      console.warn('[Vercel] Warning: Deployment failed.');
    }
  }

  console.log('\n================================================================');
  console.log(` ALL AVAILABLE CDN & DEPLOYMENT ENDPOINTS`);
  console.log('================================================================');
  
  console.log('\n--- GITHUB SOURCE CDNs ---');
  console.log(`jsDelivr:       https://cdn.jsdelivr.net/gh/${GITHUB_USERNAME}/${buildName}@main/`);
  console.log(`Statically:     https://cdn.statically.io/gh/${GITHUB_USERNAME}/${buildName}/main/`);
  console.log(`GitHack (Prod): https://raw.githack.com/${GITHUB_USERNAME}/${buildName}/main/`);
  console.log(`GitHack (Dev):  https://rawcdn.githack.com/${GITHUB_USERNAME}/${buildName}/main/`);
  console.log(`Fastly:         https://fastly.jsdelivr.net/gh/${GITHUB_USERNAME}/${buildName}@main/`);
  console.log(`GitHub Raw:     https://raw.githubusercontent.com/${GITHUB_USERNAME}/${buildName}/main/`);

  console.log('\n--- NPM PACKAGE CDNs ---');
  console.log(`jsDelivr:       https://cdn.jsdelivr.net/npm/${npmScopedName}/`);
  console.log(`unpkg:          https://unpkg.com/${npmScopedName}/`);
  console.log(`Skypack:        https://cdn.skypack.dev/${npmScopedName}`);
  console.log(`esm.sh:         https://esm.sh/${npmScopedName}`);
  console.log(`jspm:           https://jspm.dev/${npmScopedName}`);
  console.log(`Bundlephobia:   https://bundlephobia.com/package/${npmScopedName}`);

  console.log('\n--- VERCEL DIRECT NATIVE EDGE ---');
  console.log(`Live Deployment:https://${buildName}.vercel.app`);
  console.log('================================================================\n');
}

runPipeline().catch(err => {
  console.error('Error running pipeline:', err);
  process.exit(1);
});