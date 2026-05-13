const { Client, RichPresence } = require('discord.js-selfbot-v13');
const express = require('express');
const fs      = require('fs');

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
  smallImageUrl:   '',
  button1Text:     '',
  button1Url:      '',
  button2Text:     '',
  button2Url:      '',
  useTimestamp:    true,
};

// ============================================================
//  ✦  PERSISTENT START TIME  ✦
// ============================================================

const TIMESTAMP_FILE = '/tmp/start_time.txt';

function getStartTime() {
  // 1) env variable (คงอยู่ข้าม host restart)
  if (process.env.START_TIMESTAMP) {
    const t = parseInt(process.env.START_TIMESTAMP, 10);
    if (!isNaN(t)) {
      console.log('⏱️  START_TIME loaded from env');
      return t;
    }
  }

  // 2) /tmp file (คงอยู่ข้าม process crash / restart)
  try {
    const saved = fs.readFileSync(TIMESTAMP_FILE, 'utf8').trim();
    const t     = parseInt(saved, 10);
    if (!isNaN(t)) {
      console.log('⏱️  START_TIME restored from file');
      return t;
    }
  } catch {}

  // 3) สร้างใหม่ครั้งแรก
  const now = Date.now();
  try {
    fs.writeFileSync(TIMESTAMP_FILE, String(now));
    console.log('⏱️  START_TIME created & saved to file');
  } catch (e) {
    console.warn('⚠️  Could not write timestamp file:', e.message);
  }
  return now;
}

const START_TIME = getStartTime();

// ============================================================
//  ✦  EXPRESS SERVER (keeps host awake)  ✦
// ============================================================

const BOOT_TIME = new Date();

app.get('/', (req, res) => {
  const uptime = Math.floor((Date.now() - BOOT_TIME) / 1000);
  const hh     = String(Math.floor(uptime / 3600)).padStart(2, '0');
  const mm     = String(Math.floor((uptime % 3600) / 60)).padStart(2, '0');
  const ss     = String(uptime % 60).padStart(2, '0');
  const status = client.user ? `✅ Online as ${client.user.tag}` : '⏳ Connecting...';

  res.send(`
    <html><head><title>Custom RPC</title>
    <meta http-equiv="refresh" content="30">
    <style>
      body { font-family: monospace; background: #111; color: #0f0;
             display: flex; align-items: center; justify-content: center;
             height: 100vh; margin: 0; }
      .box { border: 1px solid #0f0; padding: 2rem 3rem; text-align: center; }
      h2   { margin: 0 0 1rem; font-size: 1.4rem; }
      p    { margin: 0.3rem 0; color: #8f8; }
    </style></head>
    <body><div class="box">
      <h2>⚡ Discord Custom RPC</h2>
      <p>${status}</p>
      <p>Process uptime: ${hh}:${mm}:${ss}</p>
      <p>RPC started: ${new Date(START_TIME).toLocaleString()}</p>
      <p>Boot time: ${BOOT_TIME.toLocaleString()}</p>
    </div></body></html>
  `);
});

app.get('/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});

// ============================================================
//  ✦  IMAGE CACHE  ✦
// ============================================================

let cachedLargeImage = null;
let cachedSmallImage = null;

async function resolveImages() {
  if (config.largeImageKey) {
    try {
      const [ext]      = await RichPresence.getExternal(client, config.applicationId, config.largeImageKey);
      cachedLargeImage = ext.external_asset_path;
      console.log('🖼️  Large image resolved & cached');
    } catch {
      cachedLargeImage = config.largeImageKey;
      console.log('🖼️  Large image fallback to key');
    }
  }

  if (config.smallImageKey) {
    try {
      const [ext]      = await RichPresence.getExternal(client, config.applicationId, config.smallImageKey);
      cachedSmallImage = ext.external_asset_path;
      console.log('🖼️  Small image resolved & cached');
    } catch {
      cachedSmallImage = config.smallImageKey;
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

  if (config.activityType.toUpperCase() === 'STREAMING' && config.streamUrl) {
    presence.setURL(config.streamUrl);
  }

  if (config.details) presence.setDetails(config.details);
  if (config.state)   presence.setState(config.state);

  if (config.useTimestamp) {
    presence.setStartTimestamp(START_TIME); // ใช้ persistent time
  }

  if (cachedLargeImage) {
    presence.setAssetsLargeImage(cachedLargeImage);
    if (config.largeImageText) presence.setAssetsLargeText(config.largeImageText);
  }

  if (cachedSmallImage) {
    presence.setAssetsSmallImage(cachedSmallImage);
    if (config.smallImageText) presence.setAssetsSmallText(config.smallImageText);
  }

  if (config.button1Text && config.button1Url) presence.addButton(config.button1Text, config.button1Url);
  if (config.button2Text && config.button2Url) presence.addButton(config.button2Text, config.button2Url);

  return presence;
}

// ============================================================
//  ✦  DISCORD CLIENT  ✦
// ============================================================

client.on('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🎮 Setting Custom RPC...`);

  await resolveImages();

  try {
    const activity = buildActivity();
    client.user.setPresence({ activities: [activity], status: 'online' });
    console.log('✨ Custom RPC is now active!');
  } catch (err) {
    console.error('❌ Failed to set RPC:', err.message);
  }
});

// Refresh ทุก 4 นาที
setInterval(() => {
  if (!client.user) return;
  try {
    const activity = buildActivity();
    client.user.setPresence({ activities: [activity], status: 'online' });
    console.log(`🔄 Presence refreshed at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error('❌ Refresh error:', err.message);
  }
}, 4 * 60 * 1000);

// ============================================================
//  ✦  ERROR HANDLERS  ✦
// ============================================================

client.on('error', (err) => {
  console.error('❌ Client error:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err.message);
});

// ============================================================
client.login(process.env.TOKEN || '');
