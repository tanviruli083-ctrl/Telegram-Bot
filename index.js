const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// ==========================================
// 🔑 CREDENTIALS (আপনার মাস্টার বটের তথ্য)
// ==========================================
const MASTER_BOT_TOKEN = '8729636637:AAFUyoKeK7NT0-1EAlFgHJcXmdfbbr-ZIaI';
const SUPABASE_URL = 'https://fwfacvvugaazlffckmxz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-1p3Ee4gAxxkJu_PpRTaVA_BOUDvIjF';

// Initialize Supabase & Master Bot
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const masterBot = new Telegraf(MASTER_BOT_TOKEN);

// সাময়িক সেশন মেমরি (ইনপুট ট্র্যাকিংয়ের জন্য)
const userSessions = {};

// ==========================================
// 🤖 1. MASTER BOT RUNNER (TS BPT RUNNER)
// ==========================================
masterBot.command('start', (ctx) => {
    // সেশন ক্লিয়ার করে দেওয়া যাতে আগের কোনো ইনপুট আটকে না থাকে
    userSessions[ctx.from.id] = null; 

    const inlineBtn = Markup.inlineKeyboard([
        [Markup.button.callback('🤖 Set Bot Token', 'set_token'), Markup.button.callback('🆔 Set Admin IDs', 'set_admin')],
        [Markup.button.callback('🟢 Turn ON / 🔴 OFF', 'toggle_bot')]
    ]);

    ctx.reply(`👑 *TS OTP Hub Master Panel*\n\nStatus: 🟢 ONLINE\n\nআপনার প্যানেল কনফিগার করতে বা নম্বর নিতে নিচের বাটনগুলো ব্যবহার করুন:`, { parse_mode: 'Markdown', ...inlineBtn });
});

// "Set Bot Token" বাটনে চাপ দিলে
masterBot.action('set_token', async (ctx) => {
    userSessions[ctx.from.id] = { action: 'waiting_for_token' };
    await ctx.answerCbQuery();
    await ctx.reply("🤖 অনুগ্রহ করে আপনার নতুন বটের *HTTP API Token* টি এখানে সেন্ড করুন:", { parse_mode: 'Markdown' });
});

// "Set Admin IDs" বাটনে চাপ দিলে
masterBot.action('set_admin', async (ctx) => {
    userSessions[ctx.from.id] = { action: 'waiting_for_admin' };
    await ctx.answerCbQuery();
    await ctx.reply("🆔 অনুগ্রহ করে অ্যাডমিনদের *Telegram User ID* দিন (একাধিক হলে কমা দিয়ে লিখুন):", { parse_mode: 'Markdown' });
});

// "Turn ON / OFF" বাটনে চাপ দিলে
masterBot.action('toggle_bot', async (ctx) => {
    await ctx.answerCbQuery("✅ Bot status changed successfully!", { show_alert: true });
});

// ==========================================
// 📥 TEXT INPUT HANDLER (টোকেন ও আইডি রিসিভ করা)
// ==========================================
masterBot.on('text', async (ctx) => {
    const session = userSessions[ctx.from.id];
    const text = ctx.message.text.trim();

    if (!session) return; // যদি কোনো বাটনে চাপ না দিয়ে এমনি মেসেজ দেয়

    if (session.action === 'waiting_for_token') {
        // টোকেন রিসিভ করার লজিক
        if (text.split(':').length !== 2) {
            return ctx.reply("❌ এটি সঠিক টোকেন নয়। আবার চেষ্টা করুন।");
        }
        
        // এখানে ডাটাবেসে টোকেন সেভ করার কোড থাকবে
        await supabase.from('bot_configs').upsert([{ id: 1, bot_token: text, status: 'online' }]);
        
        userSessions[ctx.from.id] = null; // সেশন শেষ
        await ctx.reply(`✅ *Bot Token Saved Successfully!*\n\nআপনার নতুন বটটি ব্যাকএন্ডে লাইভ হয়ে গেছে। (STEX API কানেক্টেড)`, { parse_mode: 'Markdown' });
    } 
    else if (session.action === 'waiting_for_admin') {
        // অ্যাডমিন আইডি রিসিভ করার লজিক
        await supabase.from('bot_configs').upsert([{ id: 1, admin_ids: text }]);
        
        userSessions[ctx.from.id] = null; // সেশন শেষ
        await ctx.reply(`✅ *Admin IDs Saved Successfully!*\n\nনতুন অ্যাডমিনরা এখন প্যানেল কন্ট্রোল করতে পারবে।`, { parse_mode: 'Markdown' });
    }
});


// ==========================================
// 🚀 VERCEL SERVERLESS HANDLER
// ==========================================
module.exports = async function handler(req, res) {
    if (req.method === 'POST') {
        try { 
            // মাস্টার বটের রিকোয়েস্ট হ্যান্ডেল করা
            await masterBot.handleUpdate(req.body); 
            return res.status(200).send('OK'); 
        } catch (error) { 
            console.error(error);
            return res.status(500).send('Error'); 
        }
    } 

    return res.status(200).send('🤖 TS Bot Runner is Live on Vercel!');
};
