import { Rank } from '../types';

export function generateSqlSchema(ranks: Rank[]): string {
  // Sort ranks by min_messages and sort_order
  const sortedRanks = [...ranks].sort((a, b) => a.min_messages - b.min_messages || a.sort_order - b.sort_order);

  let insertRanksSql = '';
  sortedRanks.forEach((r, idx) => {
    const choiceKey = r.group_choice_key ? `'${r.group_choice_key}'` : 'NULL';
    insertRanksSql += `INSERT OR IGNORE INTO ranks (id, title, emoji, min_messages, sort_order, group_choice_key) VALUES (${r.id}, '${r.title}', '${r.emoji}', ${r.min_messages}, ${r.sort_order || (idx + 1) * 10}, ${choiceKey});\n`;
  });

  return `CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  chat_id INTEGER,
  owner_id INTEGER
);

CREATE TABLE IF NOT EXISTS ranks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  emoji TEXT,
  min_messages INTEGER,
  sort_order INTEGER,
  group_choice_key TEXT
);

CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  first_name TEXT,
  username TEXT,
  message_count INTEGER DEFAULT 0,
  current_rank_id INTEGER,
  last_message_at INTEGER
);

${insertRanksSql}`;
}

export function generateWorkerCode(ranks: Rank[]): string {
  const sortedRanks = [...ranks].sort((a, b) => a.min_messages - b.min_messages || a.sort_order - b.sort_order);
  
  // Create a JSON string representation of ranks to embed in code for local reference if D1 query fails or for fast lookup
  const ranksJson = JSON.stringify(sortedRanks, null, 2);

  return `/**
 * ربات تلگرام رتبه‌بندی اعضای گروه بر اساس تعداد پیام
 * پلتفرم: Cloudflare Workers
 * دیتابیس: Cloudflare D1 (SQLite)
 * 
 * قبل از هر چیز، مطمئن شوید متغیرهای محیطی زیر را در پنل Cloudflare تنظیم کرده‌اید:
 * - BOT_TOKEN: توکن ربات تلگرام از BotFather
 * - OWNER_ID: آیدی تلگرام مالک گروه (مثلاً 12345678)
 * - CHAT_ID: آیدی چت گروه تلگرامی (مثلاً -100123456789)
 */

const RANKS = ${ranksJson};

const PERSISTENT_KEYBOARD = {
  keyboard: [
    [{ text: "🎖️ رتبه نظامی من" }, { text: "🏆 جدول برترین‌ها (چارت)" }],
    [{ text: "📜 هرم درجات نظامی" }, { text: "⚙️ راهنما و پشتیبانی" }]
  ],
  resize_keyboard: true
};

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Only POST requests allowed", { status: 405 });
    }

    try {
      const update = await request.json();
      
      // ۱. بررسی هندلر Callback Query (کلیک روی دکمه‌های اینلاین رتبه انتخابی)
      if (update.callback_query) {
        return await handleCallbackQuery(update.callback_query, env);
      }

      // ۲. بررسی پیام متنی یا رسانه‌ای معمولی
      if (update.message) {
        return await handleMessage(update.message, env);
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error("Error in Worker processing:", err);
      return new Response("Internal Server Error: " + err.message, { status: 500 });
    }
  }
};

/**
 * پاکسازی تگ برای ارسال به تلگرام (حذف ایموجی، محدودیت ۱۶ کاراکتر)
 */
function cleanTagForTelegram(text) {
  if (!text) return "";
  // حذف ایموجی‌ها و کاراکترهای خاص
  let clean = text.replace(/[\\u2700-\\u27BF]|[\\uE000-\\uF8FF]|\\uD83C[\\uDC00-\\uDFFF]|\\uD83D[\\uDC00-\\uDFFF]|[\\u2011-\\u26FF]|\\uD83E[\\uDD00-\\uDFFF]/g, "");
  // حذف فواصل اضافه و بریدن تا ۱۶ کاراکتر
  clean = clean.trim().substring(0, 16);
  return clean;
}

/**
 * متد کمکی برای ارسال یا ویرایش پیام در تلگرام
 */
async function sendOrEditMessage(botToken, chatId, text, replyToId = null, replyMarkup = null, isEdit = false, messageId = null) {
  let url;
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML"
  };

  if (isEdit && messageId) {
    url = \`https://api.telegram.org/bot\${botToken}/editMessageText\`;
    body.message_id = messageId;
  } else {
    url = \`https://api.telegram.org/bot\${botToken}/sendMessage\`;
    if (replyToId) {
      body.reply_to_message_id = replyToId;
    }
  }

  if (replyMarkup) {
    if (Array.isArray(replyMarkup)) {
      body.reply_markup = { inline_keyboard: replyMarkup };
    } else {
      body.reply_markup = replyMarkup;
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return await res.json();
}

/**
 * متد کمکی برای ارسال پیام به تلگرام
 */
async function sendMessage(botToken, chatId, text, replyToId = null, inlineButtons = null) {
  return await sendOrEditMessage(botToken, chatId, text, replyToId, inlineButtons, false);
}

/**
 * متد کمکی برای تنظیم برچسب (Tag) کنار نام عضو در گروه
 */
async function setChatMemberTag(botToken, chatId, userId, tag) {
  const cleanTag = cleanTagForTelegram(tag);
  const url = \`https://api.telegram.org/bot\${botToken}/setChatMemberTag\`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId,
      tag: cleanTag
    })
  });
  const data = await res.json();
  console.log(\`setChatMemberTag result for \${userId} with tag "\${cleanTag}":\`, data);
  return data;
}

/**
 * مدیریت دکمه‌های شیشه‌ای انتخاب رتبه هم‌سطح و ناوبری‌های سریع منو
 */
async function handleCallbackQuery(callbackQuery, env) {
  const botToken = env.BOT_TOKEN;
  const chatId = env.CHAT_ID;
  const callbackQueryId = callbackQuery.id;
  const clickerId = callbackQuery.from.id;
  const clickerName = callbackQuery.from.first_name;
  const messageId = callbackQuery.message ? callbackQuery.message.message_id : null;
  const data = callbackQuery.data; // مثلاً select_rank_5_1000

  // پاسخ اولیه برای بستن حالت لودینگ دکمه در تلگرام
  await fetch(\`https://api.telegram.org/bot\${botToken}/answerCallbackQuery\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId })
  });

  // ناوبری‌های سریع شیشه‌ای
  if (data === "show_chart_click") {
    return await handleChartCommand(botToken, chatId, clickerName, messageId, env, null, true);
  }

  if (data === "show_ranks_click") {
    return await handleRanksListCommand(botToken, chatId, messageId, null, true);
  }

  if (data === "show_my_rank_click") {
    return await handleRankCommand(botToken, chatId, clickerId, clickerName, messageId, env, null, true);
  }

  if (data === "show_help_click") {
    return await handleHelpCommand(botToken, chatId, messageId, true);
  }

  if (!data.startsWith("select_rank_")) {
    return new Response("OK", { status: 200 });
  }

  const parts = data.split("_"); // ["select", "rank", "rankId", "minMsgs"]
  const targetRankId = parseInt(parts[2]);
  const minMsgs = parseInt(parts[3]);

  // ۱. بررسی وضعیت کاربر از دیتابیس
  const dbUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(clickerId).first();
  
  if (!dbUser) {
    await sendMessage(botToken, chatId, \`🚫 <b>\${clickerName}</b>، اطلاعات شما یافت نشد.\`);
    return new Response("OK", { status: 200 });
  }

  // بررسی اینکه کاربر امتیاز لازم را دارد یا خیر
  if (dbUser.message_count < minMsgs) {
    await sendMessage(botToken, chatId, \`🚫 <b>\${clickerName}</b>، شما هنوز امتیاز کافی (\${minMsgs} پیام) را برای این رتبه کسب نکرده‌اید!\\n✉️ پیام‌های شما: \${dbUser.message_count}\`);
    return new Response("OK", { status: 200 });
  }

  // بررسی رتبه انتخاب‌شده در آرایه رتبه‌ها
  const chosenRank = RANKS.find(r => r.id === targetRankId);
  if (!chosenRank) {
    return new Response("OK", { status: 200 });
  }

  // بررسی اینکه آیا قبلاً این رتبه را نگرفته باشد
  if (dbUser.current_rank_id === targetRankId) {
    await sendMessage(botToken, chatId, \`ℹ️ <b>\${clickerName}</b>، شما قبلاً رتبه <b>\${chosenRank.emoji} \${chosenRank.title}</b> را انتخاب کرده‌اید.\`);
    return new Response("OK", { status: 200 });
  }

  // ۲. آپدیت دیتابیس با رتبه جدید
  await env.DB.prepare("UPDATE users SET current_rank_id = ? WHERE user_id = ?")
    .bind(targetRankId, clickerId)
    .run();

  // ۳. آپدیت تگ تلگرام کاربر
  await setChatMemberTag(botToken, chatId, clickerId, chosenRank.title);

  // ۴. ارسال پیام تبریک به گروه
  await sendMessage(
    botToken,
    chatId,
    \`✅ <b>رتبه انتخابی تایید شد!</b>\\n🎉 تبریک به <b>\${clickerName}</b>! رتبه شما با موفقیت به رتبه فاخر <b>\${chosenRank.emoji} \${chosenRank.title}</b> تغییر یافت!\\n✉️ تعداد پیام‌ها: \${dbUser.message_count}\`,
    callbackQuery.message ? callbackQuery.message.message_id : null
  );

  return new Response("OK", { status: 200 });
}

/**
 * پردازش پیام‌های دریافتی گروه و پیوی خصوصی
 */
async function handleMessage(message, env) {
  const botToken = env.BOT_TOKEN;
  const expectedChatId = parseInt(env.CHAT_ID);
  const ownerId = parseInt(env.OWNER_ID);
  const chatId = message.chat.id;
  const isPrivate = message.chat.type === "private";

  // ربات فقط پیام‌های گروه تعیین‌شده یا چت خصوصی (پیوی) را پردازش می‌کند
  if (!isPrivate && chatId !== expectedChatId) {
    return new Response("OK", { status: 200 });
  }

  const userId = message.from.id;
  const firstName = message.from.first_name || "کاربر ناشناس";
  const username = message.from.username || "";
  const text = message.text || "";

  // تبدیل دکمه‌های کیبورد یا کلمات کلیدی فارسی به دستورات معادل جهت کاربری آسان و گرافیکی
  let processedText = text.trim();
  if (processedText === "🎖️ رتبه نظامی من" || processedText === "رتبه من" || processedText === "رتبه") {
    processedText = "/rank";
  } else if (processedText === "🏆 جدول برترین‌ها (چارت)" || processedText === "چارت" || processedText === "جدول" || processedText === "برترین‌ها") {
    processedText = "/chart";
  } else if (processedText === "📜 هرم درجات نظامی" || processedText === "درجات" || processedText === "لیست درجات" || processedText === "رتبه‌ها") {
    processedText = "/ranks";
  } else if (processedText === "⚙️ راهنما و پشتیبانی" || processedText === "راهنما") {
    processedText = "/help";
  }

  // پاسخ مناسب به پیام‌های خصوصی (PV)
  if (isPrivate) {
    if (processedText.startsWith("/")) {
      const command = processedText.split(" ")[0].split("@")[0].toLowerCase();
      
      if (command === "/start" || command === "/help") {
        await handleHelpCommand(botToken, chatId, message.message_id, false);
        return new Response("OK", { status: 200 });
      }
      
      if (command === "/rank" || command === "/رتبه") {
        return await handleRankCommand(botToken, chatId, userId, firstName, message.message_id, env, PERSISTENT_KEYBOARD);
      }
      
      if (command === "/chart" || command === "/چارت") {
        return await handleChartCommand(botToken, chatId, firstName, message.message_id, env, PERSISTENT_KEYBOARD);
      }

      if (command === "/ranks" || command === "/لیست_رتبه_ها") {
        return await handleRanksListCommand(botToken, chatId, message.message_id, PERSISTENT_KEYBOARD);
      }
    } else {
      // ارسال راهنما به همراه کیبورد دکمه‌ای ثابت در صورت تایپ هر چیز متفرقه‌ای در پیوی
      await handleHelpCommand(botToken, chatId, message.message_id, false);
    }
    return new Response("OK", { status: 200 });
  }

  // ۱. بررسی ادمین/مالک بودن فرستنده جهت دستورات ریپلای مدیریتی
  const isMsgOwner = userId === ownerId;

  // پردازش دستورات ریپلای ادمین
  if (message.reply_to_message) {
    const targetUser = message.reply_to_message.from;
    const targetUserId = targetUser.id;
    const targetFirstName = targetUser.first_name;
    const targetUsername = targetUser.username || "";

    // فقط مالک یا خالق گروه حق اجرای دستورات مدیریتی را دارد
    if (isMsgOwner || await checkSenderIsCreator(botToken, chatId, userId)) {
      if (processedText === "ارتقاء مقام") {
        return await handleAdminPromote(botToken, chatId, targetUserId, targetFirstName, env);
      }
      
      if (processedText === "دادن صد امتیاز") {
        return await handleAdminAddPoints(botToken, chatId, targetUserId, targetFirstName, targetUsername, 100, env);
      }

      // دادن [عدد] امتیاز
      const giveMatch = processedText.match(/^دادن\\s+(\\d+)\\s+امتیاز$/);
      if (giveMatch) {
        const points = parseInt(giveMatch[1]);
        return await handleAdminAddPoints(botToken, chatId, targetUserId, targetFirstName, targetUsername, points, env);
      }

      // کاهش [عدد] امتیاز
      const takeMatch = processedText.match(/^کاهش\\s+(\\d+)\\s+امتیاز$/);
      if (takeMatch) {
        const points = parseInt(takeMatch[1]);
        return await handleAdminAddPoints(botToken, chatId, targetUserId, targetFirstName, targetUsername, -points, env);
      }
    } else {
      // پیام خطای عدم دسترسی برای کاربر غیر ادمین در پاسخ به تلاش برای مدیریت
      const adminKeywords = ["ارتقاء مقام", "دادن صد امتیاز", "امتیاز"];
      if (adminKeywords.some(kw => processedText.includes(kw))) {
        await sendMessage(
          botToken,
          chatId,
          \`🚫 <b>خطای دسترسی!</b>\\nفرستنده گرامی، شما مالک یا ادمین ارشد گروه نیستید و دسترسی لازم برای تغییر رتبه یا امتیاز کاربران را ندارید.\`,
          message.message_id
        );
        return new Response("OK", { status: 200 });
      }
    }
  }

  // ۲. هندل کردن فرمان‌های متنی ربات (دستوراتی که با / شروع می‌شوند)
  if (processedText.startsWith("/")) {
    const command = processedText.split(" ")[0].split("@")[0].toLowerCase();
    
    if (command === "/rank" || command === "/رتبه") {
      return await handleRankCommand(botToken, chatId, userId, firstName, message.message_id, env);
    }
    
    if (command === "/chart" || command === "/چارت") {
      return await handleChartCommand(botToken, chatId, firstName, message.message_id, env);
    }

    if (command === "/ranks" || command === "/لیست_رتبه_ها") {
      return await handleRanksListCommand(botToken, chatId, message.message_id);
    }

    if (command === "/help") {
      return await handleHelpCommand(botToken, chatId, message.message_id, false);
    }

    if (command === "/addrank" && (isMsgOwner || await checkSenderIsCreator(botToken, chatId, userId))) {
      return await handleAddRankCommand(botToken, chatId, processedText, message.message_id, env);
    }

    return new Response("OK", { status: 200 });
  }

  // ۳. جایگاه ویژه مالک گروه (شاهنشاه)
  // مالک نیازی به شمارش پیام یا سیستم ارتقای معمولی ندارد
  if (isMsgOwner) {
    // برای اطمینان، برچسب شاهنشاه او را تضمین می‌کنیم
    // یک بار در دیتابیس ثبت می‌کنیم اگر نباشد
    await env.DB.prepare(
      "INSERT OR IGNORE INTO users (user_id, first_name, username, message_count, current_rank_id, last_message_at) VALUES (?, ?, ?, 999999, 999, ?)"
    ).bind(ownerId, firstName, username, Math.floor(Date.now() / 1000)).run();
    
    return new Response("OK", { status: 200 });
  }

  // ۴. پردازش پیام‌های کاربران معمولی (شمارش و سیستم اسپم)
  const currentTime = Math.floor(Date.now() / 1000);

  // بررسی اسپم (حداقل فاصله ۲ ثانیه‌ای بین شمارش پیام‌ها)
  const dbUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();

  if (dbUser) {
    const timeDiff = currentTime - (dbUser.last_message_at || 0);
    
    if (timeDiff < 2) {
      // اسپم تشخیص داده شد؛ پیام نادیده گرفته می‌شود ولی پاسخ HTTP 200 ارسال می‌شود
      return new Response("OK", { status: 200 });
    }

    // افزایش تعداد پیام‌ها و آپدیت مشخصات
    const newCount = dbUser.message_count + 1;
    await env.DB.prepare(
      "UPDATE users SET first_name = ?, username = ?, message_count = ?, last_message_at = ? WHERE user_id = ?"
    ).bind(firstName, username, newCount, currentTime, userId).run();

    // بررسی ارتقای رتبه
    await checkAndTriggerLevelUp(botToken, chatId, userId, firstName, dbUser.current_rank_id, newCount, env);
  } else {
    // پیام اول کاربر در گروه
    const initialRank = RANKS[0]; // رتبه اول آرایه رتبه‌ها (مثلاً سرباز سوم با 0 پیام)
    const initialRankId = initialRank ? initialRank.id : null;

    await env.DB.prepare(
      "INSERT INTO users (user_id, first_name, username, message_count, current_rank_id, last_message_at) VALUES (?, ?, ?, 1, ?, ?)"
    ).bind(userId, firstName, username, initialRankId, currentTime).run();

    // ثبت تگ در گروه تلگرام
    if (initialRank) {
      await setChatMemberTag(botToken, chatId, userId, initialRank.title);
    }

    // ارسال پیام خوش‌آمدگویی به همراه دکمه شیشه‌ای چارت
    const welcomeText = \`👋 <b>درود بر شما، \${firstName} عزیز!</b>\\n\\n🎖️ نقش شما: <b>\${initialRank ? initialRank.title : "بدون رتبه"}</b>\\n✉️ تعداد پیام‌ها: <b>1</b>\\n📈 پیام لازم برای ارتقا: <b>\\u200e\${RANKS[1] ? RANKS[1].min_messages : "بینهایت"} پیام</b>\`;
    const buttons = [
      [{ text: "📊 مشاهده چارت مقامات", callback_data: "show_chart_click" }]
    ];
    await sendMessage(botToken, chatId, welcomeText, message.message_id, buttons);
  }

  return new Response("OK", { status: 200 });
}

/**
 * بررسی اینکه فرستنده پیام خالق/مالک گروه در تلگرام است یا خیر
 */
async function checkSenderIsCreator(botToken, chatId, userId) {
  try {
    const url = \`https://api.telegram.org/bot\${botToken}/getChatMember?chat_id=\${chatId}&user_id=\${userId}\`;
    const res = await fetch(url);
    const data = await res.json();
    return data.ok && (data.result.status === "creator" || data.result.status === "administrator");
  } catch {
    return false;
  }
}

/**
 * بررسی و اجرای منطق ارتقا به رتبه‌های بالاتر
 */
async function checkAndTriggerLevelUp(botToken, chatId, userId, firstName, currentRankId, newCount, env) {
  // یافتن رتبه‌هایی که آستانه پیام آن‌ها برابر یا کوچکتراز امتیاز فعلی کاربر است
  const eligibleRanks = RANKS.filter(r => newCount >= r.min_messages);
  if (eligibleRanks.length === 0) return;

  // یافتن بالاترین رتبه واجد شرایط معمولی
  // ردیف رتبه‌ها بر اساس min_messages مرتب شده‌اند
  const maxEligibleMinMsgs = Math.max(...eligibleRanks.map(r => r.min_messages));
  const topEligibleRanks = eligibleRanks.filter(r => r.min_messages === maxEligibleMinMsgs);

  // اگر چند رتبه هم‌سطح وجود داشته باشد (انتخابی)
  if (topEligibleRanks.length > 1 && topEligibleRanks[0].group_choice_key) {
    // بررسی می‌کنیم که آیا کاربر در حال حاضر یکی از این رتبه‌ها را دارد یا خیر
    const alreadyHasChoiceRank = topEligibleRanks.some(r => r.id === currentRankId);
    if (alreadyHasChoiceRank) {
      // کاربر قبلاً یکی از این انتخاب‌ها را انجام داده، نیازی به اعلام مجدد نیست
      return;
    }

    // ارسال پیغام با دکمه‌های اینلاین برای انتخاب بین گزینه‌های هم‌سطح
    const buttons = [
      topEligibleRanks.map(r => ({
        text: \`\${r.emoji} \&apos;\${r.title}\&apos;\`,
        callback_data: \`select_rank_\${r.id}_\${r.min_messages}\`
      }))
    ];

    const text = \`🌟 <b>\${firstName}</b>، شما به آستانه شکوهمند <b>\${maxEligibleMinMsgs}</b> پیام رسیدید! اکنون می‌توانید یکی از رتبه‌های هم‌سطح زیر را انتخاب کنید:\`;
    await sendMessage(botToken, chatId, text, null, buttons);
  } else {
    // حالت ارتقای خودکار معمولی به یک تک رتبه
    const targetRank = topEligibleRanks[0];
    if (targetRank && targetRank.id !== currentRankId) {
      // فقط در صورتی ارتقا می‌دهیم که رتبه جدید بالاتر از رتبه فعلی باشد
      const currentRank = RANKS.find(r => r.id === currentRankId);
      if (!currentRank || targetRank.min_messages > currentRank.min_messages) {
        
        // آپدیت دیتابیس
        await env.DB.prepare("UPDATE users SET current_rank_id = ? WHERE user_id = ?")
          .bind(targetRank.id, userId)
          .run();

        // آپدیت تگ گروه تلگرام
        await setChatMemberTag(botToken, chatId, userId, targetRank.title);

        // ارسال پیام تبریک به گروه
        const congratsText = \`🎉 <b>تبریک فراوان به \${firstName}!</b>\\nشما با تلاش مستمر و ارسال ✉️ <b>\${newCount}</b> پیام، به رتبه فاخر <b>\${targetRank.emoji} \${targetRank.title}</b> ارتقا پیدا کردید!\`;
        await sendMessage(botToken, chatId, congratsText);
      }
    }
  }
}

/**
 * نمایش رتبه شخصی (/rank)
 */
async function handleRankCommand(botToken, chatId, userId, firstName, messageId, env, replyMarkupOverride = null, isEdit = false) {
  const dbUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();

  if (userId === parseInt(env.OWNER_ID)) {
    const ownerText = \`👑 <b>| مقام سلطنتی شاهنشاه اعظم</b>\\n\` +
                      \`━━━━━━━━━━━━━━━━━━\\n\` +
                      \`👤 <b>نام فرمانروا:</b> <code>\${firstName}</code>\\n\` +
                      \`🎖️ <b>درجه دائمی:</b> <code>شاهنشاه</code>\\n\\n\` +
                      \`🔱 شما جایگاه جاودان و ابدی بالای هرم نظامی را دارا هستید و نیازی به ارزیابی درجه ندارید.\`;
    
    const buttons = [
      [
        { text: "📊 جدول برترین‌ها (چارت)", callback_data: "show_chart_click" },
        { text: "📜 لیست درجات نظامی", callback_data: "show_ranks_click" }
      ]
    ];
    
    await sendOrEditMessage(botToken, chatId, ownerText, messageId, replyMarkupOverride || buttons, isEdit, messageId);
    return new Response("OK", { status: 200 });
  }

  if (!dbUser) {
    const text = \`🚫 <b>درود رزمنده!</b>\\n\\n<b>\${firstName}</b>، شما هنوز در سیستم رتبه‌بندی گروه ثبت نشده‌اید.\\n\\n✉️ پس از ارسال اولین پیام عادی خود در گروه، پرونده نظامی شما فعال و محاسبات درجه آغاز خواهد شد!\`;
    const buttons = [
      [
        { text: "📊 جدول برترین‌ها (چارت)", callback_data: "show_chart_click" },
        { text: "📜 لیست درجات نظامی", callback_data: "show_ranks_click" }
      ]
    ];
    await sendOrEditMessage(botToken, chatId, text, messageId, replyMarkupOverride || buttons, isEdit, messageId);
    return new Response("OK", { status: 200 });
  }

  const currentRank = RANKS.find(r => r.id === dbUser.current_rank_id) || RANKS[0];
  const nextRanks = RANKS.filter(r => r.min_messages > dbUser.message_count);
  
  let nextRankText = "";
  if (nextRanks.length > 0) {
    const nextRank = nextRanks[0];
    const remaining = nextRank.min_messages - dbUser.message_count;
    const totalForNext = nextRank.min_messages - (currentRank ? currentRank.min_messages : 0);
    const completedForNext = dbUser.message_count - (currentRank ? currentRank.min_messages : 0);
    const percentage = Math.min(100, Math.max(0, Math.round((completedForNext / (totalForNext || 1)) * 100)));
    
    const filledBlocks = Math.round(percentage / 10);
    const progressBar = "■".repeat(filledBlocks) + "□".repeat(10 - filledBlocks);

    nextRankText = \`📈 <b>در آستانه ارتقا به درجه بعدی:</b>\\n\` +
                   \`↳ \${nextRank.emoji} <b>\${nextRank.title}</b>\\n\` +
                   \`📊 <b>میزان پیشرفت:</b> <code>[\${progressBar}] \${percentage}%</code>\\n\` +
                   \`✉️ <b>پیام‌های باقیمانده:</b> <code>\${remaining}</code> پیام دیگر\`;
  } else {
    nextRankText = \`🔥 <b>تبریک شایسته! شما در راس هرم نظامی و قله افتخار گروه قرار دارید!</b>\`;
  }

  const rankText = \`🪖 <b>| پرونده نظامی و اطلاعات رزمنده</b>\\n\` +
                   \`━━━━━━━━━━━━━━━━━━\\n\` +
                   \`👤 <b>نام کاربر:</b> <code>\${firstName}</code>\\n\` +
                   \`🏅 <b>درجه فعلی:</b> <b>\${currentRank ? currentRank.emoji : "🎖️"} \${currentRank ? currentRank.title : "سرباز نوپا"}</b>\\n\` +
                   \`✉️ <b>تعداد پیام‌های ثبت‌شده:</b> <code>\${dbUser.message_count}</code> پیام\\n\` +
                   \`━━━━━━━━━━━━━━━━━━\\n\` +
                   \`\${nextRankText}\`;
  
  const buttons = [
    [
      { text: "📊 جدول برترین‌ها (چارت)", callback_data: "show_chart_click" },
      { text: "📜 لیست درجات نظامی", callback_data: "show_ranks_click" }
    ],
    [
      { text: "⚙️ راهنمای جامع", callback_data: "show_help_click" }
    ]
  ];
  
  await sendOrEditMessage(botToken, chatId, rankText, messageId, replyMarkupOverride || buttons, isEdit, messageId);
  return new Response("OK", { status: 200 });
}

/**
 * نمایش چارت رتبه‌بندی (/chart)
 */
async function handleChartCommand(botToken, chatId, firstName, messageId, env, replyMarkupOverride = null, isEdit = false) {
  // گرفتن ۱۵ نفر اول بر اساس تعداد پیام
  const topUsers = await env.DB.prepare(
    "SELECT * FROM users WHERE user_id != ? ORDER BY message_count DESC LIMIT 15"
  ).bind(parseInt(env.OWNER_ID)).all();

  // گرفتن مشخصات شاهنشاه (مالک)
  let ownerName = "مالک گروه";
  try {
    const ownerInfoRes = await fetch(\`https://api.telegram.org/bot\${botToken}/getChatMember?chat_id=\${chatId}&user_id=\${env.OWNER_ID}\`);
    const ownerInfo = await ownerInfoRes.json();
    if (ownerInfo.ok) {
      ownerName = ownerInfo.result.user.first_name;
    }
  } catch {}

  let chartText = \`🏆 <b>| چارت مقامات و تالار افتخارات گروه</b>\\n\` +
                  \`━━━━━━━━━━━━━━━━━━\\n\` +
                  \`👑 <b>شاهنشاه (مالک ارشد):</b> <code>\${ownerName}</code>\\n\` +
                  \`━━━━━━━━━━━━━━━━━━\\n\`;

  if (topUsers.results && topUsers.results.length > 0) {
    topUsers.results.forEach((user, idx) => {
      const userRank = RANKS.find(r => r.id === user.current_rank_id) || RANKS[0];
      const rankEmoji = userRank ? userRank.emoji : "🥉";
      const rankTitle = userRank ? userRank.title : "سرباز سوم";
      const name = user.first_name || "کاربر ناشناس";
      
      let medal = "🔹";
      if (idx === 0) medal = "🥇";
      else if (idx === 1) medal = "🥈";
      else if (idx === 2) medal = "🥉";

      chartText += \`\${medal} <b>رتبه \${idx + 1}:</b> <code>\${name}</code>\\n\` +
                   \`↳ درجه: \${rankEmoji} <b>\${rankTitle}</b> | پیام‌ها: <code>\${user.message_count}</code>\\n\\n\`;
    });
  } else {
    chartText += \`\\n<i>هنوز هیچ سربازی در میدان نبرد چت پیام ارسال نکرده است!</i>\\n\`;
  }
  chartText += \`━━━━━━━━━━━━━━━━━━\\n\` +
               \`✨ برای ارتقای جایگاه خود در تالار افتخارات، به چت در گروه ادامه دهید!\`;

  const buttons = [
    [
      { text: "🎖️ رتبه نظامی من", callback_data: "show_my_rank_click" },
      { text: "📜 لیست درجات نظامی", callback_data: "show_ranks_click" }
    ],
    [
      { text: "⚙️ راهنمای جامع", callback_data: "show_help_click" }
    ]
  ];

  await sendOrEditMessage(botToken, chatId, chartText, messageId, replyMarkupOverride || buttons, isEdit, messageId);
  return new Response("OK", { status: 200 });
}

/**
 * لیست تمامی درجات نظامی (/ranks)
 */
async function handleRanksListCommand(botToken, chatId, messageId, replyMarkupOverride = null, isEdit = false) {
  let text = \`🎖️ <b>| سلسله‌مراتب و هرم درجات نظامی گروه</b>\\n\` +
             \`━━━━━━━━━━━━━━━━━━\\n\` +
             \`👑 <b>شاهنشاه اعظم</b>\\n\` +
             \`↳ <i>ویژه مالک ارشد گروه (بدون نیاز به امتیاز)</i>\\n\\n\`;

  RANKS.forEach((r, idx) => {
    const isChoice = r.group_choice_key ? " 🌟 [انتخابی]" : "";
    text += \`\${r.emoji} <b>درجه \${idx + 1}: \${r.title}</b>\\n\` +
            \`↳ حدنصاب پیام لازم: <code>\${r.min_messages}</code> پیام\${isChoice}\\n\\n\`;
  });
  text += \`━━━━━━━━━━━━━━━━━━\\n\` +
          \`📢 ارتقای درجه شما کاملاً خودکار بوده و پس از رسیدن به حدنصاب، تگ درجه شما در گروه نصب خواهد شد!\`;

  const buttons = [
    [
      { text: "🎖️ رتبه نظامی من", callback_data: "show_my_rank_click" },
      { text: "📊 جدول برترین‌ها (چارت)", callback_data: "show_chart_click" }
    ],
    [
      { text: "⚙️ راهنمای جامع", callback_data: "show_help_click" }
    ]
  ];

  await sendOrEditMessage(botToken, chatId, text, messageId, replyMarkupOverride || buttons, isEdit, messageId);
  return new Response("OK", { status: 200 });
}

/**
 * نمایش راهنما و اطلاعات جامع ربات (/help)
 */
async function handleHelpCommand(botToken, chatId, messageId, isEdit = false) {
  const helpText = \`⚙️ <b>| راهنمای جامع سیستم نظامی رتبه‌بندی</b>\\n\` +
                   \`━━━━━━━━━━━━━━━━━━\\n\` +
                   \`🤖 این ربات به صورت لحظه‌ای و هوشمند چت‌های فعال گروه را ردیابی کرده و بر اساس میزان فعالیت، درجات نظامی خاص اعطا می‌کند.\\n\\n\` +
                   \`👑 <b>چگونه ارتقا درجه بگیریم؟</b>\\n\` +
                   \`کافیست در گروه چت کنید! سیستم هر پیام شما را شمرده و به محض رسیدن به حدنصاب، رتبه جدید به همراه برچسب (Tag) اختصاصی برای شما ثبت می‌شود.\\n\\n\` +
                   \`⚠️ <b>قوانین ضد اسپم:</b>\\n\` +
                   \`بین پیام‌های ارسالی باید حداقل <b>۲ ثانیه</b> فاصله باشد، در غیر این صورت پیام دوم شمارش نخواهد شد.\\n\\n\` +
                   \`📲 <b>دکمه‌های تعاملی سریع:</b>\\n\` +
                   \`با استفاده از دکمه‌های تعاملی زیر پیام‌ها یا کیبورد ثابت پایین صفحه، می‌توانید بدون نیاز به نوشتن دستورات با ربات کار کنید.\`;

  const buttons = [
    [
      { text: "🎖️ رتبه نظامی من", callback_data: "show_my_rank_click" },
      { text: "📊 جدول برتر (چارت)", callback_data: "show_chart_click" }
    ],
    [
      { text: "📜 هرم درجات نظامی", callback_data: "show_ranks_click" }
    ]
  ];

  await sendOrEditMessage(botToken, chatId, helpText, messageId, buttons, isEdit, messageId);
  return new Response("OK", { status: 200 });
}

/**
 * دستور افزودن رتبه جدید (/addrank) توسط ادمین
 */
async function handleAddRankCommand(botToken, chatId, text, messageId, env) {
  // فرمت: /addrank عنوان_رتبه | اموجی | تعداد_پیام_لازم [| group:choice_key]
  const rawArgs = text.substring(9).trim();
  const parts = rawArgs.split("|").map(p => p.trim());

  if (parts.length < 3) {
    await sendMessage(
      botToken,
      chatId,
      \`⚠️ <b>فرمت نامعتبر!</b>\\nمثال صحیح:\\n<code>/addrank سرلشکر | 🎖️ | 3000</code>\\n\\nو برای رتبه‌های هم‌سطح انتخابی:\\n<code>/addrank سرلشکر | 🎖️ | 3000 | group:high1</code>\`,
      messageId
    );
    return new Response("OK", { status: 200 });
  }

  const title = parts[0];
  const emoji = parts[1];
  const minMessages = parseInt(parts[2]);
  let choiceKey = null;

  if (parts[3] && parts[3].startsWith("group:")) {
    choiceKey = parts[3].substring(6).trim();
  }

  if (isNaN(minMessages)) {
    await sendMessage(botToken, chatId, \`⚠️ تعداد پیام وارد شده معتبر نیست.\`, messageId);
    return new Response("OK", { status: 200 });
  }

  try {
    // اضافه کردن به دیتابیس D1
    const result = await env.DB.prepare(
      "INSERT INTO ranks (title, emoji, min_messages, sort_order, group_choice_key) VALUES (?, ?, ?, ?, ?)"
    ).bind(title, emoji, minMessages, minMessages, choiceKey).run();

    await sendMessage(
      botToken,
      chatId,
      \`✅ <b>رتبه جدید با موفقیت اضافه شد!</b>\\n🎖️ عنوان: <b>\${title}</b>\\n🎭 ایموجی: <b>\${emoji}</b>\\n✉️ حداقل پیام: <b>\${minMessages}</b>\\nکلید هم‌سطحی: <b>\${choiceKey || "ندارد"}</b>\\n\\n<i>توجه: برای تاثیر در کدهای اصلی، بهتر است رتبه‌ها را در فایل index.js لوکال خود نیز آپدیت کنید.</i>\`,
      messageId
    );
  } catch (err) {
    await sendMessage(botToken, chatId, \`❌ خطا در درج دیتابیس D1: \` + err.message, messageId);
  }

  return new Response("OK", { status: 200 });
}

/**
 * ارتقای مقام مستقیم یک کاربر توسط ریپلای ادمین
 */
async function handleAdminPromote(botToken, chatId, targetUserId, targetFirstName, env) {
  const dbUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(targetUserId).first();
  if (!dbUser) {
    await sendMessage(botToken, chatId, \`🚫 کاربر در دیتابیس یافت نشد.\`);
    return new Response("OK", { status: 200 });
  }

  // یافتن رتبه فعلی و رتبه بعدی
  const currentRankIndex = RANKS.findIndex(r => r.id === dbUser.current_rank_id);
  const nextRank = RANKS[currentRankIndex + 1];

  if (!nextRank) {
    await sendMessage(botToken, chatId, \`👑 <b>\${targetFirstName}</b> در حال حاضر در بالاترین رتبه نظامی ممکن قرار دارد!\`);
    return new Response("OK", { status: 200 });
  }

  // آپدیت دیتابیس به رتبه بعدی و افزایش تعداد پیام به آستانه آن رتبه در صورت لزوم
  const targetMessages = Math.max(dbUser.message_count, nextRank.min_messages);

  await env.DB.prepare("UPDATE users SET current_rank_id = ?, message_count = ? WHERE user_id = ?")
    .bind(nextRank.id, targetMessages, targetUserId)
    .run();

  // آپدیت تگ
  await setChatMemberTag(botToken, chatId, targetUserId, nextRank.title);

  await sendMessage(
    botToken,
    chatId,
    \`🎖️ <b>ارتقای درجه ادمین!</b>\\n\\n🎉 با دستور مستقیم مالک، کاربر <b>\${targetFirstName}</b> به رتبه فاخر <b>\${nextRank.emoji} \${nextRank.title}</b> منصوب شد!\\n✉️ کل پیام‌ها به آستانه <b>\${targetMessages}</b> ارتقا یافت.\`
  );

  return new Response("OK", { status: 200 });
}

/**
 * دادن یا گرفتن امتیاز از کاربر توسط ریپلای ادمین
 */
async function handleAdminAddPoints(botToken, chatId, targetUserId, targetFirstName, targetUsername, points, env) {
  let dbUser = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(targetUserId).first();
  const currentTime = Math.floor(Date.now() / 1000);

  if (!dbUser) {
    // ساخت کاربر جدید با امتیاز داده شده
    await env.DB.prepare(
      "INSERT INTO users (user_id, first_name, username, message_count, current_rank_id, last_message_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(targetUserId, targetFirstName, targetUsername, Math.max(0, points), RANKS[0].id, currentTime).run();
    dbUser = { message_count: 0, current_rank_id: RANKS[0].id };
  }

  const newCount = Math.max(0, dbUser.message_count + points);

  await env.DB.prepare("UPDATE users SET message_count = ? WHERE user_id = ?")
    .bind(newCount, targetUserId)
    .run();

  const isAddition = points >= 0;
  const emoji = isAddition ? "📈" : "📉";
  const actionText = isAddition ? \`افزایش دادن \${points} امتیاز\` : \`کاهش دادن \${Math.abs(points)} امتیاز\`;

  await sendMessage(
    botToken,
    chatId,
    \`\${emoji} <b>تغییر موازنه قوا توسط ادمین ارشد!</b>\\n\\n✉️ تعداد پیام‌های <b>\${targetFirstName}</b> به مقدار <b>\${Math.abs(points)}</b> واحد \${isAddition ? "افزایش" : "کاهش"} یافت!\\n📊 کل امتیاز فعلی: <b>\${newCount}</b> پیام\`
  );

  // بررسی ارتقای رتبه بعد از تغییر امتیاز
  await checkAndTriggerLevelUp(botToken, chatId, targetUserId, targetFirstName, dbUser.current_rank_id, newCount, env);

  return new Response("OK", { status: 200 });
}
`;
}
