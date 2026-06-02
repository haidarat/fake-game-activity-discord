const { Client, RichPresence } = require('discord.js-selfbot-v13');
const express = require('express');
const fs      = require('fs').promises;

const client = new Client();
const app    = express();
const PORT   = process.env.PORT || 3000;

// ============================================================
//  ✦  CUSTOM RPC CONFIG  ✦
// ============================================================

const config = {
  activityType:    'PLAYING',
  applicationId:   process.env.APP_ID,
  applicationName: process.env.APP_NAME,
  details:         '',
  detailsUrl:      '',
  state:           '',
  stateUrl:        '',
  streamUrl:       'https://www.twitch.tv/haidar_at',
  largeImageKey:   '',
  largeImageText:  '',
  largeImageUrl:   '',
  smallImageKey:   '',
  smallImageText:  '',
  smallImageUrl:   'https://s13.gifyu.com/images/bIMAh.png',
  button1Text:     'Join Community',
  button1Url:      'https://discord.gg/SB2hJm9pNE',
  button2Text:     '',
  button2Url:      '',
  useTimestamp:    true,
};

// ============================================================
//  ✦  PERSISTENT START TIME  ✦
// ============================================================

const TIMESTAMP_FILE = '/tmp/start_time.txt';

async function getStartTime() {
  if (process.env.START_TIMESTAMP) {
    const t = parseInt(process.env.START_TIMESTAMP, 10);
    if (!isNaN(t)) {
      console.log('⏱️  START_TIME loaded from env');
      return t;
    }
  }
  try {
    const saved = await fs.readFile(TIMESTAMP_FILE, 'utf8');
    const t     = parseInt(saved.trim(), 10);
    if (!isNaN(t)) {
      console.log('⏱️  START_TIME restored from file');
      return t;
    }
  } catch {}
  const now = Date.now();
  await fs.writeFile(TIMESTAMP_FILE, String(now)).catch(e =>
    console.warn('⚠️  Could not write timestamp file:', e.message)
  );
  console.log('⏱️  START_TIME created & saved to file');
  return now;
}

// ============================================================
//  ✦  EXPRESS SERVER  ✦
// ============================================================

const HTML_HEAD = `<html><head><title>Custom RPC</title>
<meta http-equiv="refresh" content="30">
<style>body{font-family:monospace;background:#111;color:#0f0;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{border:1px solid #0f0;padding:2rem 3rem;text-align:center}
h2{margin:0 0 1rem;font-size:1.4rem}p{margin:.3rem 0;color:#8f8}</style>
</head><body><div class="box"><h2>⚡ Discord Custom RPC</h2>`;
const HTML_TAIL = `</div></body></html>`;

const BOOT_TIME = new Date();

app.get('/', (req, res) => {
  const uptime = Math.floor((Date.now() - BOOT_TIME) / 1000);
  const hh     = String(Math.floor(uptime / 3600)).padStart(2, '0');
  const mm     = String(Math.floor((uptime % 3600) / 60)).padStart(2, '0');
  const ss     = String(uptime % 60).padStart(2, '0');
  const status = client.user ? `✅ Online as ${client.user.tag}` : '⏳ Connecting...';

  res.send(
    HTML_HEAD +
    `<p>${status}</p>` +
    `<p>Process uptime: ${hh}:${mm}:${ss}</p>` +
    `<p>RPC started: ${new Date(START_TIME).toLocaleString()}</p>` +
    `<p>Boot time: ${BOOT_TIME.toLocaleString()}</p>` +
    HTML_TAIL
  );
});

app.get('/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => {
  console.log(`🌐 Express server on port ${PORT}`);
});

// ============================================================
//  ✦  IMAGE CACHE  ✦
// ============================================================

const imageCache = Object.create(null);

async function resolveImages() {
  if (config.largeImageKey) {
    try {
      const [ext]      = await RichPresence.getExternal(client, config.applicationId, config.largeImageKey);
      imageCache.large = ext.external_asset_path;
      console.log('🖼️  Large image resolved & cached');
    } catch {
      imageCache.large = config.largeImageKey;
      console.log('🖼️  Large image fallback to key');
    }
  }
  if (config.smallImageKey) {
    try {
      const [ext]      = await RichPresence.getExternal(client, config.applicationId, config.smallImageKey);
      imageCache.small = ext.external_asset_path;
      console.log('🖼️  Small image resolved & cached');
    } catch {
      imageCache.small = config.smallImageKey;
      console.log('🖼️  Small image fallback to key');
    }
  }
}

// ============================================================
//  ✦  BUILD ACTIVITY  ✦
// ============================================================

function buildActivity() {
  const presence = new RichPresence(client)
    .setApplicationId(config.applicationId)
    .setType(config.activityType.toUpperCase())
    .setName(config.applicationName);

  if (config.activityType.toUpperCase() === 'STREAMING' && config.streamUrl)
    presence.setURL(config.streamUrl);

  if (config.details) presence.setDetails(config.details);
  if (config.state)   presence.setState(config.state);

  if (config.useTimestamp) presence.setStartTimestamp(START_TIME);

  if (imageCache.large) {
    presence.setAssetsLargeImage(imageCache.large);
    if (config.largeImageText) presence.setAssetsLargeText(config.largeImageText);
  }
  if (imageCache.small) {
    presence.setAssetsSmallImage(imageCache.small);
    if (config.smallImageText) presence.setAssetsSmallText(config.smallImageText);
  }

  if (config.button1Text && config.button1Url) presence.addButton(config.button1Text, config.button1Url);
  if (config.button2Text && config.button2Url) presence.addButton(config.button2Text, config.button2Url);

  return presence;
}

// ============================================================
//  ✦  PRESENCE REFRESH  ✦
// ============================================================

let lastActivityHash = '';

function refreshPresence() {
  if (!client.user) return;
  const hash = `${config.details}|${config.state}|${config.useTimestamp ? START_TIME : 0}`;
  if (hash === lastActivityHash) return;
  lastActivityHash = hash;
  try {
    client.user.setPresence({ activities: [buildActivity()], status: 'online' });
    console.log(`🔄 Presence refreshed at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error('❌ Refresh error:', err.message);
  }
}

setInterval(refreshPresence, 4 * 60 * 1000);

// ============================================================
//  ✦  DISCORD CLIENT  ✦
// ============================================================

let START_TIME;

client.on('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🎮 Setting Custom RPC...`);
  await resolveImages();
  try {
    client.user.setPresence({ activities: [buildActivity()], status: 'online' });
    console.log('✨ Custom RPC is now active!');
  } catch (err) {
    console.error('❌ Failed to set RPC:', err.message);
  }
});

client.on('error', (err) => {
  console.error('❌ Client error:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err.message);
});

// ============================================================
(async () => {
  START_TIME = await getStartTime();
  client.login(process.env.TOKEN || '');
})();
