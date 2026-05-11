const { Client, RichPresence } = require('discord.js-selfbot-v13');
const express = require('express');

const client = new Client();
const app    = express();
const PORT   = process.env.PORT || 3000;

// ============================================================
//  ✦  CUSTOM RPC CONFIG  ✦
// ============================================================

const config = {
  // ── Activity ──────────────────────────────────────────────
  activityType: 'PLAYING',

  // ── Application ───────────────────────────────────────────
  applicationId:   '1445163122284429375',
  applicationName: "Forza Horizon 6",

  // ── Details (Line 1) ──────────────────────────────────────
  details:    '',
  detailsUrl: '',

  // ── State (Line 2) ────────────────────────────────────────
  state:    '',
  stateUrl: '',

  // ── Stream Link ───────────────────────────────────────────
  streamUrl: 'https://www.twitch.tv/haidar_at',

  // ── Large Image ───────────────────────────────────────────
  largeImageKey:  '',
  largeImageText: '',
  largeImageUrl:  '',

  // ── Small Image ───────────────────────────────────────────
  smallImageKey:  '',
  smallImageText: '',
  smallImageUrl:  '',

  // ── Buttons ───────────────────────────────────────────────
  button1Text: '',
  button1Url:  '',
  button2Text: '',
  button2Url:  '',

  // ── Timestamp ─────────────────────────────────────────────
  useTimestamp: true,
};

// ============================================================
//  ✦  EXPRESS SERVER (keeps Render awake)  ✦
// ============================================================

const BOOT_TIME = new Date();

app.get('/', (req, res) => {
  const uptime  = Math.floor((Date.now() - BOOT_TIME) / 1000);
  const hh      = String(Math.floor(uptime / 3600)).padStart(2, '0');
  const mm      = String(Math.floor((uptime % 3600) / 60)).padStart(2, '0');
  const ss      = String(uptime % 60).padStart(2, '0');
  const status  = client.user ? `✅ Online as ${client.user.tag}` : '⏳ Connecting...';

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
      <p>Uptime: ${hh}:${mm}:${ss}</p>
      <p>Started: ${BOOT_TIME.toLocaleString()}</p>
    </div></body></html>
  `);
});

// Health-check endpoint (used by uptime monitors like UptimeRobot)
app.get('/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});

// ============================================================
//  ✦  HELPER  ✦
// ============================================================

const START_TIME = Date.now();

async function buildActivity() {
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
    presence.setStartTimestamp(START_TIME);
  }

  // Large Image
  if (config.largeImageKey) {
    try {
      const [ext] = await RichPresence.getExternal(client, config.applicationId, config.largeImageKey);
      presence.setAssetsLargeImage(ext.external_asset_path);
    } catch {
      presence.setAssetsLargeImage(config.largeImageKey);
    }
    if (config.largeImageText) presence.setAssetsLargeText(config.largeImageText);
  }

  // Small Image
  if (config.smallImageKey) {
    try {
      const [ext] = await RichPresence.getExternal(client, config.applicationId, config.smallImageKey);
      presence.setAssetsSmallImage(ext.external_asset_path);
    } catch {
      presence.setAssetsSmallImage(config.smallImageKey);
    }
    if (config.smallImageText) presence.setAssetsSmallText(config.smallImageText);
  }

  // Buttons
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

  try {
    const activity = await buildActivity();
    client.user.setPresence({ activities: [activity], status: 'online' });
    console.log('✨ Custom RPC is now active!');
  } catch (err) {
    console.error('❌ Failed to set RPC:', err.message);
  }
});

// ── Refresh presence every 4 min ────────────────────────────
setInterval(async () => {
  if (!client.user) return;
  try {
    const activity = await buildActivity();
    client.user.setPresence({ activities: [activity], status: 'online' });
    console.log(`🔄 Presence refreshed at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    console.error('❌ Refresh error:', err.message);
  }
}, 4 * 60 * 1000);

// ============================================================
client.login(process.env.TOKEN || '');
