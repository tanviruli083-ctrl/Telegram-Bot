const { Telegraf } = require('telegraf');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for full access
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MASTER_BOT_TOKEN = 'YOUR_HARD_CODED_MASTER_BOT_TOKEN'; // Replace with actual token

// In-memory user session to track expected actions
const userSessions = {};

// Initialize Runner Bot
const runnerBot = new Telegraf(MASTER_BOT_TOKEN);

/**
 * Handle incoming update from webhook
 */
async function handleUpdate(body, userSessions) {
  const message = body.message || body.callback_query?.message;
  const chatId = message?.chat?.id;
  const userId = message?.from?.id;

  if (!chatId || !userId) return; // Ignore invalid updates

  // Reset session on /start
  if (body.message?.text === '/start') {
    userSessions[userId] = null;
    await runnerBot.telegram.sendMessage(chatId, 'Welcome to TS OTP Hub Configuration Panel.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Set Bot Token', callback_data: 'set_bot_token' }],
          [{ text: 'Set Admin IDs', callback_data: 'set_admin_ids' }]
        ]
      }
    });
    return;
  }

  // Handle callback queries
  if (body.callback_query) {
    const data = body.callback_query.data;
    if (data === 'set_bot_token') {
      userSessions[userId] = 'awaiting_bot_token';
      await runnerBot.telegram.sendMessage(chatId, 'Please send the Bot API Token (format: token:xxxxx)');
    } else if (data === 'set_admin_ids') {
      userSessions[userId] = 'awaiting_admin_ids';
      await runnerBot.telegram.sendMessage(chatId, 'Please send comma-separated Admin Telegram IDs (e.g., 123456789,987654321)');
    }
    // Acknowledge callback
    await runnerBot.telegram.answerCbQuery(body.callback_query.id);
    return;
  }

  // Handle text messages based on session
  if (userSessions[userId] === 'awaiting_bot_token') {
    const token = body.message.text.trim();
    if (!token.includes(':')) {
      await runnerBot.telegram.sendMessage(chatId, 'Invalid token format. Please send a valid Bot Token (must contain a colon).');
      return;
    }
    // Save token into Supabase
    await supabase.from('bot_configs').upsert({ id: 1, bot_token: token }).single();

    // Set webhook URL
    const webhookUrl = `https://${body.req.headers.host}/child`;
    try {
      await axios.get(`https://api.telegram.org/bot${token}/setWebhook`, {
        params: { url: webhookUrl }
      });
      await runnerBot.telegram.sendMessage(chatId, 'Webhook successfully set for the Runner Bot.');
    } catch (err) {
      await runnerBot.telegram.sendMessage(chatId, 'Failed to set webhook. Please ensure the token is correct.');
    }
    userSessions[userId] = null;
  } else if (userSessions[userId] === 'awaiting_admin_ids') {
    const adminIds = body.message.text.trim();
    await supabase.from('bot_configs').upsert({ id: 1, admin_ids: adminIds }).single();
    await runnerBot.telegram.sendMessage(chatId, 'Admin IDs saved successfully.');
    userSessions[userId] = null;
  }
}

module.exports = {
  handleUpdate
};
