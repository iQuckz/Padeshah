import React, { useState, useEffect, useRef } from 'react';
import { Rank, User, SimulatedMessage, SqlLog } from '../types';
import { Send, Users, ShieldAlert, Database, HelpCircle, UserPlus, ArrowDown, Sparkles, MessageCircleCode } from 'lucide-react';

interface ChatSimulatorProps {
  ranks: Rank[];
  onSqlLog: (log: SqlLog) => void;
  sqlLogs: SqlLog[];
  onClearLogs: () => void;
}

const DEFAULT_USERS: User[] = [
  { user_id: 110, first_name: 'رضا کریمی', username: 'reza_karimi', message_count: 42, current_rank_id: 1, last_message_at: 0 },
  { user_id: 120, first_name: 'سارا احمدی', username: 'sara_ahmadi', message_count: 148, current_rank_id: 2, last_message_at: 0 },
  { user_id: 130, first_name: 'مریم رضایی', username: 'maryam_rezayi', message_count: 8, current_rank_id: 1, last_message_at: 0 },
  { user_id: 140, first_name: 'علیرضا شایان', username: 'alireza_sh', message_count: 0, current_rank_id: 1, last_message_at: 0 },
  { user_id: 999, first_name: 'پژمان مهدوی', username: 'pejman_boss', message_count: 9999, current_rank_id: null, last_message_at: 0, is_owner: true }
];

export default function ChatSimulator({ ranks, onSqlLog, sqlLogs, onClearLogs }: ChatSimulatorProps) {
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  const [selectedUserId, setSelectedUserId] = useState<number>(110);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<SimulatedMessage[]>([
    {
      id: 'init-1',
      user_id: 0,
      first_name: 'ربات رتبه‌بندی',
      username: 'RankBot',
      text: '🤖 <b>ربات رتبه‌بندی نظامی فعال شد!</b>\nمن در این گروه پیام‌های شما را شمارش کرده و به شما درجات نظامی اهدا خواهم کرد.\n\n👑 مالک گروه به عنوان <b>شاهنشاه</b> تگ شده است.',
      timestamp: Date.now() - 3600000,
      is_bot: true,
      tag: 'RankBot'
    }
  ]);
  const [replyToMsg, setReplyToMsg] = useState<SimulatedMessage | null>(null);
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Helper to get user's current rank
  const getUserRank = (user: User): Rank => {
    if (user.is_owner) {
      return { id: 999, title: 'شاهنشاه', emoji: '👑', min_messages: 0, sort_order: 0 };
    }
    return ranks.find(r => r.id === user.current_rank_id) || ranks[0];
  };

  // Log D1 Query Helper
  const logD1 = (query: string, params?: string, type: SqlLog['type'] = 'select') => {
    const timestamp = new Date().toLocaleTimeString('fa-IR');
    onSqlLog({
      id: Math.random().toString(),
      timestamp,
      query,
      params,
      type
    });
  };

  // Add points manually (Admin Actions)
  const addPointsSim = (targetUserId: number, points: number, textCommand: string, originalMsgId: string) => {
    setUsers(prev => {
      return prev.map(u => {
        if (u.user_id === targetUserId) {
          if (u.is_owner) return u; // Owner can't be updated

          const oldRank = getUserRank(u);
          const newCount = Math.max(0, u.message_count + points);
          
          logD1(
            `UPDATE users SET message_count = ? WHERE user_id = ?`,
            `[${newCount}, ${targetUserId}]`,
            'update'
          );

          // Level up check
          const eligible = ranks.filter(r => newCount >= r.min_messages);
          let updatedRankId = u.current_rank_id;
          let botResponseText = '';
          let buttons: SimulatedMessage['inline_buttons'] = undefined;

          if (eligible.length > 0) {
            const maxMin = Math.max(...eligible.map(r => r.min_messages));
            const topEligible = eligible.filter(r => r.min_messages === maxMin);

            if (topEligible.length > 1 && topEligible[0].group_choice_key) {
              // Level up with choice
              const alreadyHasChoice = topEligible.some(r => r.id === u.current_rank_id);
              if (!alreadyHasChoice) {
                botResponseText = `🌟 <b>${u.first_name}</b>، شما به آستانه شکوهمند <b>${maxMin}</b> پیام رسیدید! اکنون می‌توانید یکی از رتبه‌های هم‌سطح زیر را انتخاب کنید:`;
                buttons = topEligible.map(r => ({
                  text: `${r.emoji} ${r.title}`,
                  callback_data: `select_rank_${r.id}_${r.min_messages}_${u.user_id}`
                }));
              }
            } else {
              // Regular auto level up
              const targetRank = topEligible[0];
              if (targetRank && targetRank.id !== u.current_rank_id) {
                if (!oldRank || targetRank.min_messages > oldRank.min_messages) {
                  updatedRankId = targetRank.id;
                  botResponseText = `🎉 <b>تبریک فراوان به ${u.first_name}!</b>\nشما با تلاش مستمر و ارسال ✉️ <b>${newCount}</b> پیام، به رتبه فاخر <b>${targetRank.emoji} ${targetRank.title}</b> ارتقا پیدا کردید!`;
                  
                  logD1(
                    `UPDATE users SET current_rank_id = ? WHERE user_id = ?`,
                    `[${targetRank.id}, ${targetUserId}]`,
                    'update'
                  );
                  logD1(
                    `CALL Telegram API: setChatMemberTag(chat_id, user_id=${targetUserId}, tag="${targetRank.title}")`,
                    undefined,
                    'schema'
                  );
                }
              }
            }
          }

          // Schedule bot responses
          setTimeout(() => {
            const isAddition = points >= 0;
            const emoji = isAddition ? '📈' : '📉';
            const changeText = isAddition ? `افزایش دادن ${points} امتیاز` : `کاهش دادن ${Math.abs(points)} امتیاز`;

            const adminNotify: SimulatedMessage = {
              id: Math.random().toString(),
              user_id: 0,
              first_name: 'ربات رتبه‌بندی',
              username: 'RankBot',
              text: `${emoji} <b>تغییر موازنه قوا توسط ادمین ارشد!</b>\n\n✉️ تعداد پیام‌های <b>${u.first_name}</b> به مقدار <b>${Math.abs(points)}</b> واحد ${isAddition ? "افزایش" : "کاهش"} یافت!\n📊 کل امتیاز فعلی: <b>${newCount}</b> پیام`,
              timestamp: Date.now(),
              is_bot: true,
              tag: 'RankBot',
              reply_to_message_id: originalMsgId
            };

            setMessages(m => [...m, adminNotify]);

            if (botResponseText) {
              setTimeout(() => {
                const levelUpMsg: SimulatedMessage = {
                  id: Math.random().toString(),
                  user_id: 0,
                  first_name: 'ربات رتبه‌بندی',
                  username: 'RankBot',
                  text: botResponseText,
                  timestamp: Date.now(),
                  is_bot: true,
                  inline_buttons: buttons,
                  tag: 'RankBot'
                };
                setMessages(m => [...m, levelUpMsg]);
              }, 600);
            }
          }, 300);

          return {
            ...u,
            message_count: newCount,
            current_rank_id: updatedRankId
          };
        }
        return u;
      });
    });
  };

  // Promote rank manually by 1 step
  const promoteRankSim = (targetUserId: number, originalMsgId: string) => {
    setUsers(prev => {
      return prev.map(u => {
        if (u.user_id === targetUserId) {
          if (u.is_owner) return u;

          const currentIdx = ranks.findIndex(r => r.id === u.current_rank_id);
          const nextRank = ranks[currentIdx + 1];

          if (!nextRank) {
            setTimeout(() => {
              setMessages(m => [...m, {
                id: Math.random().toString(),
                user_id: 0,
                first_name: 'ربات رتبه‌بندی',
                username: 'RankBot',
                text: `👑 <b>${u.first_name}</b> در حال حاضر در بالاترین رتبه نظامی ممکن قرار دارد!`,
                timestamp: Date.now(),
                is_bot: true,
                tag: 'RankBot',
                reply_to_message_id: originalMsgId
              }]);
            }, 300);
            return u;
          }

          const targetMessages = Math.max(u.message_count, nextRank.min_messages);

          logD1(
            `UPDATE users SET current_rank_id = ?, message_count = ? WHERE user_id = ?`,
            `[${nextRank.id}, ${targetMessages}, ${targetUserId}]`,
            'update'
          );
          logD1(
            `CALL Telegram API: setChatMemberTag(chat_id, user_id=${targetUserId}, tag="${nextRank.title}")`,
            undefined,
            'schema'
          );

          setTimeout(() => {
            setMessages(m => [...m, {
              id: Math.random().toString(),
              user_id: 0,
              first_name: 'ربات رتبه‌بندی',
              username: 'RankBot',
              text: `🎖️ <b>ارتقای درجه ادمین!</b>\n\n🎉 با دستور مستقیم مالک، کاربر <b>${u.first_name}</b> به رتبه فاخر <b>${nextRank.emoji} ${nextRank.title}</b> منصوب شد!\n✉️ کل پیام‌ها به آستانه <b>${targetMessages}</b> ارتقا یافت.`,
              timestamp: Date.now(),
              is_bot: true,
              tag: 'RankBot',
              reply_to_message_id: originalMsgId
            }]);
          }, 300);

          return {
            ...u,
            message_count: targetMessages,
            current_rank_id: nextRank.id
          };
        }
        return u;
      });
    });
  };

  // Handle Callback queries from inline buttons (User choice of rank)
  const handleCallbackClick = (rankId: number, minMsgs: number, targetUserId: number) => {
    setUsers(prev => {
      return prev.map(u => {
        if (u.user_id === targetUserId) {
          const chosenRank = ranks.find(r => r.id === rankId);
          if (!chosenRank) return u;

          logD1(
            `UPDATE users SET current_rank_id = ? WHERE user_id = ?`,
            `[${rankId}, ${targetUserId}]`,
            'update'
          );
          logD1(
            `CALL Telegram API: setChatMemberTag(chat_id, user_id=${targetUserId}, tag="${chosenRank.title}")`,
            undefined,
            'schema'
          );

          setTimeout(() => {
            setMessages(m => [...m, {
              id: Math.random().toString(),
              user_id: 0,
              first_name: 'ربات رتبه‌بندی',
              username: 'RankBot',
              text: `✅ <b>رتبه انتخابی تایید شد!</b>\n🎉 تبریک به <b>${u.first_name}</b>! رتبه شما با موفقیت به رتبه فاخر <b>${chosenRank.emoji} ${chosenRank.title}</b> تغییر یافت!\n✉️ تعداد پیام‌ها: ${u.message_count}`,
              timestamp: Date.now(),
              is_bot: true,
              tag: 'RankBot'
            }]);
          }, 300);

          return {
            ...u,
            current_rank_id: rankId
          };
        }
        return u;
      });
    });
  };

  // Handle sending a message in simulated chat
  const handleSendMessage = (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const text = (customText || inputText).trim();
    if (!text) return;

    if (!customText) setInputText('');

    const sender = users.find(u => u.user_id === selectedUserId);
    if (!sender) return;

    const rank = getUserRank(sender);
    const senderTag = rank ? rank.title : undefined;

    const newMsgId = Math.random().toString();
    const userMessage: SimulatedMessage = {
      id: newMsgId,
      user_id: sender.user_id,
      first_name: sender.first_name,
      username: sender.username,
      text: text,
      timestamp: Date.now(),
      is_bot: false,
      tag: senderTag,
      reply_to_message_id: replyToMsg ? replyToMsg.id : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setReplyToMsg(null);

    // D1 log for message
    logD1(
      `SELECT * FROM users WHERE user_id = ?`,
      `[${sender.user_id}]`,
      'select'
    );

    // Check if command
    if (text.startsWith('/')) {
      const cmd = text.split(' ')[0].toLowerCase();
      processBotCommand(cmd, text, sender, newMsgId);
      return;
    }

    // Check if admin text command directly typed by owner/creator
    if (userMessage.reply_to_message_id) {
      const repliedTo = messages.find(m => m.id === userMessage.reply_to_message_id);
      if (repliedTo && !repliedTo.is_bot) {
        const isSenderOwner = sender.is_owner;
        const isAdminCmd = ["ارتقاء مقام", "دادن صد امتیاز", "دادن", "کاهش"].some(kw => text.includes(kw));

        if (isAdminCmd) {
          if (isSenderOwner) {
            if (text === "ارتقاء مقام") {
              promoteRankSim(repliedTo.user_id, newMsgId);
              return;
            }
            if (text === "دادن صد امتیاز") {
              addPointsSim(repliedTo.user_id, 100, text, newMsgId);
              return;
            }
            // Give X points
            const giveMatch = text.match(/^دادن\s+(\d+)\s+امتیاز$/);
            if (giveMatch) {
              const pts = parseInt(giveMatch[1]);
              addPointsSim(repliedTo.user_id, pts, text, newMsgId);
              return;
            }
            // Take X points
            const takeMatch = text.match(/^کاهش\s+(\d+)\s+امتیاز$/);
            if (takeMatch) {
              const pts = parseInt(takeMatch[1]);
              addPointsSim(repliedTo.user_id, -pts, text, newMsgId);
              return;
            }
          } else {
            // Permission Error
            setTimeout(() => {
              setMessages(m => [...m, {
                id: Math.random().toString(),
                user_id: 0,
                first_name: 'ربات رتبه‌بندی',
                username: 'RankBot',
                text: `🚫 <b>خطای دسترسی!</b>\nفرستنده گرامی، شما مالک یا ادمین ارشد گروه نیستید و دسترسی لازم برای تغییر رتبه یا امتیاز کاربران را ندارید.`,
                timestamp: Date.now(),
                is_bot: true,
                tag: 'RankBot',
                reply_to_message_id: newMsgId
              }]);
            }, 350);
            return;
          }
        }
      }
    }

    // Process normal message counting
    if (sender.is_owner) {
      // Owner doesn't participate in message count
      return;
    }

    const nowSecs = Math.floor(Date.now() / 1000);
    const timeDiff = nowSecs - sender.last_message_at;

    if (timeDiff < 2 && sender.last_message_at > 0) {
      // Spam detected!
      setTimeout(() => {
        setMessages(m => [...m, {
          id: Math.random().toString(),
          user_id: 0,
          first_name: 'ربات رتبه‌بندی',
          username: 'RankBot',
          text: `⚠️ <b>ضد اسپم فعال شد!</b>\n<b>${sender.first_name}</b>، لطفاً فاصله ۲ ثانیه‌ای بین ارسال پیام‌ها را رعایت کنید. این پیام شمارش نشد.`,
          timestamp: Date.now(),
          is_bot: true,
          tag: 'RankBot'
        }]);
      }, 400);
      return;
    }

    // Increment count
    setUsers(prev => {
      return prev.map(u => {
        if (u.user_id === sender.user_id) {
          const newCount = u.message_count + 1;
          
          logD1(
            `UPDATE users SET first_name = ?, username = ?, message_count = ?, last_message_at = ? WHERE user_id = ?`,
            `["${sender.first_name}", "${sender.username || ''}", ${newCount}, ${nowSecs}, ${sender.user_id}]`,
            'update'
          );

          // Level up check
          const eligible = ranks.filter(r => newCount >= r.min_messages);
          let updatedRankId = u.current_rank_id;
          let botResponseText = '';
          let buttons: SimulatedMessage['inline_buttons'] = undefined;

          if (eligible.length > 0) {
            const maxMin = Math.max(...eligible.map(r => r.min_messages));
            const topEligible = eligible.filter(r => r.min_messages === maxMin);

            if (topEligible.length > 1 && topEligible[0].group_choice_key) {
              const alreadyHasChoice = topEligible.some(r => r.id === u.current_rank_id);
              if (!alreadyHasChoice) {
                botResponseText = `🌟 <b>${u.first_name}</b>، شما به آستانه شکوهمند <b>${maxMin}</b> پیام رسیدید! اکنون می‌توانید یکی از رتبه‌های هم‌سطح زیر را انتخاب کنید:`;
                buttons = topEligible.map(r => ({
                  text: `${r.emoji} ${r.title}`,
                  callback_data: `select_rank_${r.id}_${r.min_messages}_${u.user_id}`
                }));
              }
            } else {
              const targetRank = topEligible[0];
              if (targetRank && targetRank.id !== u.current_rank_id) {
                const oldRankObj = ranks.find(r => r.id === u.current_rank_id) || ranks[0];
                if (!oldRankObj || targetRank.min_messages > oldRankObj.min_messages) {
                  updatedRankId = targetRank.id;
                  botResponseText = `🎉 <b>تبریک فراوان به ${u.first_name}!</b>\nشما با تلاش مستمر و ارسال ✉️ <b>${newCount}</b> پیام، به رتبه فاخر <b>${targetRank.emoji} ${targetRank.title}</b> ارتقا پیدا کردید!`;
                  
                  logD1(
                    `UPDATE users SET current_rank_id = ? WHERE user_id = ?`,
                    `[${targetRank.id}, ${sender.user_id}]`,
                    'update'
                  );
                  logD1(
                    `CALL Telegram API: setChatMemberTag(chat_id, user_id=${sender.user_id}, tag="${targetRank.title}")`,
                    undefined,
                    'schema'
                  );
                }
              }
            }
          }

          if (botResponseText) {
            setTimeout(() => {
              setMessages(m => [...m, {
                id: Math.random().toString(),
                user_id: 0,
                first_name: 'ربات رتبه‌بندی',
                username: 'RankBot',
                text: botResponseText,
                timestamp: Date.now(),
                is_bot: true,
                inline_buttons: buttons,
                tag: 'RankBot'
              }]);
            }, 500);
          }

          return {
            ...u,
            message_count: newCount,
            last_message_at: nowSecs,
            current_rank_id: updatedRankId
          };
        }
        return u;
      });
    });
  };

  // Process /Commands
  const processBotCommand = (cmd: string, fullText: string, sender: User, originalMsgId: string) => {
    logD1(
      `BOT_CMD: Received "${cmd}" from user_id ${sender.user_id}`,
      undefined,
      'select'
    );

    setTimeout(() => {
      let responseText = '';
      let buttons: SimulatedMessage['inline_buttons'] = undefined;

      if (cmd === '/rank' || cmd === '/رتبه') {
        if (sender.is_owner) {
          responseText = `👑 <b>مقام سلطنتی شاهنشاه</b>\n\n👤 نام: <b>${sender.first_name}</b>\n🎖️ رتبه دائمی: <b>شاهنشاه</b>\n🔱 شما جایگاه جاودان بالای هرم نظامی را دارا هستید و نیازی به ارزیابی ندارید.`;
        } else {
          const currentRankObj = getUserRank(sender);
          const nextRanks = ranks.filter(r => r.min_messages > sender.message_count);
          let nextRankStr = '';

          if (nextRanks.length > 0) {
            const nextRank = nextRanks[0];
            const remaining = nextRank.min_messages - sender.message_count;
            nextRankStr = `📈 مانده تا رتبه بعدی (${nextRank.emoji} ${nextRank.title}): <b>${remaining} پیام</b>`;
          } else {
            nextRankStr = `🔥 شما به نهایت درجات و اوج قله نظامی رسیده‌اید!`;
          }

          responseText = `🪖 <b>اطلاعات نظامی شما:</b>\n\n👤 نام: <b>${sender.first_name}</b>\n🎖️ رتبه فعلی: <b>${currentRankObj.emoji} ${currentRankObj.title}</b>\n✉️ تعداد پیام‌ها: <b>${sender.message_count}</b>\n${nextRankStr}`;
        }
      } 
      else if (cmd === '/chart' || cmd === '/چارت') {
        const sortedOthers = [...users]
          .filter(u => !u.is_owner)
          .sort((a, b) => b.message_count - a.message_count);

        const ownerObj = users.find(u => u.is_owner);
        responseText = `🏆 <b>چارت مقامات و مشاهیر گروه</b> 🏆\n\n`;
        responseText += `👑 <b>شاهنشاه</b> — <b>${ownerObj ? ownerObj.first_name : 'پژمان مهدوی'}</b> (مالک ارشد گروه)\n`;

        sortedOthers.slice(0, 10).forEach((user, idx) => {
          const ur = getUserRank(user);
          responseText += `${idx + 1}. ${ur.emoji} <b>${ur.title}</b> — ${user.first_name} — ✉️ <b>${user.message_count}</b>\n`;
        });
      } 
      else if (cmd === '/ranks' || cmd === '/لیست_رتبه_ها') {
        responseText = `🎖️ <b>هرم درجات و مقامات گروه</b> 🎖️\n\n`;
        responseText += `👑 <b>شاهنشاه</b> — [بدون نیاز به پیش‌شرط پیام - ویژه مالک گروه]\n\n`;

        ranks.forEach(r => {
          const choiceText = r.group_choice_key ? ' [انتخابی]' : '';
          responseText += `${r.emoji} <b>${r.title}</b> — حداقل پیام لازم: <b>${r.min_messages}</b>${choiceText}\n`;
        });
      } 
      else if (cmd === '/addrank') {
        if (!sender.is_owner) {
          responseText = `🚫 <b>خطای دسترسی!</b>\nفرستنده گرامی، شما مالک یا ادمین ارشد گروه نیستید و دسترسی لازم برای ایجاد رتبه‌های جدید را ندارید.`;
        } else {
          // parse: /addrank title | emoji | min
          const args = fullText.substring(9).trim();
          const parts = args.split('|').map(p => p.trim());
          if (parts.length < 3) {
            responseText = `⚠️ <b>فرمت نامعتبر!</b>\nمثال صحیح:\n<code>/addrank سرلشکر | 🎖️ | 3000</code>`;
          } else {
            const title = parts[0];
            const emoji = parts[1];
            const minMsg = parseInt(parts[2]);
            if (isNaN(minMsg)) {
              responseText = `⚠️ تعداد پیام نامعتبر است.`;
            } else {
              responseText = `✅ <b>رتبه جدید با موفقیت اضافه شد!</b>\n🎖️ عنوان: <b>${title}</b>\n🎭 ایموجی: <b>${emoji}</b>\n✉️ حداقل پیام: <b>${minMsg}</b>`;
              logD1(
                `INSERT INTO ranks (title, emoji, min_messages) VALUES ('${title}', '${emoji}', ${minMsg})`,
                undefined,
                'insert'
              );
            }
          }
        }
      }
      else {
        responseText = `❓ دستور ناشناخته! دستورات پشتیبانی شده:\n/rank - رتبه من\n/chart - چارت مقامات\n/ranks - لیست درجات`;
      }

      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        user_id: 0,
        first_name: 'ربات رتبه‌بندی',
        username: 'RankBot',
        text: responseText,
        timestamp: Date.now(),
        is_bot: true,
        tag: 'RankBot',
        reply_to_message_id: originalMsgId,
        inline_buttons: buttons
      }]);

    }, 300);
  };

  // Add custom simulated user
  const handleAddSimulatedUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserFirstName.trim()) return;

    const newId = Math.floor(Math.random() * 1000) + 200;
    const newUser: User = {
      user_id: newId,
      first_name: newUserFirstName.trim(),
      username: newUserUsername.trim() || undefined,
      message_count: 0,
      current_rank_id: ranks[0].id,
      last_message_at: 0
    };

    setUsers(u => [...u, newUser]);
    setSelectedUserId(newId);
    setNewUserFirstName('');
    setNewUserUsername('');
    setShowAddUser(false);

    logD1(
      `INSERT INTO users (user_id, first_name, username, message_count, current_rank_id) VALUES (?, ?, ?, 0, ?)`,
      `[${newId}, "${newUser.first_name}", "${newUser.username || ''}", ${ranks[0].id}]`,
      'insert'
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 text-right" dir="rtl" id="chat-simulator-main-grid">
      
      {/* LEFT: Simulation Controllers */}
      <div className="xl:col-span-5 space-y-6">
        
        {/* Simulation Settings */}
        <div className="bg-[#1e293b]/90 backdrop-blur-md rounded-2xl border border-slate-700/60 p-5">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
            <span className="text-amber-400">⚙️</span>
            پنل کنترل و شبیه‌سازی کاربران
          </h3>

          <div className="space-y-4">
            {/* Sender Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">انتخاب کاربر سخنگو:</label>
              <div className="space-y-2 max-h-[220px] overflow-y-auto p-1.5 bg-slate-950/60 rounded-xl border border-slate-800">
                {users.map(u => {
                  const r = getUserRank(u);
                  const isSelected = selectedUserId === u.user_id;
                  return (
                    <button
                      key={u.user_id}
                      onClick={() => {
                        setSelectedUserId(u.user_id);
                        setReplyToMsg(null);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-right cursor-pointer ${
                        isSelected 
                          ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300' 
                          : 'hover:bg-slate-800/40 text-slate-300 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{r.emoji}</span>
                        <div>
                          <div className="font-semibold text-xs flex items-center gap-1">
                            {u.first_name}
                            {u.is_owner && <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 rounded">مالک</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            @{u.username || 'username_unknown'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-slate-900 px-2 py-0.5 rounded font-mono text-slate-400">
                          {u.message_count} ✉️
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">{r.title}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2">
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-slate-700 hover:border-slate-500 rounded-lg text-xs font-semibold text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-emerald-400" />
                افزودن کاربر فرضی جدید به چت
              </button>

              {showAddUser && (
                <form onSubmit={handleAddSimulatedUser} className="mt-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">نام کامل</label>
                      <input
                        type="text"
                        value={newUserFirstName}
                        onChange={(e) => setNewUserFirstName(e.target.value)}
                        placeholder="مثلا: احمد مرادی"
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">آیدی تلگرام (بدون @)</label>
                      <input
                        type="text"
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value)}
                        placeholder="ahmad_m"
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold py-1.5 rounded transition-colors cursor-pointer"
                  >
                    ثبت کاربر فرضی جدید
                  </button>
                </form>
              )}
            </div>

            {/* Quick Messages */}
            <div className="border-t border-slate-800 pt-3">
              <span className="block text-xs font-medium text-slate-400 mb-2">پیام‌های آماده شبیه‌سازی:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSendMessage(undefined, "سلام دوستان عزیز، چطورید؟")}
                  className="bg-slate-900 hover:bg-slate-800/80 text-[11px] text-slate-300 py-2 px-2.5 rounded-lg border border-slate-800 transition-all text-right truncate cursor-pointer"
                >
                  💬 سلام دوستان
                </button>
                <button
                  onClick={() => handleSendMessage(undefined, "من کلی چت می‌کنم تا درجه‌ام بره بالا!")}
                  className="bg-slate-900 hover:bg-slate-800/80 text-[11px] text-slate-300 py-2 px-2.5 rounded-lg border border-slate-800 transition-all text-right truncate cursor-pointer"
                >
                  ✉️ ارسال پیام عادی (+۱ امتیاز)
                </button>
                <button
                  onClick={() => handleSendMessage(undefined, "/رتبه")}
                  className="bg-slate-900 hover:bg-slate-800/80 text-[11px] font-mono text-amber-400 py-2 px-2.5 rounded-lg border border-slate-800 transition-all text-right truncate cursor-pointer"
                >
                  🎖️ /رتبه (مقام شخصی)
                </button>
                <button
                  onClick={() => handleSendMessage(undefined, "/چارت")}
                  className="bg-slate-900 hover:bg-slate-800/80 text-[11px] font-mono text-amber-400 py-2 px-2.5 rounded-lg border border-slate-800 transition-all text-right truncate cursor-pointer"
                >
                  🏆 /چارت (رده‌بندی گروه)
                </button>
                <button
                  onClick={() => handleSendMessage(undefined, "/لیست_رتبه_ها")}
                  className="bg-slate-900 hover:bg-slate-800/80 text-[11px] font-mono text-sky-400 py-2 px-2.5 rounded-lg border border-slate-800 transition-all text-right truncate cursor-pointer"
                >
                  📜 /لیست_رتبه_ها
                </button>
                <button
                  onClick={() => {
                    const o = users.find(u => u.is_owner);
                    if (o) {
                      setSelectedUserId(o.user_id);
                      handleSendMessage(undefined, "/addrank سپهبد جدید | 🎗️ | 200");
                    }
                  }}
                  className="bg-slate-900 hover:bg-slate-800/80 text-[11px] text-rose-400 py-2 px-2.5 rounded-lg border border-slate-800 transition-all text-right truncate cursor-pointer"
                  title="ایجاد رتبه جدید توسط مالک"
                >
                  ➕ /addrank (افزودن رتبه)
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Console Log DB */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 font-mono text-xs">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-slate-300 font-bold flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-400" />
              کنسول تراکنش‌های دیتابیس Cloudflare D1
            </h4>
            <button
              onClick={onClearLogs}
              className="text-[10px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
            >
              پاکسازی
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl p-3 max-h-[220px] overflow-y-auto space-y-2 text-left" dir="ltr">
            {sqlLogs.length === 0 ? (
              <span className="text-slate-600 block text-center py-4">در انتظار تراکنش جدید...</span>
            ) : (
              sqlLogs.map(log => (
                <div key={log.id} className="border-b border-slate-800/50 pb-1.5 last:border-b-0">
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className={`font-bold ${
                      log.type === 'select' ? 'text-blue-400' :
                      log.type === 'update' ? 'text-yellow-500' :
                      log.type === 'insert' ? 'text-emerald-400' : 'text-purple-400'
                    }`}>
                      [{log.type.toUpperCase()}]
                    </span>
                    <span className="text-slate-500">{log.timestamp}</span>
                  </div>
                  <div className="text-slate-300 break-words font-mono text-[11px] whitespace-pre-wrap">{log.query}</div>
                  {log.params && <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Params: {log.params}</div>}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* RIGHT: Mock Telegram Chat UI */}
      <div className="xl:col-span-7">
        <div className="bg-slate-900 rounded-2xl border border-slate-700/60 overflow-hidden shadow-2xl flex flex-col h-[640px]">
          
          {/* Header */}
          <div className="bg-slate-800/90 border-b border-slate-700/40 p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center font-bold text-slate-900">
                گ‌م
              </div>
              <div>
                <h4 className="font-bold text-slate-100 text-sm">گروه هم‌رزمان نظامی (شبیه‌ساز)</h4>
                <p className="text-xs text-emerald-400">ربات رتبه‌بندی در چت فعال است</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs bg-slate-950/60 text-slate-400 py-1.5 px-3 rounded-lg border border-slate-800">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              <span>۵ عضو فرضی</span>
            </div>
          </div>

          {/* Messages Board */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0f172a] pattern-slate bg-cover bg-center">
            
            {messages.map((m) => {
              const isSenderMe = m.user_id === selectedUserId;
              const isBot = m.is_bot;

              return (
                <div key={m.id} className={`flex flex-col ${isBot ? 'items-center' : 'items-start'}`}>
                  
                  {/* Replied to message indicator */}
                  {m.reply_to_message_id && (
                    <div className="text-[10px] text-slate-500 bg-slate-950/30 px-3 py-1 rounded-t-lg ml-6 border-l-2 border-amber-500/50">
                      پاسخ به پیام قبلی
                    </div>
                  )}

                  <div className={`max-w-[85%] rounded-2xl p-3 relative ${
                    isBot 
                      ? 'bg-slate-800/90 border border-slate-700/50 text-slate-200 text-xs w-[90%] my-1' 
                      : 'bg-slate-900/95 border border-slate-800 text-slate-200'
                  }`}>
                    
                    {/* Header info for sender */}
                    {!isBot && (
                      <div className="flex items-center justify-between gap-4 mb-1 pb-1 border-b border-slate-800/40">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-amber-400">{m.first_name}</span>
                          {m.username && <span className="text-[10px] text-slate-500 font-mono">@{m.username}</span>}
                        </div>
                        
                        {/* Member Tag (Simulating setChatMemberTag) */}
                        {m.tag && (
                          <span className="text-[10px] font-bold bg-slate-950 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded">
                            {m.tag}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Content Text */}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: m.text }} />

                    {/* Inline Buttons (for choice levels) */}
                    {m.inline_buttons && (
                      <div className="mt-3 flex flex-wrap gap-2 justify-center">
                        {m.inline_buttons.map((btn, bIdx) => {
                          const parts = btn.callback_data.split('_'); // ["select", "rank", "rankId", "minMsgs", "userId"]
                          const rId = parseInt(parts[2]);
                          const minM = parseInt(parts[3]);
                          const uId = parseInt(parts[4]);

                          return (
                            <button
                              key={bIdx}
                              onClick={() => handleCallbackClick(rId, minM, uId)}
                              className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition-all cursor-pointer"
                            >
                              {btn.text}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Footer - timestamp */}
                    <div className="flex justify-between items-center text-[9px] text-slate-500 mt-2">
                      <span>{new Date(m.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
                      
                      {/* Action buttons (Reply as Admin / Normal reply) */}
                      {!isBot && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setReplyToMsg(m)}
                            className="text-[10px] text-amber-500/70 hover:text-amber-400 hover:underline cursor-pointer"
                          >
                            ریپلای و پاسخ
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Reply bar if any */}
          {replyToMsg && (
            <div className="bg-slate-950 border-t border-slate-800 p-2 flex justify-between items-center text-xs">
              <span className="text-slate-400">
                در حال پاسخ به پیام <strong>{replyToMsg.first_name}</strong>: "{replyToMsg.text.substring(0, 30)}..."
              </span>
              <button
                onClick={() => setReplyToMsg(null)}
                className="text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
              >
                انصراف
              </button>
            </div>
          )}

          {/* Typing Area */}
          <form onSubmit={handleSendMessage} className="bg-slate-800 border-t border-slate-700/60 p-4 flex gap-3 items-center">
            
            {/* Quick Admin Action dropdown if replying */}
            {replyToMsg && users.find(u => u.user_id === selectedUserId)?.is_owner && (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    promoteRankSim(replyToMsg.user_id, 'admin-promote');
                    setReplyToMsg(null);
                  }}
                  className="bg-sky-500 hover:bg-sky-600 text-slate-950 text-[10px] font-bold px-2 py-1.5 rounded-lg shrink-0 transition-colors cursor-pointer"
                  title="ارتقای رتبه کاربر ریپلای شده یک مرحله"
                >
                  ⭐ ارتقاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addPointsSim(replyToMsg.user_id, 100, "دادن صد امتیاز", 'admin-pts');
                    setReplyToMsg(null);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[10px] font-bold px-2 py-1.5 rounded-lg shrink-0 transition-colors cursor-pointer"
                  title="دادن ۱۰۰ امتیاز امتیاز"
                >
                  +100
                </button>
              </div>
            )}

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={replyToMsg ? "پاسخ ادمین (مثال: ارتقاء مقام یا دادن صد امتیاز)..." : "پیام خود را تایپ کنید..."}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-amber-500 transition-colors text-right"
            />
            
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 p-3 rounded-xl transition-all cursor-pointer shrink-0"
            >
              <Send className="w-5 h-5 shrink-0 transform -rotate-180" />
            </button>
          </form>

        </div>
      </div>

    </div>
  );
}
