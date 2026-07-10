const { Telegraf } = require('telegraf');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID; // Set this in env variables

// In-memory session for admin panel interactions
const adminSessions = {};

/**
 * Main handler for Child Bot webhook
 */
async function handleChildBot(body, userSessions) {
  // Fetch bot configs
  const { data: config } = await supabase
    .from('bot_configs')
    .select('*')
    .single();

  if (!config || !config.bot_token) {
    // No token, silently ignore
    return;
  }

  const bot = new Telegraf(config.bot_token);
  const adminIds = config.admin_ids ? config.admin_ids.split(',').map(id => id.trim()) : [];
  const stexApiKey = config.stex_api_key;

  // Define headers for STEX API
  const stexHeaders = { 'mauthapi': stexApiKey };

  // Handle commands
  if (body.message) {
    const text = body.message.text;
    const chatId = body.message.chat.id;
    const fromId = body.message.from.id;

    // /start command
    if (text === '/start') {
      await bot.telegram.sendMessage(chatId, 'Welcome! Use the menu below.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Get Number', callback_data: 'get_number' }],
            [{ text: 'My stats', callback_data: 'my_stats' }],
            [{ text: 'Admin Panel', callback_data: 'admin_panel' }]
          ]
        }
      });
      return;
    }

    // /admin command
    if (text === '/admin') {
      if (!adminIds.includes(fromId.toString())) {
        await bot.telegram.sendMessage(chatId, 'Permission Denied: You are not an admin.');
        return;
      }
      // Show admin panel
      await showAdminPanel(bot, chatId, config, adminIds);
      return;
    }

    // Handle session inputs (e.g., setting STEX API key)
    if (adminSessions[fromId] && adminSessions[fromId].action === 'set_stex_api') {
      const newApiKey = text.trim();
      await supabase.from('bot_configs').update({ stex_api_key: newApiKey }).eq('id', 1);
      await bot.telegram.sendMessage(chatId, 'STEX API Key updated successfully.');
      delete adminSessions[fromId];
      return;
    }
  }

  // Handle callback queries
  if (body.callback_query) {
    const data = body.callback_query.data;
    const chatId = body.callback_query.message.chat.id;
    const fromId = body.callback_query.from.id;

    // Admin panel button callbacks
    if (data === 'admin_panel') {
      if (!adminIds.includes(fromId.toString())) {
        await bot.telegram.sendMessage(chatId, 'Permission Denied.');
        return;
      }
      await showAdminPanel(bot, chatId, config, adminIds);
    } else if (data.startsWith('panel_control')) {
      // Show panel control
      await showPanelControl(bot, chatId, config);
    } else if (data === 'set_stex_api') {
      // Set STEX API key
      adminSessions[fromId] = { action: 'set_stex_api' };
      await bot.telegram.sendMessage(chatId, 'Please send the new STEX API Key.');
    } else if (data.startsWith('buy_')) {
      // Handle number purchase
      const rangeCode = data.slice(4);
      await handleNumberPurchase(bot, chatId, rangeCode, config, supabase);
    } else if (data === 'get_number') {
      await handleGetNumber(bot, chatId, config);
    } else if (data === 'back') {
      await bot.telegram.sendMessage(chatId, 'Returning to main menu.');
    }
    // Add more callback handling as needed
  }
}

/**
 * Show Admin Panel
 */
async function showAdminPanel(bot, chatId, config, adminIds) {
  const statusText = config.stex_api_key ? 'Active' : 'Not Set';
  await bot.telegram.sendMessage(chatId, 'Admin Panel:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Bot Status', callback_data: 'feature_placeholder' }],
        [{ text: 'Broadcast', callback_data: 'feature_placeholder' }],
        [{ text: 'Number Management', callback_data: 'feature_placeholder' }],
        [{ text: 'Payment System', callback_data: 'feature_placeholder' }],
        [{ text: 'Bot Settings', callback_data: 'feature_placeholder' }],
        [{ text: 'Panel Control', callback_data: 'panel_control' }],
        [{ text: 'Clear History', callback_data: 'feature_placeholder' }],
        [{ text: 'Channel Control', callback_data: 'feature_placeholder' }],
        [{ text: 'Database Management', callback_data: 'feature_placeholder' }],
        [{ text: 'Ban/Unban User', callback_data: 'feature_placeholder' }]
      ]
    }
  });
}

/**
 * Show Panel Control submenu
 */
async function showPanelControl(bot, chatId, config) {
  const apiStatus = config.stex_api_key ? 'Active' : 'Not Set';
  await bot.telegram.sendMessage(chatId, `Panel Control:\nSTEX API Key Status: ${apiStatus}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Set STEX API Key', callback_data: 'set_stex_api' }],
        [{ text: 'Back', callback_data: 'back' }]
      ]
    }
  });
}

/**
 * Handle Get Number button
 */
async function handleGetNumber(bot, chatId, config) {
  if (!config.stex_api_key) {
    await bot.telegram.sendMessage(chatId, 'STEX API is not configured. Please contact admin.');
    return;
  }
  try {
    const response = await axios.get('https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api/liveaccess', {
      headers: { 'mauthapi': config.stex_api_key }
    });
    const services = response.data?.services || [];
    if (services.length === 0) {
      await bot.telegram.sendMessage(chatId, 'No live traffic available at the moment.');
      return;
    }

    const keyboard = services.map(service => {
      const rangeCode = service.range.replace('XXX', '');
      return [{ text: `SID: ${service.sid} | ${rangeCode}`, callback_data: `buy_${rangeCode}` }];
    });
    // Add back button
    keyboard.push([{ text: 'Back', callback_data: 'back' }]);

    await bot.telegram.sendMessage(chatId, 'Select a range to buy:', {
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (err) {
    await bot.telegram.sendMessage(chatId, 'Failed to fetch live traffic.');
  }
}

/**
 * Handle number purchase
 */
async function handleNumberPurchase(bot, chatId, rangeCode, config, supabase) {
  const loadingMsg = await bot.telegram.sendMessage(chatId, 'Processing your request...');
  try {
    const response = await axios.post(
      'https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api/getnum',
      { rid: rangeCode }
    );
    const data = response.data;
    if (!data || !data.full_number) {
      await bot.telegram.editMessageText(chatId, loadingMsg.message_id, null, 'Failed to allocate number.');
      return;
    }

    const { full_number, country, operator } = data;
    // Save to database
    await supabase.from('active_numbers').insert({
      number: full_number,
      country: country,
      status: 'waiting',
      created_at: new Date()
    });

    // Send number info
    await bot.telegram.editMessageText(
      chatId,
      loadingMsg.message_id,
      null,
      `**Your Number:** ${full_number}\n**Country:** ${country}\n**Operator:** ${operator}`,
      { parse_mode: 'Markdown', reply_markup: {
        inline_keyboard: [
          [{ text: 'Copy Number', callback_data: `copy_${full_number}` }],
          [{ text: 'Change Range', callback_data: 'get_number' }]
        ]
      }}
    );
  } catch (err) {
    await bot.telegram.editMessageText(chatId, loadingMsg.message_id, null, 'Error during number allocation.');
  }
}

/**
 * Periodic check for OTPs and forwarding
 */
async function checkAndForwardOTP() {
  try {
    // Fetch configs
    const { data: config } = await supabase
      .from('bot_configs')
      .select('*')
      .single();

    if (!config || !config.bot_token || !config.admin_ids || !config.stex_api_key) return;

    const bot = new Telegraf(config.bot_token);
    const response = await axios.get('https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api/success-otp');
    const otps = response.data?.data?.otps || [];

    if (otps.length === 0) return;

    const latestOtp = otps[otps.length - 1];
    const message = `🔔 **NEW OTP RECEIVED**\nNumber: ${latestOtp.number}\nCode: ${latestOtp.message}`;

    // Send to admin group
    await bot.telegram.sendMessage(
      parseInt(process.env.ADMIN_GROUP_ID),
      message,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    // Silent fail
    console.error('Failed to fetch or send OTP:', err);
  }
}

module.exports = {
  handleChildBot,
  checkAndForwardOTP
};
