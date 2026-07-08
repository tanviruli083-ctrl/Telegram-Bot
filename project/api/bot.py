from http.server import BaseHTTPRequestHandler
import telebot
from fbchat import Client
from fbchat.models import *

# টেলিগ্রাম বট টোকেন (আপনার নিজের টোকেন দিন)
TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"
bot = telebot.TeleBot(TOKEN)

# ফেসবুক থেকে কুকি বের করার ফাংশন
def get_facebook_cookies(email, password):
    try:
        client = Client(email, password)
        cookies = client.session.cookies.get_dict()
        client.logout()
        return cookies, None
    except Exception as e:
        return None, str(e)

# টেলিগ্রাম মেসেজ হ্যান্ডলার
@bot.message_handler(func=lambda message: True)
def handle_message(message):
    # ইউজার ইমেইল ও পাসওয়ার্ড ':' দিয়ে আলাদা করে লিখবে, যেমন: example@mail.com:password123
    if ':' in message.text:
        email, password = message.text.split(':', 1)
        email = email.strip()
        password = password.strip()
        
        bot.reply_to(message, "⏳ লগইন করছি, দয়া করে অপেক্ষা করুন...")
        cookies, error = get_facebook_cookies(email, password)
        
        if error:
            bot.reply_to(message, f"❌ ত্রুটি: {error}")
        else:
            cookie_str = '\n'.join([f"{k}={v}" for k, v in cookies.items()])
            bot.reply_to(message, f"✅ কুকি সফলভাবে সংগ্রহ করা হয়েছে:\n\n{cookie_str}")
    else:
        bot.reply_to(message, "⚠️ দয়া করে ফরম্যাটে দিন: `ইমেইল:পাসওয়ার্ড`")

# Vercel-এর জন্য HTTP হ্যান্ডলার (টেলিগ্রাম ওয়েবহুক)
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length)
        bot.process_new_updates([telebot.types.Update.de_json(body.decode('utf-8'))])
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write("Bot is running!".encode())
