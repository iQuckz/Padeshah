import React, { useState } from 'react';
import { Rank } from '../types';
import { Plus, Trash2, RotateCcw, AlertCircle, Sparkles, HelpCircle, Edit2, Check, X } from 'lucide-react';

interface RankManagerProps {
  ranks: Rank[];
  onRanksChange: (ranks: Rank[]) => void;
  onReset: () => void;
}

export default function RankManager({ ranks, onRanksChange, onReset }: RankManagerProps) {
  // Form states for adding new rank
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎖️');
  const [minMessages, setMinMessages] = useState('');
  const [choiceKey, setChoiceKey] = useState('');
  const [error, setError] = useState('');

  // States for inline editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editMinMessages, setEditMinMessages] = useState('');
  const [editChoiceKey, setEditChoiceKey] = useState('');

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
      sort_order: msgs * 10,
      group_choice_key: choiceKey.trim() || undefined
    };

    const updatedRanks = [...ranks, newRank].sort((a, b) => a.min_messages - b.min_messages || a.sort_order - b.sort_order);
    onRanksChange(updatedRanks);

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
    if (editingId === id) {
      setEditingId(null);
    }
  };

  const startEditing = (rank: Rank) => {
    setEditingId(rank.id);
    setEditTitle(rank.title);
    setEditEmoji(rank.emoji);
    setEditMinMessages(rank.min_messages.toString());
    setEditChoiceKey(rank.group_choice_key || '');
    setError('');
  };

  const handleSaveEdit = (id: number) => {
    setError('');

    if (!editTitle.trim()) {
      setError('عنوان رتبه در حالت ویرایش نمی‌تواند خالی باشد.');
      return;
    }

    const msgs = parseInt(editMinMessages);
    if (isNaN(msgs) || msgs < 0) {
      setError('تعداد پیام ویرایش شده باید عدد بزرگتر یا مساوی صفر باشد.');
      return;
    }

    const updated = ranks.map(r => {
      if (r.id === id) {
        return {
          ...r,
          title: editTitle.trim(),
          emoji: editEmoji,
          min_messages: msgs,
          sort_order: msgs * 10,
          group_choice_key: editChoiceKey.trim() || undefined
        };
      }
      return r;
    }).sort((a, b) => a.min_messages - b.min_messages || a.sort_order - b.sort_order);

    onRanksChange(updated);
    setEditingId(null);
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-6 md:p-8 text-right space-y-8 shadow-xl shadow-slate-950/20" dir="rtl" id="rank-manager-container">
      
      {/* Top Title & Reset Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <span className="text-amber-500 animate-pulse text-2xl">🎖️</span>
            مدیریت و پیکربندی درجات نظامی
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            در این بخش می‌توانید نام درجات، آستانه تعداد پیام مورد نیاز، ایموجی‌ها و رتبه‌های انتخابی هم‌سطح را آزادانه و به طور کامل تغییر دهید. کدهای خروجی و رفتار ربات بلافاصله همگام‌سازی خواهند شد.
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          ریست به درجات پیش‌فرض اولیه
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Create/Add Rank Form */}
        <div className="lg:col-span-4 bg-slate-950/50 p-6 rounded-2xl border border-slate-800/80 shadow-inner flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-200 mb-5 flex items-center gap-2 pb-3 border-b border-slate-800/60">
              <Plus className="w-4 h-4 text-emerald-400" />
              افزودن رتبه نظامی جدید
            </h3>

            <form onSubmit={handleAddRank} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">عنوان رتبه جدید</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: سرجوخه، سرلشکر، ستوان اول"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all text-right placeholder-slate-600"
                  maxLength={16}
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">حداقل پیام لازم</label>
                  <input
                    type="number"
                    value={minMessages}
                    onChange={(e) => setMinMessages(e.target.value)}
                    placeholder="مثال: 120"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all text-left placeholder-slate-600"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">گروه انتخابی (اختیاری)</label>
                  <input
                    type="text"
                    value={choiceKey}
                    onChange={(e) => setChoiceKey(e.target.value)}
                    placeholder="مثال: high1"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all text-left placeholder-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">انتخاب ایموجی رتبه</label>
                <div className="grid grid-cols-6 gap-1 p-2 bg-slate-900 rounded-xl border border-slate-800">
                  {emojiOptions.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`h-9 rounded-lg flex items-center justify-center text-lg hover:bg-slate-800 active:scale-90 transition-all cursor-pointer ${
                        emoji === e ? 'bg-amber-500/20 border border-amber-500 scale-105' : 'border border-transparent'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-98 text-slate-950 font-black py-3 rounded-xl text-xs transition-all shadow-md shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 shrink-0 stroke-[3]" />
                افزودن به هرم مقامات نظامی
              </button>
            </form>
          </div>

          <div className="mt-6 bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-2.5 text-[11px] text-slate-400 leading-relaxed">
            <div className="flex gap-2 items-start">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p>
                <strong>رتبه‌های هم‌سطح انتخابی:</strong> اگر مایلید پس از آستانه مشخصی، کاربر خودش انتخاب کند چه رتبه‌ای داشته باشد (مثلاً کماندو یا تک‌تیرانداز)، هر دو رتبه را با یک حداقل پیام یکسان بسازید و مقدار <u>گروه انتخابی</u> یکسان (مثلاً <code>special-ops</code>) قرار دهید.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Ranks Table & Interactive Inline Editors */}
        <div className="lg:col-span-8 bg-slate-950/20 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-bold text-xs flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-500" />
              لیست کل درجات تعریف شده (به ترتیب آستانه صعودی)
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-lg border border-slate-700 font-mono font-bold">
              تعداد مقامات: {ranks.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 text-[11px] font-bold">
                  <th className="py-3 px-4 w-16 text-center">ایموجی</th>
                  <th className="py-3 px-4">عنوان درجه نظامی</th>
                  <th className="py-3 px-4 text-left">حداقل پیام لازم</th>
                  <th className="py-3 px-4 text-center">گروه انتخابی</th>
                  <th className="py-3 px-4 text-center w-28">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {ranks.map((rank, idx) => {
                  const isEditing = editingId === rank.id;
                  const hasChoice = rank.group_choice_key;

                  return (
                    <tr 
                      key={rank.id} 
                      className={`transition-colors ${
                        isEditing 
                          ? 'bg-amber-500/5 hover:bg-amber-500/10' 
                          : 'hover:bg-slate-800/30'
                      }`}
                    >
                      {/* Emoji Column */}
                      <td className="py-3 px-3 text-center">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editEmoji}
                            onChange={(e) => setEditEmoji(e.target.value)}
                            className="w-12 h-8 bg-slate-900 border border-amber-500/50 rounded-lg text-center text-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                            title="یک ایموجی کپی کرده و اینجا قرار دهید"
                          />
                        ) : (
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 text-xl border border-slate-800/80 shadow-sm">
                            {rank.emoji}
                          </span>
                        )}
                      </td>

                      {/* Title Column */}
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full max-w-[180px] bg-slate-900 border border-amber-500/50 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                            maxLength={16}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-100">{rank.title}</span>
                            {idx === 0 && (
                              <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded-md">
                                رتبه شروع
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Minimum Messages Column */}
                      <td className="py-3 px-4 text-left font-mono text-slate-300">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editMinMessages}
                            onChange={(e) => setEditMinMessages(e.target.value)}
                            className="w-20 bg-slate-900 border border-amber-500/50 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono text-left focus:outline-none focus:ring-1 focus:ring-amber-500"
                            min="0"
                          />
                        ) : (
                          <span className="text-slate-100 font-bold">{rank.min_messages.toLocaleString()}</span>
                        )}
                      </td>

                      {/* Choice Key Column */}
                      <td className="py-3 px-4 text-center">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editChoiceKey}
                            onChange={(e) => setEditChoiceKey(e.target.value)}
                            placeholder="بدون گروه"
                            className="w-24 bg-slate-900 border border-amber-500/50 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono text-center focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-700"
                          />
                        ) : hasChoice ? (
                          <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-md font-mono font-bold">
                            {rank.group_choice_key}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">-</span>
                        )}
                      </td>

                      {/* Operations Column */}
                      <td className="py-3 px-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleSaveEdit(rank.id)}
                              className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 active:scale-90 transition-all cursor-pointer"
                              title="ذخیره ویرایش"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 active:scale-90 transition-all cursor-pointer"
                              title="انصراف"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => startEditing(rank)}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-amber-500/15 text-slate-400 hover:text-amber-400 border border-slate-800 hover:border-amber-500/30 transition-all cursor-pointer"
                              title="ویرایش درجه نظامی"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRank(rank.id)}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 transition-all cursor-pointer"
                              title="حذف درجه نظامی"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 justify-end">
            <span className="text-amber-400 font-bold">💡 نکته کاربردی:</span>
            <span>با کلیک روی دکمه مداد 📝 هر رتبه را ویرایش کنید و با ذخیره آن، بلافاصله کدهای Worker را آپدیت کنید.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
