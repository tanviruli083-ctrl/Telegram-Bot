const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// ==========================================
// 🔑 CREDENTIALS (আপনার মাস্টার বটের তথ্য)
// ==========================================
const MASTER_BOT_TOKEN = '8729636637:AAFUyoKeK7NT0-1EAlFgHJcXmdfbbr-ZIaI';
const SUPABASE_URL = 'https://fwfacvvugaazlffckmxz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-1p3Ee4gAxxkJu_PpRTaVA_BOUDvIjF';

// STEX API Config
const STEX_BASE_URL = 'https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api';
const STEX_HEADERS = { 'mauthapi': 'M704VEUDSZ3' };

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const runnerBot = new Telegraf(MASTER_BOT_TOKEN);

const userSessions = {};
const ADMIN_GROUP_ID = '-100XXXXXXXXX'; // ওটিপি ফরোয়ার্ড হওয়ার গ্রুপ আইডি

// ==========================================
// 🤖 1. RUNNER BOT (শুধুমাত্র টোকেন ও আইডি নেওয়ার জন্য)
// ==========================================
runnerBot.command('start', (ctx) => {
    userSessions[ctx.from.id] = null; 
    const inlineBtn = Markup.inlineKeyboard([
        [Markup.button.callback('🤖 Set Bot Token', 'set_token'), Markup.button.callback('🆔 Set Admin IDs', 'set_admin')],
        [Markup.button.callback('🟢 Turn ON / 🔴 OFF', 'toggle_bot')]
    ]);
    ctx.reply(`👑 *TS OTP Hub Runner Panel*\n\nStatus: 🟢 ONLINE\n\nনতুন বট চালু করতে নিচের বাটনগুলো ব্যবহার করুন:`, { parse_mode: 'Markdown', ...inlineBtn });
});

runnerBot.action('set_token', async (ctx) => {
    userSessions[ctx.from.id] = { action: 'waiting_for_token' };
    await ctx.answerCbQuery();
    await ctx.reply("🤖 অনুগ্রহ করে আপনার নতুন বটের *HTTP API Token* টি সেন্ড করুন:", { parse_mode: 'Markdown' });
});

runnerBot.action('set_admin', async (ctx) => {
    userSessions[ctx.from.id] = { action: 'waiting_for_admin' };
    await ctx.answerCbQuery();
    await ctx.reply("🆔 অনুগ্রহ করে অ্যাডমিনদের *Telegram User ID* দিন:", { parse_mode: 'Markdown' });
});

runnerBot.on('text', async (ctx, next) => {
    const session = userSessions[ctx.from.id];
    if (!session) return next();
    const text = ctx.message.text.trim();

    if (session.action === 'waiting_for_token') {
        if (text.split(':').length !== 2) return ctx.reply("❌ এটি সঠিক টোকেন নয়।");
        
        await supabase.from('bot_configs').upsert([{ id: 1, bot_token: text, status: 'online' }]);
        userSessions[ctx.from.id] = null; 
        
        // ⚠️ ম্যাজিক এখানে: রানার বট নিজেই নতুন বটের Webhook সেট করে দিচ্ছে
        const vercelUrl = `https://${ctx.req?.headers?.host || 'your-project.vercel.app'}`;
        try {
            await axios.get(`https://api.telegram.org/bot${text}/setWebhook?url=${vercelUrl}/child`);
            await ctx.reply(`✅ *Bot Token Saved!* Webhook Set.\nআপনার মূল বটটি এখন কাজ করার জন্য সম্পূর্ণ প্রস্তুত।`, { parse_mode: 'Markdown' });
        } catch(e) {
            await ctx.reply(`✅ টোকেন সেভ হয়েছে, কিন্তু Webhook অটো সেট হয়নি। দয়া করে ম্যানুয়ালি সেট করুন।`);
        }
    } 
    else if (session.action === 'waiting_for_admin') {
        await supabase.from('bot_configs').upsert([{ id: 1, admin_ids: text }]);
        userSessions[ctx.from.id] = null; 
        await ctx.reply(`✅ *Admin IDs Saved Successfully!*`, { parse_mode: 'Markdown' });
    }
});

// ==========================================
// 🚀 2. MAIN BOT / CHILD BOT (যেখানে সব মূল ফিচার থাকবে)
// ==========================================
// ডাটাবেস থেকে টোকেন এনে মূল বট তৈরি করার ফাংশন
async function handleChildBot(reqBody) {
    const { data, error } = await supabase.from('bot_configs').select('bot_token').eq('id', 1).single();
    if (error || !data || !data.bot_token) return;

    const mainBot = new Telegraf(data.bot_token);

    mainBot.command('start', (ctx) => {
        const inlineBtn = Markup.inlineKeyboard([
            [Markup.button.callback('📱 Get Number', 'get_number')]
        ]);
        ctx.reply(`🌟 *Welcome to TS OTP Hub!*\n\nSTEX API দ্বারা চালিত। নম্বর নিতে বাটনে ক্লিক করুন:`, { parse_mode: 'Markdown', ...inlineBtn });
    });

    mainBot.action('get_number', async (ctx) => {
        await ctx.answerCbQuery("⏳ Fetching active ranges...");
        // ডেমো রেঞ্জ (API থেকে লাইভ আসবে)
        const activeCountries = [
            { id: 'GN', name: '🇬🇳 Guinea', traffic: 'High 🟢' },
            { id: 'BJ', name: '🇧🇯 Benin', traffic: 'Medium 🟡' }
        ];
        let buttons = activeCountries.map(c => [Markup.button.callback(`${c.name} - ${c.traffic}`, `buy_${c.id}`)]);
        
        await ctx.reply("🔥 *Active LIVE Traffic Ranges:*\nকোন দেশের নম্বর নিতে চান সিলেক্ট করুন:", {
            parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons }
        });
    });

    mainBot.action(/buy_(.+)/, async (ctx) => {
        const countryCode = ctx.match[1];
        await ctx.answerCbQuery(`Requesting number for ${countryCode}...`);
        
        const dummyNumber = "+22465559140"; // STEX API Response
        await ctx.reply(`✅ *Number Activated!*\n📱 Number: \`${dummyNumber}\`\n🌍 Country: ${countryCode}\n⏳ Waiting for OTP... (Auto Fetch Active)`, { parse_mode: 'Markdown' });
    });

    await mainBot.handleUpdate(reqBody);
}

// ==========================================
// 🌐 3. VERCEL ROUTER (এখানে রিকোয়েস্ট ভাগ হবে)
// ==========================================
module.exports = async function handler(req, res) {
    // URL রাউটিং: রিকোয়েস্ট রানার বটের নাকি মূল বটের তা নির্ধারণ করা
    
    // 1. রানার বটের ট্রাফিক
    if (req.method === 'POST' && req.url === '/runner') {
        req.body.req = req; // হোস্ট ইউআরএল পাস করার জন্য
        await runnerBot.handleUpdate(req.body);
        return res.status(200).send('Runner Bot OK');
    }
    
    // 2. মূল বটের (Test bot) ট্রাফিক
    if (req.method === 'POST' && req.url === '/child') {
        await handleChildBot(req.body);
        return res.status(200).send('Child Bot OK');
    }

    // 3. অটো ওটিপি ফরোয়ার্ড (Cron Job)
    if (req.method === 'GET' && req.url === '/check-otp') {
        const hasNewOtp = true; 
        if (hasNewOtp) {
            const forwardMsg = `🔥 *NEW OTP RECEIVED!*\n━━━━━━━━━━━━━━━━━━\n📱 *Platform:* Facebook\n🌍 *Country:* 🇬🇳 Guinea\n📞 *Number:* \`224654564008\`\n💬 *Code:* \`024589\`\n━━━━━━━━━━━━━━━━━━`;
            await runnerBot.telegram.sendMessage(ADMIN_GROUP_ID, forwardMsg, { parse_mode: 'Markdown' }).catch(()=>{});
        }
        return res.status(200).send('OTP Checked');
    }

    return res.status(200).send('TS Routing System is Live!');
};
