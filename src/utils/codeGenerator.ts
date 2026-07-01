import { Rank } from '../types';

export function generateSqlSchema(ranks: Rank[]): string {
  // Sort ranks by min_messages and sort_order
  const sortedRanks = [...ranks].sort((a, b) => a.min_messages - b.min_messages || a.sort_order - b.sort_order);

  let insertRanksSql = '';
  sortedRanks.forEach((r, idx) => {
    const choiceKey = r.group_choice_key ? `'${r.group_choice_key}'` : 'NULL';
    insertRanksSql += `INSERT OR IGNORE INTO ranks (chat_id, id, title, emoji, min_messages, sort_order, group_choice_key) VALUES (12345678, ${r.id}, '${r.title}', '${r.emoji}', ${r.min_messages}, ${r.sort_order || (idx + 1) * 10}, ${choiceKey});\n`;
  });

  return `CREATE TABLE IF NOT EXISTS settings (
  chat_id INTEGER PRIMARY KEY,
  owner_id INTEGER,
  chat_title TEXT,
  congrats_mode TEXT DEFAULT 'direct',
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ranks (
  chat_id INTEGER,
  id INTEGER,
  title TEXT,
  emoji TEXT,
  min_messages INTEGER,
  sort_order INTEGER,
  group_choice_key TEXT,
  PRIMARY KEY (chat_id, id)
);

CREATE TABLE IF NOT EXISTS users (
  chat_id INTEGER,
  user_id INTEGER,
  first_name TEXT,
  username TEXT,
  message_count INTEGER DEFAULT 0,
  weekly_message_count INTEGER DEFAULT 0,
  weekly_reset_at INTEGER DEFAULT 0,
  current_rank_id INTEGER,
  last_message_at INTEGER,
  is_active INTEGER DEFAULT 1,
  PRIMARY KEY (chat_id, user_id)
);

-- Seeding initial ranks for group (example chat_id: 12345678)
${insertRanksSql}`;
}

export function generateWorkerCode(ranks: Rank[]): string {
  const sortedRanks = [...ranks].sort((a, b) => a.min_messages - b.min_messages || a.sort_order - b.sort_order);
  const ranksJson = JSON.stringify(sortedRanks, null, 2);

  return `/**
 * ربات تلگرام رتبه‌بندی اعضای گروه بر اساس فعالیت (پلتفرم: Cloudflare Workers & D1)
 * نسخه ۲.۵.۰ - کاملاً چندگروهه (Multi-Tenant)، پویا و خودکارساز
 */

const DEFAULT_RANKS = ${ranksJson};

const PERSISTENT_KEYBOARD = {
  keyboard: [
    [{ text: "🎖️ رتبه نظامی من" }, { text: "🏆 جدول برترین‌ها (چارت)" }],
    [{ text: "📜 هرم درجات نظامی" }, { text: "⚙️ راهنما و پشتیبانی" }]
  ],
  resize_keyboard: true
};

const lastMessages = new Map(); // ضداسپم پیام‌های مکرر

let schemaMigrated = false;

async function runMigrations(env) {
  if (schemaMigrated) return;
  try {
    // 1. Create tables if they do not exist
    await env.DB.prepare(\`
      CREATE TABLE IF NOT EXISTS settings (
        chat_id INTEGER PRIMARY KEY,
        owner_id INTEGER,
        chat_title TEXT,
        congrats_mode TEXT DEFAULT 'direct',
        is_active INTEGER DEFAULT 1
      )
    \`).run();

    await env.DB.prepare(\`
      CREATE TABLE IF NOT EXISTS ranks (
        chat_id INTEGER,
        id INTEGER,
        title TEXT,
        emoji TEXT,
        min_messages INTEGER,
        sort_order INTEGER,
        group_choice_key TEXT,
        PRIMARY KEY (chat_id, id)
      )
    \`).run();

    await env.DB.prepare(\`
      CREATE TABLE IF NOT EXISTS users (
        chat_id INTEGER,
        user_id INTEGER,
        first_name TEXT,
        username TEXT,
        message_count INTEGER DEFAULT 0,
        weekly_message_count INTEGER DEFAULT 0,
        weekly_reset_at INTEGER DEFAULT 0,
        current_rank_id INTEGER,
        last_message_at INTEGER,
        is_active INTEGER DEFAULT 1,
        PRIMARY KEY (chat_id, user_id)
      )
    \`).run();

    // 2. Perform incremental ALTER TABLE for older databases
    // Check settings table columns
    const settingsInfo = await env.DB.prepare("PRAGMA table_info(settings)").all();
    if (settingsInfo.results) {
      const columns = settingsInfo.results.map(r => r.name);
      if (!columns.includes("chat_title")) {
        try { await env.DB.prepare("ALTER TABLE settings ADD COLUMN chat_title TEXT").run(); } catch (e) {}
      }
      if (!columns.includes("congrats_mode")) {
        try { await env.DB.prepare("ALTER TABLE settings ADD COLUMN congrats_mode TEXT DEFAULT 'direct'").run(); } catch (e) {}
      }
      if (!columns.includes("is_active")) {
        try { await env.DB.prepare("ALTER TABLE settings ADD COLUMN is_active INTEGER DEFAULT 1").run(); } catch (e) {}
      }
    }

    // Check ranks table columns
    const ranksInfo = await env.DB.prepare("PRAGMA table_info(ranks)").all();
    if (ranksInfo.results) {
      const columns = ranksInfo.results.map(r => r.name);
      if (!columns.includes("chat_id")) {
        try { await env.DB.prepare("ALTER TABLE ranks ADD COLUMN chat_id INTEGER DEFAULT 0").run(); } catch (e) {}
      }
      if (!columns.includes("group_choice_key")) {
        try { await env.DB.prepare("ALTER TABLE ranks ADD COLUMN group_choice_key TEXT").run(); } catch (e) {}
      }
    }

    // Check users table columns
    const usersInfo = await env.DB.prepare("PRAGMA table_info(users)").all();
    if (usersInfo.results) {
      const columns = usersInfo.results.map(r => r.name);
      if (!columns.includes("chat_id")) {
        try { await env.DB.prepare("ALTER TABLE users ADD COLUMN chat_id INTEGER DEFAULT 0").run(); } catch (e) {}
      }
      if (!columns.includes("weekly_message_count")) {
        try { await env.DB.prepare("ALTER TABLE users ADD COLUMN weekly_message_count INTEGER DEFAULT 0").run(); } catch (e) {}
      }
      if (!columns.includes("weekly_reset_at")) {
        try { await env.DB.prepare("ALTER TABLE users ADD COLUMN weekly_reset_at INTEGER DEFAULT 0").run(); } catch (e) {}
      }
      if (!columns.includes("is_active")) {
        try { await env.DB.prepare("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1").run(); } catch (e) {}
      }
    }

    // 3. Post-alter migration of old data to support multi-tenant if needed
    try {
      const firstSetting = await env.DB.prepare("SELECT chat_id FROM settings LIMIT 1").first();
      if (firstSetting && firstSetting.chat_id) {
        await env.DB.prepare("UPDATE users SET chat_id = ? WHERE chat_id = 0 OR chat_id IS NULL").bind(firstSetting.chat_id).run();
        await env.DB.prepare("UPDATE ranks SET chat_id = ? WHERE chat_id = 0 OR chat_id IS NULL").bind(firstSetting.chat_id).run();
      }
    } catch (e) {
      console.error("Data migration error:", e);
    }

    schemaMigrated = true;
  } catch (err) {
    console.error("Migration error:", err);
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("POST only", { status: 405 });
    try {
      await runMigrations(env);
      const update = await request.json();
      if (update.callback_query) return await handleCallbackQuery(update.callback_query, env);
      if (update.message) return await handleMessage(update.message, env);
      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error("Worker error:", err);
      return new Response("Error: " + err.message, { status: 500 });
    }
  }
};

function toPersianDigits(num) {
  if (num === null || num === undefined) return "";
  return num.toString().replace(/\\d/g, d => ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"][parseInt(d)]);
}

function cleanTagForTelegram(text) {
  if (!text) return "";
  return text.replace(/[\\u2700-\\u27BF]|[\\uE000-\\uF8FF]|\\uD83C[\\uDC00-\\uDFFF]|\\uD83D[\\uDC00-\\uDFFF]|[\\u2011-\\u26FF]|\\uD83E[\\uDD00-\\uDFFF]/g, "").trim().substring(0, 16);
}

async function apiCall(botToken, method, payload) {
  const res = await fetch(\`https://api.telegram.org/bot\${botToken}/\${method}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!data.ok) console.error(\`API Call failed (\${method}):\`, data);
  return data;
}

async function sendMessage(botToken, chatId, text, replyToId = null, inlineButtons = null) {
  const payload = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyToId) payload.reply_to_message_id = replyToId;
  if (inlineButtons) payload.reply_markup = Array.isArray(inlineButtons) ? { inline_keyboard: inlineButtons } : inlineButtons;
  return await apiCall(botToken, "sendMessage", payload);
}

async function sendOrEditMessage(botToken, chatId, text, messageId, replyMarkup = null, isEdit = false) {
  if (isEdit && messageId) {
    const payload = { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" };
    if (replyMarkup) payload.reply_markup = Array.isArray(replyMarkup) ? { inline_keyboard: replyMarkup } : replyMarkup;
    return await apiCall(botToken, "editMessageText", payload);
  }
  return await sendMessage(botToken, chatId, text, null, replyMarkup);
}

async function setChatMemberTag(botToken, chatId, userId, tag, ownerId = null) {
  const cleanTag = cleanTagForTelegram(tag);
  const data = await apiCall(botToken, "setChatMemberTag", { chat_id: chatId, user_id: userId, tag: cleanTag });
  if (!data.ok && ownerId && (data.description || "").toLowerCase().includes("not enough rights")) {
    const alert = \`⚠️ <b>| هشدار عدم دسترسی ربات نظامی</b>\\n\\nتنظیم تگ درجه <b>«\${cleanTag}»</b> برای کاربر به دلیل کمبود دسترسی ادمین ربات (به ویژه can_manage_tags) در گروه شکست خورد. لطفاً دسترسی‌های ربات را بررسی کنید.\`;
    await sendMessage(botToken, ownerId, alert);
  }
  return data;
}

async function getOrSeedRanks(env, chatId) {
  const dbRanks = await env.DB.prepare("SELECT * FROM ranks WHERE chat_id = ? ORDER BY sort_order ASC").bind(chatId).all();
  if (dbRanks.results && dbRanks.results.length > 0) return dbRanks.results;
  for (const r of DEFAULT_RANKS) {
    await env.DB.prepare("INSERT OR IGNORE INTO ranks (chat_id, id, title, emoji, min_messages, sort_order, group_choice_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(chatId, r.id, r.title, r.emoji, r.min_messages, r.sort_order, r.group_choice_key || null).run();
  }
  return DEFAULT_RANKS;
}

async function getOrInitializeSettings(botToken, env, chatId, msgFromId, chatTitle = "جبهه نبرد") {
  let settings = await env.DB.prepare("SELECT * FROM settings WHERE chat_id = ?").bind(chatId).first();
  if (settings) {
    if (chatTitle && settings.chat_title !== chatTitle) {
      await env.DB.prepare("UPDATE settings SET chat_title = ? WHERE chat_id = ?").bind(chatTitle, chatId).run();
      settings.chat_title = chatTitle;
    }
    return settings;
  }
  let ownerId = msgFromId;
  try {
    const res = await apiCall(botToken, "getChatAdministrators", { chat_id: chatId });
    if (res.ok && Array.isArray(res.result)) {
      const creator = res.result.find(m => m.status === "creator");
      if (creator) ownerId = creator.user.id;
    }
  } catch {}
  await env.DB.prepare("INSERT OR IGNORE INTO settings (chat_id, owner_id, chat_title, congrats_mode, is_active) VALUES (?, ?, ?, 'direct', 1)")
    .bind(chatId, ownerId, chatTitle).run();
  await getOrSeedRanks(env, chatId);
  return { chat_id: chatId, owner_id: ownerId, chat_title: chatTitle, congrats_mode: 'direct', is_active: 1 };
}

async function checkSenderIsAdmin(botToken, chatId, userId) {
  try {
    const res = await fetch(\`https://api.telegram.org/bot\${botToken}/getChatMember?chat_id=\${chatId}&user_id=\${userId}\`);
    const data = await res.json();
    return data.ok && (data.result.status === "creator" || data.result.status === "administrator");
  } catch {
    return false;
  }
}

async function recalculateAndSyncRank(botToken, chatId, userId, firstName, env, currentRanks, settings) {
  const dbUser = await env.DB.prepare("SELECT * FROM users WHERE chat_id = ? AND user_id = ?").bind(chatId, userId).first();
  if (!dbUser) return;
  const msgCount = dbUser.message_count;
  const eligibleRanks = currentRanks.filter(r => msgCount >= r.min_messages);
  if (eligibleRanks.length === 0) return;

  const maxMin = Math.max(...eligibleRanks.map(r => r.min_messages));
  const topEligible = eligibleRanks.filter(r => r.min_messages === maxMin);
  const ownerId = settings ? settings.owner_id : null;

  if (topEligible.length > 1 && topEligible[0].group_choice_key) {
    const alreadyHasChoice = topEligible.some(r => r.id === dbUser.current_rank_id);
    if (alreadyHasChoice) {
      const cur = topEligible.find(r => r.id === dbUser.current_rank_id);
      await setChatMemberTag(botToken, chatId, userId, cur.title, ownerId);
      return;
    }
    const buttons = [topEligible.map(r => ({ text: \`\${r.emoji} \${r.title}\`, callback_data: \`select_rank_\${r.id}_\${r.min_messages}\` }))];
    const text = \`🌟 <b>\${firstName}</b>، شما به آستانه شکوهمند <b>\${toPersianDigits(maxMin)}</b> پیام رسیدید! اکنون می‌توانید یکی از رتبه‌های هم‌سطح زیر را انتخاب کنید:\`;
    await apiCall(botToken, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
  } else {
    const targetRank = topEligible[0];
    if (targetRank && targetRank.id !== dbUser.current_rank_id) {
      await env.DB.prepare("UPDATE users SET current_rank_id = ? WHERE chat_id = ? AND user_id = ?").bind(targetRank.id, chatId, userId).run();
      await setChatMemberTag(botToken, chatId, userId, targetRank.title, ownerId);
      const congratsMode = settings ? settings.congrats_mode : 'direct';
      const congratsText = \`🎉 <b>تبریک شایسته به رزمنده \${firstName}!</b>\\nشما با تلاش مستمر و ارسال ✉️ <b>\${toPersianDigits(msgCount)}</b> پیام، به درجه نظامی فاخر <b>\${targetRank.emoji} \${targetRank.title}</b> منصوب شدید!\`;
      if (congratsMode === 'instant') {
        await sendMessage(botToken, chatId, congratsText);
      } else if (congratsMode === 'direct') {
        const pmResult = await sendMessage(botToken, userId, congratsText + \`\\n\\n📢 این پیام به صورت خصوصی ارسال شده است تا چت گروه شلوغ نشود.\`);
        if (!pmResult.ok) {
          await sendMessage(botToken, chatId, congratsText + \`\\n\\n<i>(پیام خصوصی شما مسدود بود، تبریک در گروه اعلام شد)</i>\`);
        }
      }
    } else if (targetRank) {
      await setChatMemberTag(botToken, chatId, userId, targetRank.title, ownerId);
    }
  }
}

async function handleCallbackQuery(callbackQuery, env) {
  const botToken = env.BOT_TOKEN;
  const clickerId = callbackQuery.from.id;
  const clickerName = callbackQuery.from.first_name;
  const messageId = callbackQuery.message ? callbackQuery.message.message_id : null;
  const data = callbackQuery.data;

  await apiCall(botToken, "answerCallbackQuery", { callback_query_id: callbackQuery.id });

  if (data.startsWith("select_pv_chat_") || data === "pv_change_group") {
    let targetChatId = data === "pv_change_group" ? null : parseInt(data.substring(15));
    if (!targetChatId) {
      const activeUserGroups = await env.DB.prepare("SELECT u.*, s.chat_title, s.owner_id FROM users u JOIN settings s ON u.chat_id = s.chat_id WHERE u.user_id = ? AND u.is_active = 1").bind(clickerId).all();
      const listText = \`⚔️ <b>| گزینش جبهه نبرد (انتخاب گروه)</b>\\n━━━━━━━━━━━━━━━━━━\\nشما در چندین گروه نظامی فعال هستید. لطفاً گروه مورد نظر خود را جهت مشاهده اطلاعات پرونده یا چارت برگزینید:\\n\\n\`;
      const buttons = activeUserGroups.results.map((g, idx) => [{ text: \`🏰 \${g.chat_title || "جبهه " + toPersianDigits(idx + 1)}\`, callback_data: \`select_pv_chat_\${g.chat_id}\` }]);
      await sendOrEditMessage(botToken, clickerId, listText, messageId, buttons, true);
      return new Response("OK", { status: 200 });
    }
    const groupSettings = await env.DB.prepare("SELECT * FROM settings WHERE chat_id = ?").bind(targetChatId).first();
    const menuText = \`🏰 <b>| مقر جبهه: \${groupSettings.chat_title || "گروه نظامی"}</b>\\n━━━━━━━━━━━━━━━━━━\\nشما وارد اتاق جنگ این جبهه شدید. یکی از گزینه‌های زیر را انتخاب کنید:\`;
    const buttons = [
      [{ text: "🎖️ رتبه من در این گروه", callback_data: \`pv_action_rank_\${targetChatId}\` }, { text: "🏆 چارت برترین‌ها", callback_data: \`pv_action_chart_\${targetChatId}\` }],
      [{ text: "📅 چارت هفتگی", callback_data: \`pv_action_weekly_\${targetChatId}\` }, { text: "📜 لیست درجات", callback_data: \`pv_action_ranks_\${targetChatId}\` }],
      [{ text: "🔄 تغییر جبهه نبرد (برگشت)", callback_data: "pv_change_group" }]
    ];
    await sendOrEditMessage(botToken, clickerId, menuText, messageId, buttons, true);
    return new Response("OK", { status: 200 });
  }

  if (data.startsWith("pv_action_")) {
    const actionParts = data.substring(10).split("_");
    const action = actionParts[0];
    const targetChatId = parseInt(actionParts[1]);
    const groupSettings = await env.DB.prepare("SELECT * FROM settings WHERE chat_id = ?").bind(targetChatId).first();
    const ranksForGroup = await getOrSeedRanks(env, targetChatId);
    const backButton = [[{ text: "⬅️ برگشت به منوی گروه", callback_data: \`select_pv_chat_\${targetChatId}\` }]];

    if (action === "rank") await handleRankCommand(botToken, clickerId, clickerId, clickerName, messageId, env, ranksForGroup, groupSettings, backButton, true);
    else if (action === "chart") await handleChartCommand(botToken, clickerId, messageId, env, ranksForGroup, groupSettings, true);
    else if (action === "weekly") await handleWeeklyChartCommand(botToken, clickerId, messageId, env, ranksForGroup, groupSettings, true);
    else if (action === "ranks") await handleRanksListCommand(botToken, clickerId, messageId, ranksForGroup, backButton, true);
    return new Response("OK", { status: 200 });
  }

  const chatId = callbackQuery.message.chat.id;
  const groupSettings = await env.DB.prepare("SELECT * FROM settings WHERE chat_id = ?").bind(chatId).first();
  if (!groupSettings) return new Response("OK", { status: 200 });
  const ranksForGroup = await getOrSeedRanks(env, chatId);

  if (data === "show_chart_click") return await handleChartCommand(botToken, chatId, messageId, env, ranksForGroup, groupSettings, true);
  if (data === "show_ranks_click") return await handleRanksListCommand(botToken, chatId, messageId, ranksForGroup, null, true);
  if (data === "show_my_rank_click") return await handleRankCommand(botToken, chatId, clickerId, clickerName, messageId, env, ranksForGroup, groupSettings, null, true);
  if (data === "show_weekly_click") return await handleWeeklyChartCommand(botToken, chatId, messageId, env, ranksForGroup, groupSettings, true);
  if (data === "show_help_click") return await handleHelpCommand(botToken, chatId, messageId, true);

  if (data === "toggle_congrats_click") {
    if (clickerId === groupSettings.owner_id) return await handleToggleCongratsCommand(botToken, chatId, messageId, env, groupSettings, true);
    else await apiCall(botToken, "answerCallbackQuery", { callback_query_id: callbackQuery.id, text: "🚫 فقط شاهنشاه اجازه تغییر این تنظیم را دارد.", show_alert: true });
    return new Response("OK", { status: 200 });
  }

  if (data.startsWith("select_rank_")) {
    const parts = data.split("_");
    const targetRankId = parseInt(parts[2]);
    const minMsgs = parseInt(parts[3]);
    const dbUser = await env.DB.prepare("SELECT * FROM users WHERE chat_id = ? AND user_id = ?").bind(chatId, clickerId).first();
    if (!dbUser || dbUser.message_count < minMsgs) {
      await sendMessage(botToken, chatId, \`🚫 <b>\${clickerName}</b>، امتیاز کافی ندارید.\`);
      return new Response("OK", { status: 200 });
    }
    const chosenRank = ranksForGroup.find(r => r.id === targetRankId);
    if (!chosenRank) return new Response("OK", { status: 200 });
    await env.DB.prepare("UPDATE users SET current_rank_id = ? WHERE chat_id = ? AND user_id = ?").bind(targetRankId, chatId, clickerId).run();
    await setChatMemberTag(botToken, chatId, clickerId, chosenRank.title, groupSettings.owner_id);
    await sendMessage(botToken, chatId, \`✅ <b>رتبه تایید شد!</b>\\n🎉 تبریک به <b>\${clickerName}</b>! رتبه شما به <b>\${chosenRank.emoji} \${chosenRank.title}</b> تغییر یافت!\`, messageId);
  }
  return new Response("OK", { status: 200 });
}

async function handleMessage(message, env) {
  const botToken = env.BOT_TOKEN;
  const chatId = message.chat.id;
  const isPrivate = message.chat.type === "private";
  const userId = message.from.id;
  const firstName = message.from.first_name || "کاربر ناشناس";
  const username = message.from.username || "";
  const text = message.text || "";

  if (message.left_chat_member) {
    const leftUser = message.left_chat_member;
    const botId = parseInt(botToken.split(":")[0]);
    if (leftUser.id === botId) await env.DB.prepare("UPDATE settings SET is_active = 0 WHERE chat_id = ?").bind(chatId).run();
    else await env.DB.prepare("UPDATE users SET is_active = 0 WHERE chat_id = ? AND user_id = ?").bind(chatId, leftUser.id).run();
    return new Response("OK", { status: 200 });
  }

  if (message.new_chat_members) {
    const botId = parseInt(botToken.split(":")[0]);
    if (message.new_chat_members.some(m => m.id === botId)) {
      await getOrInitializeSettings(botToken, env, chatId, userId, message.chat.title);
      await sendMessage(botToken, chatId, \`🤖 <b>درود بر شما جنگجویان گرامی!</b>\\n\\nمن ربات رتبه‌بندی نظامی هوشمند گروه هستم. فعالیت و پیام‌های شما را شمرده و درجات نظامی اعطا می‌کنم!\\n\\n👑 مالک اصلی گروه به عنوان شاهنشاه شناخته می‌شود. جهت بررسی دسترسی‌ها ادمین‌ها دستور /checkperms را ارسال کنند.\`);
    }
    return new Response("OK", { status: 200 });
  }

  let processedText = text.trim();
  if (processedText === "🎖️ رتبه نظامی من" || processedText === "رتبه من") processedText = "/rank";
  else if (processedText === "🏆 جدول برترین‌ها (چارت)" || processedText === "چارت") processedText = "/chart";
  else if (processedText === "📜 هرم درجات نظامی" || processedText === "درجات") processedText = "/ranks";
  else if (processedText === "⚙️ راهنما و پشتیبانی" || processedText === "راهنما") processedText = "/help";

  if (isPrivate) {
    const activeUserGroups = await env.DB.prepare("SELECT u.*, s.chat_title, s.owner_id FROM users u JOIN settings s ON u.chat_id = s.chat_id WHERE u.user_id = ? AND u.is_active = 1").bind(userId).all();
    if (!activeUserGroups.results || activeUserGroups.results.length === 0) {
      const owned = await env.DB.prepare("SELECT * FROM settings WHERE owner_id = ?").bind(userId).all();
      if (owned.results && owned.results.length > 0) {
        const activeGroup = owned.results[0];
        const ranksForGroup = await getOrSeedRanks(env, activeGroup.chat_id);
        return await routePrivateCommand(processedText, botToken, chatId, userId, firstName, message.message_id, env, ranksForGroup, activeGroup);
      }
      await sendMessage(botToken, chatId, \`👋 <b>درود بر شما، \${firstName} عزیز!</b>\\n\\nشما هنوز در هیچ‌کدام از گروه‌های تحت نظارت من عضو و فعال نشده‌اید. لطفاً در یکی از گروه‌هایی که من فعال هستم گپ بزنید تا پرونده شما فعال شود.\`);
      return new Response("OK", { status: 200 });
    }
    if (activeUserGroups.results.length === 1) {
      const activeGroupUser = activeUserGroups.results[0];
      const settings = { chat_id: activeGroupUser.chat_id, owner_id: activeGroupUser.owner_id, chat_title: activeGroupUser.chat_title, congrats_mode: activeGroupUser.congrats_mode || 'direct' };
      const ranksForGroup = await getOrSeedRanks(env, settings.chat_id);
      return await routePrivateCommand(processedText, botToken, chatId, userId, firstName, message.message_id, env, ranksForGroup, settings);
    } else {
      const listText = \`⚔️ <b>| گزینش جبهه نبرد (انتخاب گروه)</b>\\n━━━━━━━━━━━━━━━━━━\\nشما در چندین گروه نظامی فعال هستید. لطفاً گروه مورد نظر خود را برگزینید:\\n\\n\`;
      const buttons = activeUserGroups.results.map((g, idx) => [{ text: \`🏰 \${g.chat_title || "جبهه " + toPersianDigits(idx + 1)}\`, callback_data: \`select_pv_chat_\${g.chat_id}\` }]);
      await apiCall(botToken, "sendMessage", { chat_id: chatId, text: listText, reply_markup: { inline_keyboard: buttons } });
      return new Response("OK", { status: 200 });
    }
  }

  const settings = await getOrInitializeSettings(botToken, env, chatId, userId, message.chat.title);
  const currentRanks = await getOrSeedRanks(env, chatId);

  if (message.reply_to_message) {
    const targetUser = message.reply_to_message.from;
    const isSenderAdmin = await checkSenderIsAdmin(botToken, chatId, userId);
    const isSenderOwner = userId === settings.owner_id;

    if (isSenderOwner || isSenderAdmin) {
      if (processedText === "ارتقاء مقام") {
        if (!isSenderOwner) {
          await sendMessage(botToken, chatId, \`🚫 فقط شاهنشاه (مالک اصلی گروه) اجازه ارتقای مستقیم درجات را دارد.\`, message.message_id);
          return new Response("OK", { status: 200 });
        }
        return await handleAdminPromote(botToken, chatId, targetUser.id, targetUser.first_name, env, currentRanks, settings);
      }
      if (processedText === "دادن صد امتیاز") {
        return await handleAdminAddPoints(botToken, chatId, targetUser.id, targetUser.first_name, targetUser.username || "", 100, env, currentRanks, settings);
      }
      const giveMatch = processedText.match(/^دادن\\s+(\\d+)\\s+امتیاز$/);
      if (giveMatch) {
        return await handleAdminAddPoints(botToken, chatId, targetUser.id, targetUser.first_name, targetUser.username || "", parseInt(giveMatch[1]), env, currentRanks, settings);
      }
      const takeMatch = processedText.match(/^کاهش\\s+(\\d+)\\s+امتیاز$/);
      if (takeMatch) {
        if (!isSenderOwner) {
          await sendMessage(botToken, chatId, \`🚫 فقط شاهنشاه (مالک اصلی گروه) اجازه کسر امتیاز را دارد.\`, message.message_id);
          return new Response("OK", { status: 200 });
        }
        return await handleAdminAddPoints(botToken, chatId, targetUser.id, targetUser.first_name, targetUser.username || "", -parseInt(takeMatch[1]), env, currentRanks, settings);
      }
    }
  }

  if (processedText.startsWith("/")) {
    const command = processedText.split(" ")[0].split("@")[0].toLowerCase();
    if (command === "/rank" || command === "/رتبه") return await handleRankCommand(botToken, chatId, userId, firstName, message.message_id, env, currentRanks, settings);
    if (command === "/chart" || command === "/چارت") return await handleChartCommand(botToken, chatId, message.message_id, env, currentRanks, settings);
    if (command === "/weekly") return await handleWeeklyChartCommand(botToken, chatId, message.message_id, env, currentRanks, settings);
    if (command === "/ranks") return await handleRanksListCommand(botToken, chatId, message.message_id, currentRanks);
    if (command === "/help") return await handleHelpCommand(botToken, chatId, message.message_id, false);
    if (command === "/checkperms") return await handleCheckPermsCommand(botToken, chatId, message.message_id, settings, env);
    
    if (userId === settings.owner_id) {
      if (command.startsWith("/addrank")) return await handleAddRankCommand(botToken, chatId, processedText, command, message.message_id, env, settings);
      if (command === "/status") return await handleStatusCommand(botToken, chatId, message.message_id, env, settings);
      if (command === "/togglecongrats") return await handleToggleCongratsCommand(botToken, chatId, message.message_id, env, settings);
    }
    return new Response("OK", { status: 200 });
  }

  if (processedText.length < 2) return new Response("OK", { status: 200 });

  const msgKey = \`\${chatId}_\${userId}\`;
  if (lastMessages.has(msgKey)) {
    const last = lastMessages.get(msgKey);
    if (last.text === processedText) {
      last.count += 1;
      if (last.count > 2) return new Response("OK", { status: 200 });
    } else {
      lastMessages.set(msgKey, { text: processedText, count: 1 });
    }
  } else {
    lastMessages.set(msgKey, { text: processedText, count: 1 });
  }

  if (userId === settings.owner_id) {
    await env.DB.prepare("INSERT OR IGNORE INTO users (chat_id, user_id, first_name, username, message_count, current_rank_id, last_message_at, is_active) VALUES (?, ?, ?, ?, 999999, 999, ?, 1)")
      .bind(chatId, userId, firstName, username, Math.floor(Date.now() / 1000)).run();
    return new Response("OK", { status: 200 });
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const initialRankId = currentRanks[0] ? currentRanks[0].id : 1;

  const result = await env.DB.prepare(\`
    INSERT INTO users (chat_id, user_id, first_name, username, message_count, weekly_message_count, weekly_reset_at, current_rank_id, last_message_at, is_active)
    VALUES (?1, ?2, ?3, ?4, 1, 1, ?5, ?6, ?5, 1)
    ON CONFLICT(chat_id, user_id) DO UPDATE SET
      first_name = excluded.first_name,
      username = excluded.username,
      message_count = users.message_count + 1,
      weekly_message_count = CASE WHEN ?5 - users.weekly_reset_at >= 604800 THEN 1 ELSE users.weekly_message_count + 1 END,
      weekly_reset_at = CASE WHEN ?5 - users.weekly_reset_at >= 604800 THEN ?5 ELSE users.weekly_reset_at END,
      last_message_at = ?5,
      is_active = 1
    RETURNING *;
  \`).bind(chatId, userId, firstName, username, currentTime, initialRankId).first();

  if (result.message_count === 1) {
    await setChatMemberTag(botToken, chatId, userId, currentRanks[0].title, settings.owner_id);
    const welcome = \`👋 <b>درود بر شما، \${firstName} عزیز!</b>\\n\\n🎖️ درجه نظامی شما: <b>\${currentRanks[0].title}</b>\\n✉️ تعداد پیام‌ها: <b>۱</b>\\n📈 درجه بعدی: <b>\${currentRanks[1] ? currentRanks[1].title : "نامشخص"} (نیاز به \${toPersianDigits(currentRanks[1] ? currentRanks[1].min_messages : 0)} پیام)</b>\`;
    await sendMessage(botToken, chatId, welcome, message.message_id, [[{ text: "📊 مشاهده چارت مقامات", callback_data: "show_chart_click" }]]);
  } else {
    await recalculateAndSyncRank(botToken, chatId, userId, firstName, env, currentRanks, settings);
  }

  return new Response("OK", { status: 200 });
}

async function routePrivateCommand(processedText, botToken, chatId, userId, firstName, messageId, env, currentRanks, settings) {
  const command = processedText.split(" ")[0].toLowerCase();
  if (command === "/start" || command === "/help") await handleHelpCommand(botToken, chatId, messageId, false);
  else if (command === "/rank") await handleRankCommand(botToken, chatId, userId, firstName, messageId, env, currentRanks, settings, PERSISTENT_KEYBOARD);
  else if (command === "/chart") await handleChartCommand(botToken, chatId, messageId, env, currentRanks, settings);
  else if (command === "/weekly") await handleWeeklyChartCommand(botToken, chatId, messageId, env, currentRanks, settings);
  else if (command === "/ranks") await handleRanksListCommand(botToken, chatId, messageId, currentRanks, PERSISTENT_KEYBOARD);
  else if (command === "/status" && userId === settings.owner_id) await handleStatusCommand(botToken, chatId, messageId, env, settings);
  else if (command === "/togglecongrats" && userId === settings.owner_id) await handleToggleCongratsCommand(botToken, chatId, messageId, env, settings);
  else await handleHelpCommand(botToken, chatId, messageId, false);
  return new Response("OK", { status: 200 });
}

async function handleRankCommand(botToken, chatId, userId, firstName, messageId, env, currentRanks, settings, replyMarkupOverride = null, isEdit = false) {
  if (userId === settings.owner_id) {
    const ownerText = \`👑 <b>| مقام سلطنتی شاهنشاه اعظم</b>\\n━━━━━━━━━━━━━━━━━━\\n👤 <b>نام فرمانروا:</b> <code>\${firstName}</code>\\n🎖️ <b>درجه دائمی:</b> <code>شاهنشاه</code>\\n\\n🔱 شما جایگاه جاودان و ابدی بالای هرم نظامی را دارا هستید و نیازی به ارزیابی درجه ندارید.\`;
    const buttons = [[{ text: "📊 جدول برترین‌ها (چارت)", callback_data: "show_chart_click" }, { text: "📜 لیست درجات نظامی", callback_data: "show_ranks_click" }]];
    await sendOrEditMessage(botToken, chatId, ownerText, messageId, replyMarkupOverride || buttons, isEdit);
    return new Response("OK", { status: 200 });
  }

  const dbUser = await env.DB.prepare("SELECT * FROM users WHERE chat_id = ? AND user_id = ?").bind(settings.chat_id, userId).first();
  if (!dbUser) {
    const text = \`🚫 <b>درود رزمنده!</b>\\n\\n<b>\${firstName}</b>، پرونده نظامی شما یافت نشد. کافیست در گروه چت کنید تا پرونده فعال گردد!\`;
    const buttons = [[{ text: "📊 چارت برترین‌ها", callback_data: "show_chart_click" }, { text: "📜 هرم درجات", callback_data: "show_ranks_click" }]];
    await sendOrEditMessage(botToken, chatId, text, messageId, replyMarkupOverride || buttons, isEdit);
    return new Response("OK", { status: 200 });
  }

  const currentRank = currentRanks.find(r => r.id === dbUser.current_rank_id) || currentRanks[0];
  const nextRanks = currentRanks.filter(r => r.min_messages > dbUser.message_count);
  let nextRankText = "";

  if (nextRanks.length > 0) {
    const nextRank = nextRanks[0];
    const remaining = nextRank.min_messages - dbUser.message_count;
    const totalForNext = nextRank.min_messages - (currentRank ? currentRank.min_messages : 0);
    const completedForNext = dbUser.message_count - (currentRank ? currentRank.min_messages : 0);
    const percentage = Math.min(100, Math.max(0, Math.floor((completedForNext / (totalForNext || 1)) * 100)));
    const filledBlocks = Math.floor(percentage / 10);
    const progressBar = "■".repeat(filledBlocks) + "□".repeat(10 - filledBlocks);

    nextRankText = \`📈 <b>در آستانه ارتقا به درجه بعدی:</b>\\n↳ \${nextRank.emoji} <b>\${nextRank.title}</b>\\n📊 <b>میزان پیشرفت:</b> <code>[\${progressBar}] \${toPersianDigits(percentage)}%</code>\\n✉️ <b>باقیمانده:</b> <code>\${toPersianDigits(remaining)}</code> پیام\`;
  } else {
    nextRankText = \`🔥 <b>تبریک شایسته! شما در راس هرم نظامی و قله افتخار گروه قرار دارید!</b>\`;
  }

  const rankText = \`🪖 <b>| پرونده نظامی و اطلاعات رزمنده</b>\\n━━━━━━━━━━━━━━━━━━\\n👤 <b>نام:</b> <code>\${firstName}</code>\\n🏅 <b>درجه فعلی:</b> <b>\${currentRank ? currentRank.emoji : "🎖️"} \${currentRank ? currentRank.title : "سرباز"}</b>\\n✉️ <b>کل پیام‌ها:</b> <code>\${toPersianDigits(dbUser.message_count)}</code>\\n📅 <b>پیام‌های این هفته:</b> <code>\${toPersianDigits(dbUser.weekly_message_count)}</code>\\n━━━━━━━━━━━━━━━━━━\\n\${nextRankText}\`;
  const buttons = [
    [{ text: "📊 جدول برترین‌ها (چارت)", callback_data: "show_chart_click" }, { text: "📜 لیست درجات نظامی", callback_data: "show_ranks_click" }],
    [{ text: "⚙️ راهنمای جامع", callback_data: "show_help_click" }]
  ];
  await sendOrEditMessage(botToken, chatId, rankText, messageId, replyMarkupOverride || buttons, isEdit);
  return new Response("OK", { status: 200 });
}

async function handleChartCommand(botToken, chatId, messageId, env, currentRanks, settings, isEdit = false) {
  const topUsers = await env.DB.prepare("SELECT * FROM users WHERE chat_id = ? AND user_id != ? AND is_active = 1 ORDER BY message_count DESC LIMIT 15").bind(settings.chat_id, settings.owner_id).all();
  let ownerName = "شاهنشاه";
  try {
    const ownerRes = await apiCall(botToken, "getChatMember", { chat_id: settings.chat_id, user_id: settings.owner_id });
    if (ownerRes.ok) ownerName = ownerRes.result.user.first_name;
  } catch {}

  let chartText = \`🏆 <b>| چارت مقامات و تالار افتخارات گروه</b>\\n━━━━━━━━━━━━━━━━━━\\n👑 <b>شاهنشاه (مالک ارشد):</b> <code>\${ownerName}</code>\\n━━━━━━━━━━━━━━━━━━\\n\`;
  if (topUsers.results && topUsers.results.length > 0) {
    topUsers.results.forEach((user, idx) => {
      const userRank = currentRanks.find(r => r.id === user.current_rank_id) || currentRanks[0];
      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🔹";
      chartText += \`\${medal} <b>رتبه \${toPersianDigits(idx + 1)}:</b> <code>\${user.first_name || "کاربر"}</code>\\n↳ درجه: \address_card: \${userRank ? userRank.emoji : "🎖️"} <b>\${userRank ? userRank.title : "سرباز"}</b> | پیام‌ها: <code>\address_card: \${toPersianDigits(user.message_count)}</code>\\n\\n\`;
    });
  } else {
    chartText += \`<i>هنوز هیچ رزمنده‌ای پیامی ارسال نکرده است.</i>\\n\`;
  }

  const buttons = [
    [{ text: "🎖️ رتبه نظامی من", callback_data: "show_my_rank_click" }, { text: "📅 چارت هفتگی", callback_data: "show_weekly_click" }],
    [{ text: "📜 لیست درجات نظامی", callback_data: "show_ranks_click" }, { text: "⚙️ راهنمای جامع", callback_data: "show_help_click" }]
  ];
  await sendOrEditMessage(botToken, chatId, chartText, messageId, buttons, isEdit);
  return new Response("OK", { status: 200 });
}

async function handleWeeklyChartCommand(botToken, chatId, messageId, env, currentRanks, settings, isEdit = false) {
  const currentTime = Math.floor(Date.now() / 1000);
  const topUsers = await env.DB.prepare("SELECT * FROM users WHERE chat_id = ? AND user_id != ? AND is_active = 1 AND (?1 - weekly_reset_at < 604800) AND weekly_message_count > 0 ORDER BY weekly_message_count DESC LIMIT 15").bind(settings.chat_id, settings.owner_id, currentTime).all();

  let text = \`📅 <b>| چارت هفتگی و مبارزین فعال ۷ روز گذشته</b>\\n━━━━━━━━━━━━━━━━━━\\n<i>پیام‌های ارسالی در یک هفته اخیر:</i>\\n\\n\`;
  if (topUsers.results && topUsers.results.length > 0) {
    topUsers.results.forEach((user, idx) => {
      const userRank = currentRanks.find(r => r.id === user.current_rank_id) || currentRanks[0];
      const medal = idx === 0 ? "⚡" : idx === 1 ? "✨" : idx === 2 ? "⭐️" : "🔹";
      text += \`\${medal} <b>رتبه \address_card: \address_card: \${toPersianDigits(idx + 1)}:</b> <code>\${user.first_name || "کاربر"}</code>\\n↳ درجه: \${userRank ? userRank.emoji : "🎖️"} <b>\${userRank ? userRank.title : "سرباز"}</b> | پیام‌ها: <code>\${toPersianDigits(user.weekly_message_count)}</code>\\n\\n\`;
    });
  } else {
    text += \`<i>هنوز هیچ مبارزی در ۷ روز گذشته پیام ثبت نکرده است!</i>\\n\\n\`;
  }
  text += \`━━━━━━━━━━━━━━━━━━\\n🌱 آمار هفتگی هر کاربر دقیقاً ۷ روز پس از اولین پیام هفتگی او مجدداً ریست می‌شود.\`;

  const buttons = [
    [{ text: "🎖️ رتبه نظامی من", callback_data: "show_my_rank_click" }, { text: "🏆 چارت کلی (همه زمان‌ها)", callback_data: "show_chart_click" }],
    [{ text: "📜 لیست درجات نظامی", callback_data: "show_ranks_click" }, { text: "⚙️ راهنمای جامع", callback_data: "show_help_click" }]
  ];
  await sendOrEditMessage(botToken, chatId, text, messageId, buttons, isEdit);
  return new Response("OK", { status: 200 });
}

async function handleRanksListCommand(botToken, chatId, messageId, currentRanks, replyMarkupOverride = null, isEdit = false) {
  let text = \`🎖️ <b>| سلسله‌مراتب و هرم درجات نظامی گروه</b>\\n━━━━━━━━━━━━━━━━━━\\n👑 <b>شاهنشاه اعظم</b>\\n↳ <i>ویژه مالک ارشد گروه (بدون نیاز به امتیاز)</i>\\n\\n\`;
  currentRanks.forEach((r, idx) => {
    const isChoice = r.group_choice_key ? " 🌟 [انتخابی]" : "";
    text += \`\${r.emoji} <b>درجه \${toPersianDigits(idx + 1)}: \${r.title}</b>\\n↳ حدنصاب پیام لازم: <code>\${toPersianDigits(r.min_messages)}</code> پیام\${isChoice}\\n\\n\`;
  });
  text += \`━━━━━━━━━━━━━━━━━━\\n📢 ارتقای درجه شما کاملاً خودکار بوده و تگ درجه شما در گروه نصب خواهد شد!\`;

  const buttons = [
    [{ text: "🎖️ رتبه نظامی من", callback_data: "show_my_rank_click" }, { text: "📊 جدول برترین‌ها (چارت)", callback_data: "show_chart_click" }],
    [{ text: "⚙️ راهنمای جامع", callback_data: "show_help_click" }]
  ];
  await sendOrEditMessage(botToken, chatId, text, messageId, replyMarkupOverride || buttons, isEdit);
  return new Response("OK", { status: 200 });
}

async function handleHelpCommand(botToken, chatId, messageId, isEdit = false) {
  const helpText = \`⚙️ <b>| راهنمای جامع سیستم نظامی رتبه‌بندی</b>\\n━━━━━━━━━━━━━━━━━━\\n🤖 این ربات به صورت لحظه‌ای چت‌های فعال گروه را ردیابی کرده و بر اساس میزان فعالیت، درجات نظامی خاص اعطا می‌کند.\\n\\n👑 <b>چگونه ارتقا درجه بگیریم؟</b>\\nکافیست در گروه چت کنید! سیستم هر پیام شما را شمرده و به محض رسیدن به حدنصاب، رتبه جدید به همراه برچسب (Tag) اختصاصی برای شما ثبت می‌شود.\\n\\n⚠️ <b>قوانین ضد اسپم:</b>\\nبین پیام‌های ارسالی باید حداقل ۲ ثانیه فاصله باشد. همچنین ارسال پیام‌های تکراری و یک کلمه‌ای مکرر شمرده نخواهد شد.\`;
  const buttons = [
    [{ text: "🎖️ رتبه نظامی من", callback_data: "show_my_rank_click" }, { text: "📊 جدول برترین‌ها (چارت)", callback_data: "show_chart_click" }],
    [{ text: "📜 هرم درجات نظامی", callback_data: "show_ranks_click" }]
  ];
  await sendOrEditMessage(botToken, chatId, helpText, messageId, buttons, isEdit);
  return new Response("OK", { status: 200 });
}

async function handleCheckPermsCommand(botToken, chatId, messageId, settings, env) {
  const botId = parseInt(botToken.split(":")[0]);
  let text = \`🔍 <b>| بررسی دسترسی‌های نظامی ربات در گروه</b>\\n━━━━━━━━━━━━━━━━━━\\n\`;
  try {
    const res = await apiCall(botToken, "getChatMember", { chat_id: chatId, user_id: botId });
    if (res.ok) {
      const member = res.result;
      if (member.status === "administrator") {
        const canManageTags = member.can_manage_tags || false;
        text += \`🤖 <b>وضعیت ربات:</b> <code>ادمین گروه</code>\\n\\n\`;
        if (canManageTags) {
          text += \`✅ <b>دسترسی تگ‌گذاری (can_manage_tags):</b> <code>فعال 🟢</code>\\nربات با موفقیت می‌تواند عناوین را نمایش دهد.\`;
        } else {
          text += \`❌ <b>دسترسی تگ‌گذاری (can_manage_tags):</b> <code>غیرفعال 🔴</code>\\n\\n⚠️ <b>مهم:</b> برای نمایش تگ درجات، باید از پنل مدیریت گروه، دسترسی <b>"Manage Stories" یا "can_manage_tags"</b> را برای ربات فعال کنید.\`;
        }
      } else {
        text += \`🤖 <b>وضعیت ربات:</b> <code>کاربر عادی ⚠️</code>\\n\\n❌ ربات ادمین نیست! لطفاً ربات را ادمین کرده و دسترسی تگ‌گذاری را فعال کنید.\`;
      }
    } else {
      text += \`❌ خطا در استعلام: <code>\address_card: \${res.description}</code>\`;
    }
  } catch (err) {
    text += \`❌ خطا در استعلام: <code>\${err.message}</code>\`;
  }
  await sendMessage(botToken, chatId, text, messageId);
  return new Response("OK", { status: 200 });
}

async function handleAddRankCommand(botToken, chatId, text, command, messageId, env, settings) {
  const rawArgs = text.substring(command.length).trim();
  const parts = rawArgs.split("|").map(p => p.trim());
  if (parts.length < 3) {
    await sendMessage(botToken, chatId, \`⚠️ <b>فرمت نامعتبر!</b>\\nمثال: <code>/addrank سرلشکر | 🎖️ | 3000</code>\address_card:\`, messageId);
    return new Response("OK", { status: 200 });
  }
  const title = parts[0];
  const emoji = parts[1];
  const minMessages = parseInt(parts[2]);
  let choiceKey = parts[3] && parts[3].startsWith("group:") ? parts[3].substring(6).trim() : null;

  if (isNaN(minMessages)) {
    await sendMessage(botToken, chatId, \`⚠️ تعداد پیام نامعتبر است.\`, messageId);
    return new Response("OK", { status: 200 });
  }

  try {
    const maxIdRes = await env.DB.prepare("SELECT MAX(id) as max_id FROM ranks WHERE chat_id = ?").bind(chatId).first();
    const nextRankId = (maxIdRes && maxIdRes.max_id ? maxIdRes.max_id : 0) + 1;
    await env.DB.prepare("INSERT INTO ranks (chat_id, id, title, emoji, min_messages, sort_order, group_choice_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(chatId, nextRankId, title, emoji, minMessages, minMessages, choiceKey).run();
    await sendMessage(botToken, chatId, \`✅ <b>رتبه جدید اضافه شد!</b>\\n🎖️ عنوان: <code>\${title}</code>\\nحدنصاب: <code>\address_card: \${toPersianDigits(minMessages)}</code>\`, messageId);
  } catch (err) {
    await sendMessage(botToken, chatId, \`❌ خطا در درج دیتابیس D1: <code>\${err.message}</code>\`, messageId);
  }
  return new Response("OK", { status: 200 });
}

async function handleStatusCommand(botToken, chatId, messageId, env, settings) {
  const botId = parseInt(botToken.split(":")[0]);
  const statsUsers = await env.DB.prepare("SELECT COUNT(*) as total FROM users WHERE chat_id = ?").bind(chatId).first();
  const statsActive = await env.DB.prepare("SELECT COUNT(*) as total FROM users WHERE chat_id = ? AND is_active = 1").bind(chatId).first();
  const statsRanks = await env.DB.prepare("SELECT COUNT(*) as total FROM ranks WHERE chat_id = ?").bind(chatId).first();
  let permText = "⚠️ نامشخص";
  try {
    const res = await apiCall(botToken, "getChatMember", { chat_id: chatId, user_id: botId });
    if (res.ok) permText = res.result.status === "administrator" && res.result.can_manage_tags ? "فعال 🟢" : "غیرفعال 🔴";
  } catch {}

  const text = \`⚙️ <b>| وضعیت سلامت و آمارهای ربات نظامی</b>\\n━━━━━━━━━━━━━━━━━━\\n🏰 <b>گروه:</b> <code>\${settings.chat_title}</code>\\n🆔 <b>شناسه چت:</b> <code>\address_card: \${chatId}</code>\\n🛡️ <b>تگ‌گذاری (can_manage_tags):</b> <code>\${permText}</code>\\n📢 <b>اعلام ارتقا (congrats_mode):</b> <code>\${settings.congrats_mode}</code>\\n\\n📊 <b>آمارهای نظامی:</b>\\n↳ کل رزمندگان: <code>\${toPersianDigits(statsUsers ? statsUsers.total : 0)}</code>\\n↳ رزمندگان فعال: <code>\address_card: \${toPersianDigits(statsActive ? statsActive.total : 0)}</code>\\n↳ رتبه‌های تعریف‌شده: <code>\${toPersianDigits(statsRanks ? statsRanks.total : 0)}</code>\`;
  await sendMessage(botToken, chatId, text, messageId);
  return new Response("OK", { status: 200 });
}

async function handleToggleCongratsCommand(botToken, chatId, messageId, env, settings, isEdit = false) {
  const currentMode = settings.congrats_mode || 'direct';
  const nextMode = currentMode === 'direct' ? 'instant' : currentMode === 'instant' ? 'disabled' : 'direct';
  await env.DB.prepare("UPDATE settings SET congrats_mode = ? WHERE chat_id = ?").bind(nextMode, chatId).run();
  settings.congrats_mode = nextMode;

  const modeNames = { 'direct': 'ارسال خصوصی به کاربر 📲', 'instant': 'اعلام فوری در گروه 🔊', 'disabled': 'بدون اعلام (سایلنت) 🔕' };
  const text = \`⚙️ <b>| تغییر تنظیمات تبریک ارتقا</b>\\n━━━━━━━━━━━━━━━━━━\\nوضعیت تبریک‌ها تغییر یافت.\\n\\n◀️ <b>وضعیت قبلی:</b> <code>\${modeNames[currentMode]}</code>\\n▶️ <b>وضعیت فعلی:</b> <code>\address_card: \${modeNames[nextMode]}</code>\`;
  const buttons = [[{ text: \`سوییچ کردن حالت 🔄\`, callback_data: \`toggle_congrats_click\` }], [{ text: "⬅️ برگشت به راهنما", callback_data: \`show_help_click\` }]];
  await sendOrEditMessage(botToken, chatId, text, messageId, buttons, isEdit);
  return new Response("OK", { status: 200 });
}

async function handleAdminPromote(botToken, chatId, targetUserId, targetFirstName, env, currentRanks, settings) {
  const dbUser = await env.DB.prepare("SELECT * FROM users WHERE chat_id = ? AND user_id = ?").bind(chatId, targetUserId).first();
  if (!dbUser) {
    await sendMessage(botToken, chatId, \`🚫 رکوردی یافت نشد.\`);
    return new Response("OK", { status: 200 });
  }
  const idx = currentRanks.findIndex(r => r.id === dbUser.current_rank_id);
  const nextRank = currentRanks[idx + 1];
  if (!nextRank) {
    await sendMessage(botToken, chatId, \`👑 <b>\${targetFirstName}</b> در بالاترین درجه قرار دارد.\`);
    return new Response("OK", { status: 200 });
  }
  const targetMessages = Math.max(dbUser.message_count, nextRank.min_messages);
  await env.DB.prepare("UPDATE users SET current_rank_id = ?, message_count = ? WHERE chat_id = ? AND user_id = ?").bind(nextRank.id, targetMessages, chatId, targetUserId).run();
  await setChatMemberTag(botToken, chatId, targetUserId, nextRank.title, settings.owner_id);
  await sendMessage(botToken, chatId, \`🎖️ <b>| ارتقای مستقیم شاهنشاه</b>\\n━━━━━━━━━━━━━━━━━━\\n🎉 جنگجو <b>\address_card: \${targetFirstName}</b> به درجه <b>\address_card: \${nextRank.emoji} \${nextRank.title}</b> منصوب شد!\`);
  return new Response("OK", { status: 200 });
}

async function handleAdminAddPoints(botToken, chatId, targetUserId, targetFirstName, targetUsername, points, env, currentRanks, settings) {
  let dbUser = await env.DB.prepare("SELECT * FROM users WHERE chat_id = ? AND user_id = ?").bind(chatId, targetUserId).first();
  const currentTime = Math.floor(Date.now() / 1000);
  const initialRankId = currentRanks[0] ? currentRanks[0].id : 1;

  if (!dbUser) {
    await env.DB.prepare("INSERT INTO users (chat_id, user_id, first_name, username, message_count, current_rank_id, last_message_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)")
      .bind(chatId, targetUserId, targetFirstName, targetUsername, Math.max(0, points), initialRankId, currentTime).run();
    dbUser = { message_count: 0, current_rank_id: initialRankId };
  }

  const newCount = Math.max(0, dbUser.message_count + points);
  await env.DB.prepare("UPDATE users SET message_count = ? WHERE chat_id = ? AND user_id = ?").bind(newCount, chatId, targetUserId).run();

  const isAddition = points >= 0;
  await sendMessage(botToken, chatId, \`\${isAddition ? "📈" : "📉"} <b>| فرمان تغییر موازنه قوا صادر شد</b>\\n━━━━━━━━━━━━━━━━━━\\nامتیازات <b>\${targetFirstName}</b> به مقدار <code>\${toPersianDigits(Math.abs(points))}</code> واحد \${isAddition ? "افزایش" : "کاهش"} یافت! مجموع: <code>\${toPersianDigits(newCount)}</code>\`);
  await recalculateAndSyncRank(botToken, chatId, targetUserId, targetFirstName, env, currentRanks, settings);
  return new Response("OK", { status: 200 });
}
`;
}
