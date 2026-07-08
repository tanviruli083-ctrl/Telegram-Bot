const { Telegraf, Markup } = require('telegraf');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

// 🔑 আপনার দেওয়া নতুন টেলিগ্রাম বট টোকেন
const BOT_TOKEN = '8571540558:AAElXGGNGLjIb1c0_1kBm4jlS2CGOg5F3nU'; 
const bot = new Telegraf(BOT_TOKEN);

// ইউজার সেশন ও ক্রেডেনশিয়াল রাখার জন্য অবজেক্ট
const userSessions = {}; 

// ==========================================
// 🔐 IMAP ACCESS VERIFICATION FUNCTION
// ==========================================
async function verifyGmailAccess(email, appPassword) {
    const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user: email, pass: appPassword },
        logger: false
    });

    try {
        await client.connect();
        await client.logout();
        return true; // লগইন সফল হলে true
    } catch (err) {
        return false; // ব্যর্থ হলে false
    }
}

// ==========================================
// 🎲 GMAIL DOT TRICK GENERATOR FUNTION
// ==========================================
function generateGmailDotTrick(email) {
    const [username, domain] = email.split('@');
    if (!domain || domain.toLowerCase() !== 'gmail.com') return null;

    let result = "";
    for (let i = 0; i < username.length; i++) {
        let char = username[i];
        // ৫০% চান্স ক্যাপিটাল লেটার হওয়ার
        result += Math.random() > 0.5 ? char.toUpperCase() : char.toLowerCase();
        
        // শেষ অক্ষরের আগে ৫০% চান্স ডট (.) বসার
        if (i < username.length - 1 && Math.random() > 0.5) {
            result += ".";
        }
    }
    return `${result}@gmail.com`;
}

// ==========================================
// 📥 IMAP GMAIL OTP EXTRACTOR FUNCTION
// ==========================================
async function checkLatestEmail(ctx, email, appPassword) {
    const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user: email, pass: appPassword },
        logger: false
    });

    try {
        await client.connect();
        let lock = await client.getMailboxLock('INBOX');
        try {
            if (client.mailbox.exists === 0) {
                await ctx.reply("📭 আপনার ইনবক্সটি সম্পূর্ণ খালি!");
                return;
            }

            let message = await client.fetchOne(client.mailbox.exists, { source: true });
            let parsed = await simpleParser(message.source);
            
            const subject = parsed.subject || "";
            const text = parsed.text || parsed.html || "";
            const from = parsed.from?.text || "Unknown Sender";

            // ওটিপি কোড এক্সট্রাক্ট করার জন্য (৪ থেকে ৮ ডিজিট)
            const otpMatch = text.match(/\b\d{4,8}\b/);
            const code = otpMatch ? otpMatch[0] : "কোড পাওয়া যায়নি";

            let platform = "Unknown App";
            if (from.toLowerCase().includes('telegram') || subject.toLowerCase().includes('telegram')) platform = "🔹 Telegram";
            else if (from.toLowerCase().includes('facebook') || subject.toLowerCase().includes('facebook')) platform = "🔷 Facebook";
            else if (from.toLowerCase().includes('google') || subject.toLowerCase().includes('google')) platform = "🔸 Google";
            else {
                platform = from.split('<')[0].trim();
            }

            const responseMsg = `📬 *NEW OTP RECEIVED!*\n━━━━━━━━━━━━━━━━━━\n📱 *Platform:* ${platform}\n💬 *Code:* \`${code}\`\n\n📧 _From: ${from}_`;
            await ctx.reply(responseMsg, { parse_mode: 'Markdown' });

        } finally {
            lock.release();
        }
        await client.logout();
    } catch (err) {
        await ctx.reply("❌ ওটিপি চেক করতে সমস্যা হয়েছে! প্রসেসটি আবার ট্রাই করুন বা আপনার App Password চেক করুন।");
    }
}

// ==========================================
// 🤖 TELEGRAM BOT COMMANDS & HANDLERS
// ==========================================
bot.command('start', (ctx) => {
    const mainMenu = Markup.keyboard([
        ['⚙️ Setup / Change Gmail', '❌ Remove Gmail'],
        ['📧 Gmail Generator']
    ]).resize();
    
    ctx.reply(`🌟 *Welcome to Premium Gmail OTP Bot!* 🚀\n\nমেনু থেকে আপনার পছন্দসই অপশনটি সিলেক্ট করুন।`, { parse_mode: 'Markdown', ...mainMenu });
});

// জিমেইল সেটআপ বা চেঞ্জ করার অপশন
bot.hears('⚙️ Setup / Change Gmail', async (ctx) => {
    userSessions[ctx.from.id] = { status: 'waiting_email' };
    await ctx.reply("📧 অনুগ্রহ করে আপনার *Gmail Address* টি পাঠান:\n_(Example: siyamexclusive@gmail.com)_", { parse_mode: 'Markdown' });
});

// জিমেইল রিমুভ করার অপশন
bot.hears('❌ Remove Gmail', async (ctx) => {
    if (userSessions[ctx.from.id] && userSessions[ctx.from.id].email) {
        delete userSessions[ctx.from.id];
        ctx.reply("✅ আপনার জিমেইল এক্সেস সফলভাবে রিমুভ করা হয়েছে।");
    } else {
        ctx.reply("❌ আপনার কোনো জিমেইল অ্যাকাউন্ট সেট করা নেই!");
    }
});

// ডট ট্রিক জেনারেটর এবং সাথে ইনলাইন বাটন
bot.hears('📧 Gmail Generator', async (ctx) => {
    const session = userSessions[ctx.from.id];
    if (!session || !session.email) {
        return ctx.reply("⚠️ প্রথমে '⚙️ Setup / Change Gmail' বাটনে ক্লিক করে আপনার ইমেইল সেট করুন।");
    }
    
    const trickEmail = generateGmailDotTrick(session.email);
    if (!trickEmail) return ctx.reply("❌ এটি জিমেইল অ্যাকাউন্ট না হওয়ায় জেনারেট করা সম্ভব হয়নি।");

    // ইনলাইন বাটন হিসেবে "Code Fetch" জুড়ে দেওয়া হলো
    const inlineBtn = Markup.inlineKeyboard([
        [Markup.button.callback('💬 Code Fetch', 'fetch_otp')]
    ]);

    ctx.reply(`🔥 *Generated Gmail:* \n\n\`${trickEmail}\`\n\n_কোড পাঠানোর পর নিচের বাটনে চাপুন:_`, { parse_mode: 'Markdown', ...inlineBtn });
});

// ইনলাইন "Code Fetch" বাটন হ্যান্ডলার
bot.action('fetch_otp', async (ctx) => {
    const session = userSessions[ctx.from.id];
    if (!session || !session.email || !session.pass) {
        return ctx.answerCbQuery("⚠️ কোনো একটিভ জিমেইল এক্সেস পাওয়া যায়নি!", { show_alert: true });
    }
    
    await ctx.answerCbQuery("⏳ ওটিপি চেক করা হচ্ছে...");
    const statusMsg = await ctx.reply("⏳ আপনার জিমেইল ইনবক্স চেক করা হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।");
    
    await checkLatestEmail(ctx, session.email, session.pass);
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(()=>{});
});

// টেক্সট ইনপুট হ্যান্ডলার (ধাপ অনুযায়ী জিমেইল ও পাসওয়ার্ড যাচাই)
bot.on('text', async (ctx, next) => {
    const session = userSessions[ctx.from.id];
    if (!session || !session.status) return next();

    const text = ctx.message.text.trim();

    if (session.status === 'waiting_email') {
        if (!text.toLowerCase().includes('@gmail.com')) return ctx.reply("❌ এটি একটি বৈধ জিমেইল নয়। আবার চেষ্টা করুন।");
        session.temp_email = text;
        session.status = 'waiting_password';
        await ctx.reply(`✅ ইমেইল সংরক্ষিত হয়েছে।\n\n🔐 এবার এই জিমেইলের **16-digit App Password** টি পাঠান:`, { parse_mode: 'Markdown' });
    } 
    else if (session.status === 'waiting_password') {
        const password = text.replace(/\s+/g, ''); // পাসওয়ার্ডের সব স্পেস রিমুভ করার জন্য
        
        const statusMsg = await ctx.reply("⏳ আপনার জিমেইল এক্সেস ভেরিফাই করা হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।");
        
        // জিমেইল লগইন ভেরিফিকেশন
        const isAccessOk = await verifyGmailAccess(session.temp_email, password);
        
        if (isAccessOk) {
            // অ্যাক্সেস কনফার্ম হলে মেইন সেশনে ডাটা সেভ হবে
            session.email = session.temp_email;
            session.pass = password;
            session.status = null;
            
            await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(()=>{});
            await ctx.reply(`✅ *Access Confirmed!*\n\n🎉 আপনার জিমেইল সফলভাবে কানেক্ট হয়েছে। এখন আপনি জেনারেটর ব্যবহার করতে পারবেন।`, { parse_mode: 'Markdown' });
        } else {
            // অ্যাক্সেস ফেইল হলে সেশন রিসেট হবে
            session.status = null;
            await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(()=>{});
            await ctx.reply("❌ *Access Denied!*\n\nআপনার দেওয়া ইমেইল অথবা App Password টি ভুল ছিল। দয়া করে আবার সঠিকভাবে সেটআপ করুন।", { parse_mode: 'Markdown' });
        }
    }
});

// ==========================================
// 🚀 VERCEL SERVERLESS HANDLER
// ==========================================
module.exports = async function handler(req, res) {
    if (req.method === 'POST') {
        try { 
            await bot.handleUpdate(req.body); 
            res.status(200).send('OK'); 
        } catch (error) { res.status(500).send('Error'); }
    } else { 
        res.status(200).send('🤖 Premium OTP Bot is Running perfectly on Vercel!'); 
    }
};
