import React, { useState } from 'react';
import { Rank } from '../types';
import { Plus, Trash2, RotateCcw, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';

interface RankManagerProps {
  ranks: Rank[];
  onRanksChange: (ranks: Rank[]) => void;
  onReset: () => void;
}

export default function RankManager({ ranks, onRanksChange, onReset }: RankManagerProps) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎖️');
  const [minMessages, setMinMessages] = useState('');
  const [choiceKey, setChoiceKey] = useState('');
  const [error, setError] = useState('');

  const emojiOptions = [
    '🥉', '🥈', '🥇', '🎖️', '🎗️', '⚔️', '🛡️', '🫡', '👑', '🔱', '👮', '💂', '🧑‍🚀', '⚡', '🔥', '💎', '🌟', '💥'
  ];

  const handleAddRank = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('عنوان رتبه نمی‌تواند خالی باشد.');
      return;
    }

    const msgs = parseInt(minMessages);
    if (isNaN(msgs) || msgs < 0) {
      setError('تعداد پیام باید یک عدد بزرگتر یا مساوی صفر باشد.');
      return;
    }

    // Assign a unique ID
    const newId = ranks.length > 0 ? Math.max(...ranks.map(r => r.id)) + 1 : 1;
    const newRank: Rank = {
      id: newId,
      title: title.trim(),
      emoji,
      min_messages: msgs,
      sort_order: msgs * 10, // Default sort order based on message count
      group_choice_key: choiceKey.trim() || undefined
    };

    // Update state
    const updatedRanks = [...ranks, newRank].sort((a, b) => a.min_messages - b.min_messages || a.sort_order - b.sort_order);
    onRanksChange(updatedRanks);

    // Reset inputs
    setTitle('');
    setMinMessages('');
    setChoiceKey('');
  };

  const handleDeleteRank = (id: number) => {
    if (ranks.length <= 1) {
      setError('باید حداقل یک رتبه برای سیستم رتبه‌بندی وجود داشته باشد.');
      return;
    }
    const updated = ranks.filter(r => r.id !== id);
    onRanksChange(updated);
  };

  return (
    <div className="bg-[#1e293b]/90 backdrop-blur-md rounded-2xl border border-slate-700/60 p-6 md:p-8 text-right" dir="rtl" id="rank-manager-container">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-700/60">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <span className="text-amber-400">🎖️</span>
            مدیریت و پیکربندی درجات نظامی
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            درجات نظامی گروه را بر اساس پیام‌های لازم ویرایش یا رتبه‌های انتخابی هم‌سطح تعریف کنید.
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          ریست به درجات پیش‌فرض
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form to Add Rank */}
        <div className="lg:col-span-5 bg-slate-900/40 p-5 rounded-xl border border-slate-800/80">
          <h3 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            افزودن رتبه جدید
          </h3>

          <form onSubmit={handleAddRank} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">عنوان رتبه (مثلاً: سرجوخه)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: سرباز دوم یا سرلشکر"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                maxLength={16}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                توصیه: حداکثر ۱۶ کاراکتر (محدودیت تلگرام) و بدون ایموجی برای تگ‌ها.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">حداقل پیام لازم</label>
                <input
                  type="number"
                  value={minMessages}
                  onChange={(e) => setMinMessages(e.target.value)}
                  placeholder="مثلاً: 50"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-amber-500 transition-colors text-left"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">گروه انتخابی (اختیاری)</label>
                <input
                  type="text"
                  value={choiceKey}
                  onChange={(e) => setChoiceKey(e.target.value)}
                  placeholder="مثال: high1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-amber-500 transition-colors text-left font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">ایموجی رتبه</label>
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                {emojiOptions.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`w-8 h-8 rounded-md flex items-center justify-center text-lg hover:bg-slate-800 transition-all cursor-pointer ${
                      emoji === e ? 'bg-amber-500/25 border border-amber-500 scale-110' : 'border border-transparent'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 space-y-2 text-xs text-slate-400">
              <div className="flex gap-1.5 items-start">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  <strong>رتبه‌های هم‌سطح انتخابی:</strong> اگر چند رتبه با پیام یکسان و کلید گروه انتخابی مشابه (مثلاً <code>high1</code>) بسازید، ربات به صورت خودکار به کاربر اجازه می‌دهد رتبه دلخواه خود را با دکمه‌های اینلاین شیشه‌ای انتخاب کند!
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-semibold py-2 rounded-lg text-sm transition-colors cursor-pointer"
            >
              افزودن به هرم نظامی
            </button>
          </form>
        </div>

        {/* Display Ranks Hierarchy */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/20 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-300 text-xs mb-3">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <span>هرم مقامات بر اساس حداقل پیام‌های مورد نیاز از کم به زیاد مرتب شده است:</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold">
                    <th className="py-2.5 px-3">رتبه</th>
                    <th className="py-2.5 px-3">نام درجه</th>
                    <th className="py-2.5 px-3 text-left">حداقل پیام</th>
                    <th className="py-2.5 px-3 text-center">نوع ارتقا</th>
                    <th className="py-2.5 px-3 w-12 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {ranks.map((rank, idx) => {
                    const isChoice = rank.group_choice_key;
                    return (
                      <tr key={rank.id} className="hover:bg-slate-800/25 transition-colors">
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-950 text-xl border border-slate-800/80">
                            {rank.emoji}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-200">{rank.title}</span>
                          {isChoice && (
                            <span className="mr-1.5 text-[10px] bg-sky-500/15 text-sky-400 border border-sky-500/25 px-1.5 py-0.5 rounded">
                              گروه انتخابی: {rank.group_choice_key}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-left text-slate-300 font-mono">
                          {rank.min_messages.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {idx === 0 ? (
                            <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                              رتبه شروع
                            </span>
                          ) : isChoice ? (
                            <span className="text-[11px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full">
                              انتخابی اعضا
                            </span>
                          ) : (
                            <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                              خودکار مستقیم
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleDeleteRank(rank.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-all cursor-pointer"
                            title="حذف این رتبه"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
