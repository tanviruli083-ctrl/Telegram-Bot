import os
import json
import telebot
from fbchat import Client
from fbchat.models import *

# টেলিগ্রাম বট টোকেন (Vercel Environment Variable থেকে নিন)
BOT_TOKEN = os.environ.get("BOT_TOKEN")
if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN environment variable not set")

bot = telebot.TeleBot(BOT_TOKEN)

# ওয়েবহুক সেট করতে হবে (Vercel এর জন্য)
@bot.message_handler(commands=['start'])
def send_welcome(message):
    bot.reply_to(message, 
        "স্বাগতম! ফেসবুক লগইনের জন্য আপনার ইমেইল ও পাসওয়ার্ড দিন।\n"
        "ফরম্যাট: `email:password`\n"
        "⚠️ শুধুমাত্র নিজের অ্যাকাউন্টের জন্য ব্যবহার করুন।")

@bot.message_handler(func=lambda msg: ':' in msg.text)
def handle_login(message):
    try:
        email, password = message.text.split(':', 1)
        email = email.strip()
        password = password.strip()

        bot.reply_to(message, "লগইন প্রক্রিয়া চলছে...")

        # fbchat দিয়ে লগইন
        client = Client(email, password)
        
        # কুকি সংগ্রহ (fbchat এর সেশন থেকে)
        cookies = client.session.cookies.get_dict()
        
        # কুকি ফরম্যাট করে পাঠান
        cookie_str = json.dumps(cookies, indent=2)
        
        if len(cookie_str) > 4000:
            # বড় হলে ফাইল হিসেবে পাঠান
            with open("/tmp/cookies.txt", "w") as f:
                f.write(cookie_str)
            with open("/tmp/cookies.txt", "rb") as f:
                bot.send_document(message.chat.id, f)
            os.remove("/tmp/cookies.txt")
        else:
            bot.send_message(
                message.chat.id, 
                f"🧾 আপনার ফেসবুক কুকি:\n
                                parse_mode="Markdown"
            )
        
        # লগআউট
        client.logout()

    except Exception as e:
        error_msg = str(e)
        if "Invalid credentials" in error_msg:
            bot.reply_to(message, "❌ ভুল ইমেইল বা পাসওয়ার্ড।")
        elif "2FA required" in error_msg:
            bot.reply_to(message, "❌ টু-ফ্যাক্টর অথেনটিকেশন চালু আছে। বর্তমানে শুধু 2FA ছাড়া অ্যাকাউন্ট সাপোর্ট করে।")
        else:
            bot.reply_to(message, f"❌ ত্রুটি: {error_msg}")

# অন্যান্য মেসেজ
@bot.message_handler(func=lambda msg: True)
def echo_all(message):
    bot.reply_to(message, "অনুগ্রহ করে `email:password` ফরম্যাটে দিন। `/start` লিখে দেখুন।")

# Vercel এর জন্য ওয়েবহুক হ্যান্ডলার
def webhook(request):
    if request.method == "POST":
        json_str = request.get_data().decode('UTF-8')
        update = telebot.types.Update.de_json(json_str)
        bot.process_new_updates([update])
        return "OK", 200
    else:
        return "OK", 200
