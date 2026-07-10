const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// ==========================================
// 🔑 CREDENTIALS (আপনার দেওয়া তথ্য)
// ==========================================
const BOT_TOKEN = '8729636637:AAFUyoKeK7NT0-1EAlFgHJcXmdfbbr-ZIaI';
const SUPABASE_URL = 'https://fwfacvvugaazlffckmxz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-1p3Ee4gAxxkJu_PpRTaVA_BOUDvIjF';

// STEX API Config
const STEX_BASE_URL = 'https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api';
const STEX_HEADERS = { 'mauthapi': 'M704VEUDSZ3' };

// Initialize Supabase & Telegram Bot
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new Telegraf(BOT_TOKEN);

// সাময়িক সেশন মেমরি
const userSessions = {};
const ADMIN_GROUP_ID = '-100XXXXXXXXX'; // আপনার লগ ফরোয়ার্ড করার টেলিগ্রাম গ্রুপের আইডি এখানে বসাবেন

// ==========================================
// 🤖 1. MASTER BOT RUNNER (FACTORY PANEL)
// ==========================================
bot.command('start', (ctx) => {
    const inlineBtn = Markup.inlineKeyboard([
        [Markup.button.callback('🤖 Set Bot Token', 'set_token'), Markup.button.callback('🆔 Set Admin IDs', 'set_admin')],
        [Markup.button.callback('🟢 Turn ON / 🔴 OFF', 'toggle_bot')],
        [Markup.button.callback('📱 Get Number (STEX API)', 'get_number_menu')]
    ]);

    ctx.reply(`👑 *TS OTP Hub Master Panel*\n\nStatus: 🟢 ONLINE\n\nআপনার প্যানেল কনফিগার করতে বা নম্বর নিতে নিচের বাটনগুলো ব্যবহার করুন:`, { parse_mode: 'Markdown', ...inlineBtn });
});

bot.action('set_token', (ctx) => ctx.answerCbQuery("Send your new Bot Token in chat:", { show_alert: true }));
bot.action('set_admin', (ctx) => ctx.answerCbQuery("Send Admin IDs separated by comma:", { show_alert: true }));
bot.action('toggle_bot', (ctx) => ctx.answerCbQuery("✅ Bot status changed successfully!", { show_alert: true }));

// ==========================================
// 🌍 2. DYNAMIC 'GET NUMBER' MENU (STEX API)
// ==========================================
bot.action('get_number_menu', async (ctx) => {
    await ctx.answerCbQuery("⏳ Fetching active ranges...");
    try {
        // STEX API থেকে লাইভ ট্রাফিক ফেচ করা (API Endpoint আপনার প্যানেল অনুযায়ী এডজাস্ট হতে পারে)
        // const response = await axios.get(`${STEX_BASE_URL}/active-countries`, { headers: STEX_HEADERS });
        
        // ডেমো রেসপন্স (যেহেতু রিয়েল এপিআই স্ট্রাকচার হাইড করা থাকে)
        const activeCountries = [
            { id: 'GN', name: '🇬🇳 Guinea', traffic: 'High 🟢' },
            { id: 'BJ', name: '🇧🇯 Benin', traffic: 'Medium 🟡' }
        ];

        let buttons = activeCountries.map(c => [Markup.button.callback(`${c.name} - ${c.traffic}`, `buy_${c.id}`)]);
        buttons.push([Markup.button.callback('❌ Cancel', 'cancel')]);

        await ctx.reply("🔥 *Active LIVE Traffic Ranges:*\nকোন দেশের নম্বর নিতে চান সিলেক্ট করুন:", {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        });
    } catch (err) {
        await ctx.reply("❌ STEX API এর সাথে কানেক্ট করা যাচ্ছে না!");
    }
});

bot.action(/buy_(.+)/, async (ctx) => {
    const countryCode = ctx.match[1];
    await ctx.answerCbQuery(`Requesting number for ${countryCode}...`);
    
    try {
        // STEX API কল করে নম্বর কেনা
        // const response = await axios.post(`${STEX_BASE_URL}/get-number`, { country: countryCode }, { headers: STEX_HEADERS });
        const dummyNumber = "+22465559140"; // API response আসার পর এখানে বসবে
        
        await ctx.reply(`✅ *Number Activated!*\n\n📱 Number: \`${dummyNumber}\`\n🌍 Country: ${countryCode}\n⏳ Waiting for OTP... (Auto Fetch Active)`, { parse_mode: 'Markdown' });
        
        // ডাটাবেসে নম্বর ট্র্যাকিং এর জন্য সেভ করা
        await supabase.from('active_numbers').insert([{ number: dummyNumber, country: countryCode, status: 'waiting' }]);
        
    } catch (err) {
        await ctx.reply("❌ নম্বর পেতে সমস্যা হয়েছে। ব্যালেন্স বা API চেক করুন।");
    }
});

// ==========================================
// 🚀 3. VERCEL SERVERLESS & AUTO OTP FORWARDER
// ==========================================
module.exports = async function handler(req, res) {
    // টেলিগ্রাম থেকে আসা মেসেজগুলো প্রসেস করার জন্য
    if (req.method === 'POST' && req.url === '/webhook') {
        try { 
            await bot.handleUpdate(req.body); 
            return res.status(200).send('OK'); 
        } catch (error) { 
            return res.status(500).send('Error'); 
        }
    } 
    
    // 🔄 AUTO OTP FETCHER (এই লিংকে হিট পড়লে অটোমেটিক OTP চেক হয়ে গ্রুপে যাবে)
    if (req.method === 'GET' && req.url === '/check-otp') {
        try {
            // STEX Console থেকে সাকসেসফুল OTP গুলো আনা
            // const response = await axios.get(`${STEX_BASE_URL}/success-otp`, { headers: STEX_HEADERS });
            
            // ডেমো লজিক: API থেকে পাওয়া ডাটা প্রসেস করে গ্রুপে ফরোয়ার্ড করা
            const hasNewOtp = true; // API চেক করে এখানে কন্ডিশন বসবে
            const otpData = { number: "224654564008", code: "024589", platform: "Facebook 1", country: "🇬🇳 Guinea" };
            
            if (hasNewOtp) {
                const forwardMsg = `🔥 *NEW OTP RECEIVED!*\n━━━━━━━━━━━━━━━━━━\n📱 *Platform:* ${otpData.platform}\n🌍 *Country:* ${otpData.country}\n📞 *Number:* \`${otpData.number}\`\n💬 *Code:* \`${otpData.code}\`\n━━━━━━━━━━━━━━━━━━`;
                
                // গ্রুপে পাঠানো
                await bot.telegram.sendMessage(ADMIN_GROUP_ID, forwardMsg, { parse_mode: 'Markdown' }).catch(()=>{});
            }
            return res.status(200).send('OTP Check & Forward Complete!');
        } catch (err) {
            return res.status(500).send('STEX Fetch Error');
        }
    }

    return res.status(200).send('🤖 TS OTP Hub Runner is Live!');
};
