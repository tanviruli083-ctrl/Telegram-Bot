const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// ==========================================
// 🔑 CREDENTIALS & URL (আপনার তথ্য দিন)
// ==========================================
const MASTER_BOT_TOKEN = '8729636637:AAFUyoKeK7NT0-1EAlFgHJcXmdfbbr-ZIaI';
const SUPABASE_URL = 'https://fwfacvvugaazlffckmxz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-1p3Ee4gAxxkJu_PpRTaVA_BOUDvIjF';

// ⚠️ আপনার ভার্সেল প্রজেক্টের আসল লিংকটি এখানে দিন (শেষে কোনো স্ল্যাশ / দেবেন না)
const PROJECT_URL = 'https://telegram-bot-fjri.vercel.app/'; 

// STEX API Config
const STEX_BASE_URL = 'https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api';
const STEX_HEADERS = { 'mauthapi': 'M704VEUDSZ3' };

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const runnerBot = new Telegraf(MASTER_BOT_TOKEN);

const userSessions = {};
const ADMIN_GROUP_ID = '-100XXXXXXXXX'; 

// ==========================================
// 🤖 1. RUNNER BOT (টোকেন ও আইডি রিসিভ)
// ==========================================
runnerBot.command('start', (ctx) => {
    userSessions[ctx.from.id] = null; 
    const inlineBtn = Markup.inlineKeyboard([
        [Markup.button.callback('🤖 Set Bot Token', 'set_token'), Markup.button.callback('🆔 Set Admin IDs', 'set_admin')]
    ]);
    ctx.reply(`👑 *TS OTP Hub Runner Panel*\n\nStatus: 🟢 ONLINE\n\nনতুন বট চালু করতে নিচের বাটনগুলো ব্যবহার করুন:`, { parse_mode: 'Markdown', ...inlineBtn });
});

runnerBot.action('set_token', async (ctx) => {
    userSessions[ctx.from.id] = { action: 'waiting_for_token' };
    await ctx.answerCbQuery();
    await ctx.reply("🤖 অনুগ্রহ করে আপনার নতুন বটের *HTTP API Token* টি সেন্ড করুন:");
});

runnerBot.action('set_admin', async (ctx) => {
    userSessions[ctx.from.id] = { action: 'waiting_for_admin' };
    await ctx.answerCbQuery();
    await ctx.reply("🆔 অনুগ্রহ করে অ্যাডমিনদের *Telegram User ID* দিন:");
});

runnerBot.on('text', async (ctx, next) => {
    const session = userSessions[ctx.from.id];
    if (!session) return next();
    const text = ctx.message.text.trim();

    if (session.action === 'waiting_for_token') {
        if (text.split(':').length !== 2) return ctx.reply("❌ এটি সঠিক টোকেন নয়।");
        
        // Supabase এ সেভ করা হচ্ছে
        const { error } = await supabase.from('bot_configs').upsert([{ id: 1, bot_token: text, status: 'online' }]);
        
        if (error) {
            return ctx.reply(`❌ ডাটাবেস এরর: ${error.message}`);
        }
        
        userSessions[ctx.from.id] = null; 
        
        // মূল বটের Webhook অটোমেটিক সেট করা
        try {
            await axios.get(`https://api.telegram.org/bot${text}/setWebhook?url=${PROJECT_URL}/child`);
            await ctx.reply(`✅ *Bot Token Saved!* Webhook Set.\nআপনার মূল বটটি এখন কাজ করার জন্য সম্পূর্ণ প্রস্তুত।`, { parse_mode: 'Markdown' });
        } catch(e) {
            await ctx.reply(`✅ টোকেন সেভ হয়েছে, কিন্তু Webhook সেট হয়নি। Vercel URL চেক করুন।`);
        }
    } 
    else if (session.action === 'waiting_for_admin') {
        await supabase.from('bot_configs').upsert([{ id: 1, admin_ids: text }]);
        userSessions[ctx.from.id] = null; 
        await ctx.reply(`✅ *Admin IDs Saved Successfully!*`, { parse_mode: 'Markdown' });
    }
});

// ==========================================
// 🚀 2. MAIN BOT / CHILD BOT (অ্যাডমিন প্যানেল সহ)
// ==========================================
async function handleChildBot(reqBody) {
    const { data, error } = await supabase.from('bot_configs').select('bot_token, admin_ids').eq('id', 1).single();
    if (error || !data || !data.bot_token) return;

    const mainBot = new Telegraf(data.bot_token);

    // সাধারণ ইউজারদের মেনু
    mainBot.command('start', (ctx) => {
        const inlineBtn = Markup.inlineKeyboard([
            [Markup.button.callback('📱 Get Number', 'get_number'), Markup.button.callback('📊 My stats', 'my_stats')]
        ]);
        ctx.reply(`🌟 *Welcome to TS OTP Hub!*\n\nনম্বর নিতে নিচের বাটনে ক্লিক করুন:`, { parse_mode: 'Markdown', ...inlineBtn });
    });

    // 👑 অ্যাডমিন প্যানেল মেনু (স্ক্রিনশটের মতো)
    mainBot.command('admin', async (ctx) => {
        // চেক করা ইউজার অ্যাডমিন কি না (admin_ids ডাটাবেস থেকে)
        const adminArray = data.admin_ids ? data.admin_ids.split(',') : [];
        if (!adminArray.includes(ctx.from.id.toString())) {
            return ctx.reply("⛔ আপনার এই মেনু অ্যাক্সেস করার অনুমতি নেই!");
        }

        const adminMenu = Markup.inlineKeyboard([
            [Markup.button.callback('🤖 Bot Status', 'adm_status'), Markup.button.callback('📢 Broadcast', 'adm_broadcast')],
            [Markup.button.callback('📦 Number Management', 'adm_num_mgt'), Markup.button.callback('💳 Payment System', 'adm_payment')],
            [Markup.button.callback('⚙️ Bot Settings', 'adm_settings'), Markup.button.callback('🔌 Panel Control', 'adm_panel')],
            [Markup.button.callback('🗑️ Clear History', 'adm_clear'), Markup.button.callback('📺 Channel Control', 'adm_channel')],
            [Markup.button.callback('🗄️ Database Management', 'adm_db'), Markup.button.callback('🚫 Ban/Unban User', 'adm_ban')]
        ]);

        await ctx.reply("👑 *ADMIN PANEL*\n━━━━━━━━━━━━━━━━━━\nSelect an option:", { parse_mode: 'Markdown', ...adminMenu });
    });

    // ⚙️ অ্যাডমিন সাব-মেনু: Panel Control (STEX API Gateway)
    mainBot.action('adm_panel', async (ctx) => {
        const panelMenu = Markup.inlineKeyboard([
            [Markup.button.callback('🔴 OFF Bot', 'toggle_main_bot'), Markup.button.callback('STEX SMS (Active 🟢)', 'stex_panel')],
            [Markup.button.callback('🔙 Back to Main Menu', 'back_to_admin')]
        ]);
        
        const panelText = `🔌 *Panel Control*\n\n🥰 *BOT STATUS* : Online 🟢\n\n✈️ *Panel Login status:*\nGreen(🟢) = ACTIVE\nRED(🔴) = Disabled\nBlue(⚡) = Not Set`;
        
        await ctx.editMessageText(panelText, { parse_mode: 'Markdown', ...panelMenu }).catch(()=>{});
    });

    // ⚙️ অ্যাডমিন সাব-মেনু: Bot Settings
    mainBot.action('adm_settings', async (ctx) => {
        const settingsMenu = Markup.inlineKeyboard([
            [Markup.button.callback('🔢 Set Max Buy Qty', 'set_qty'), Markup.button.callback('⏳ Set OTP Delay', 'set_delay')],
            [Markup.button.callback('⏱ Set Fetch Interval', 'set_interval'), Markup.button.callback('🛡 Set Anti-Spam Limit', 'set_spam')],
            [Markup.button.callback('🟢 Disable Console OTP', 'toggle_console'), Markup.button.callback('🔙 Back to Main Menu', 'back_to_admin')]
        ]);
        
        const settingsText = `⚙️ *BOT SETTINGS*\n━━━━━━━━━━━━━━━━━━\n🤖 Bot Status: 🟢\n🔢 Max Buy Qty: 10\n⏱ Fetch Interval: 15s\n⏳ OTP Delay: 0.3s\n🛡 Anti-Spam Limit: 200\n\nClick the buttons below to change settings.`;
        
        await ctx.editMessageText(settingsText, { parse_mode: 'Markdown', ...settingsMenu }).catch(()=>{});
    });

    // 🔙 ব্যাক বাটন হ্যান্ডলার
    mainBot.action('back_to_admin', async (ctx) => {
        const adminMenu = Markup.inlineKeyboard([
            [Markup.button.callback('🤖 Bot Status', 'adm_status'), Markup.button.callback('📢 Broadcast', 'adm_broadcast')],
            [Markup.button.callback('📦 Number Management', 'adm_num_mgt'), Markup.button.callback('💳 Payment System', 'adm_payment')],
            [Markup.button.callback('⚙️ Bot Settings', 'adm_settings'), Markup.button.callback('🔌 Panel Control', 'adm_panel')],
            [Markup.button.callback('🗑️ Clear History', 'adm_clear'), Markup.button.callback('📺 Channel Control', 'adm_channel')],
            [Markup.button.callback('🗄️ Database Management', 'adm_db'), Markup.button.callback('🚫 Ban/Unban User', 'adm_ban')]
        ]);
        await ctx.editMessageText("👑 *ADMIN PANEL*\n━━━━━━━━━━━━━━━━━━\nSelect an option:", { parse_mode: 'Markdown', ...adminMenu }).catch(()=>{});
    });

    // অন্যান্য বাটনের পপ-আপ রেসপন্স (ধাপে ধাপে এগুলোর ভেতরে লজিক বসবে)
    const pendingActions = ['adm_status', 'adm_broadcast', 'adm_num_mgt', 'adm_payment', 'adm_clear', 'adm_channel', 'adm_db', 'adm_ban'];
    pendingActions.forEach(action => {
        mainBot.action(action, async (ctx) => {
            await ctx.answerCbQuery("⏳ এই ফিচারের কাজ পরবর্তী আপডেটে যুক্ত করা হবে!", { show_alert: true });
        });
    });

    await mainBot.handleUpdate(reqBody);
}
// 🌍 Get Number & Live Traffic Menu (Directly from STEX SMS API)
    mainBot.action('get_number', async (ctx) => {
        await ctx.answerCbQuery("⏳ STEX API থেকে লাইভ ট্রাফিক আনা হচ্ছে...");

        try {
            // ⚠️ STEX API থেকে লাইভ ট্রাফিক আনা (আসল API কল)
            // নোট: '/active-countries' এর জায়গায় STEX এর আসল লাইভ ট্রাফিক এন্ডপয়েন্টটি বসাতে হতে পারে
            const response = await axios.get(`${STEX_BASE_URL}/active-countries`, { headers: STEX_HEADERS });
            
            // API থেকে পাওয়া ডেটা (ধরে নিলাম ডেটা response.data এর ভেতর লিস্ট আকারে আছে)
            const activeCountries = response.data.data || response.data || [];

            if (activeCountries.length === 0) {
                return ctx.reply("❌ বর্তমানে STEX API তে কোনো লাইভ ট্রাফিক নেই।");
            }

            // STEX API এর রেসপন্স অনুযায়ী ডাইনামিক বাটন তৈরি
            let buttons = activeCountries.map(c => {
                // ⚠️ STEX API এর JSON response এর উপর ভিত্তি করে c.name, c.traffic_status, c.country_code মেলাতে হবে। 
                // উদাহরণ: STEX যদি দেশের নাম c.CountryName হিসেবে দেয়, তবে এখানে c.CountryName লিখতে হবে।
                const countryName = c.name || c.country_name || c.country || 'Unknown';
                const trafficStatus = c.traffic || c.status || '🟢';
                const countryCode = c.id || c.country_code || c.code;

                return [Markup.button.callback(`${countryName} : ${trafficStatus}`, `buy_${countryCode}`)];
            });

            buttons.push([Markup.button.callback('🔙 Back to Main Menu', 'start_menu')]);

            const trafficText = `🔥 *30 Minute LIVE Traffic (STEX SMS)*\n━━━━━━━━━━━━━━━━━━\n📱 *Service:* FACEBOOK\n\nনিচের লিস্ট থেকে একটিভ কান্ট্রি সিলেক্ট করুন:`;

            if (ctx.callbackQuery.message.text) {
                await ctx.editMessageText(trafficText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }).catch(()=>{});
            } else {
                await ctx.reply(trafficText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
            }
        } catch (error) {
            console.error("STEX API Fetch Error:", error.message);
            await ctx.reply("❌ STEX API এর সাথে কানেক্ট করতে সমস্যা হচ্ছে। আপনার API URL বা Token চেক করুন।");
        }
    });
