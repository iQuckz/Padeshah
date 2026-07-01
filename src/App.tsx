import React, { useState } from 'react';
import { defaultRanks } from './data/defaultRanks';
import { Rank, SqlLog } from './types';
import RankManager from './components/RankManager';
import ChatSimulator from './components/ChatSimulator';
import CodeViewer from './components/CodeViewer';
import DeploymentGuide from './components/DeploymentGuide';
import { MessageSquare, Settings, Code, Compass, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'ranks' | 'code' | 'guide'>('simulator');
  const [ranks, setRanks] = useState<Rank[]>(defaultRanks);
  const [sqlLogs, setSqlLogs] = useState<SqlLog[]>([]);

  const handleRanksChange = (newRanks: Rank[]) => {
    setRanks(newRanks);
    // Log schema changes
    const log: SqlLog = {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      query: `-- آپدیت ساختار یا مقادیر رتبه‌ها در حافظه زنده شبیه‌ساز\n-- تعداد رتبه‌های فعال: ${newRanks.length}`,
      type: 'schema'
    };
    setSqlLogs(prev => [log, ...prev]);
  };

  const handleResetRanks = () => {
    setRanks(defaultRanks);
    const log: SqlLog = {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      query: `-- ریست کردن درجات نظامی به مقادیر پیش‌فرض`,
      type: 'schema'
    };
    setSqlLogs(prev => [log, ...prev]);
  };

  const handleSqlLog = (log: SqlLog) => {
    setSqlLogs(prev => [log, ...prev]);
  };

  const handleClearLogs = () => {
    setSqlLogs([]);
  };

  const handleGoToTab = (tab: 'simulator' | 'code' | 'ranks') => {
    setActiveTab(tab === 'simulator' ? 'simulator' : tab === 'code' ? 'code' : 'ranks');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Decorative Top Accent Grid */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-amber-500/10 via-transparent to-transparent pointer-events-none" />

      {/* Main Header / Navigation */}
      <header className="relative border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center font-bold text-slate-950 text-lg shadow-lg shadow-amber-500/10">
              🎖️
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
                ربات رتبه‌بندی تلگرام
                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">کلودفلر و D1</span>
              </h1>
              <p className="text-[11px] text-slate-400">سازنده هوشمند و شبیه‌ساز زنده سیستم‌های نظامی و اداری تلگرام</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 p-1 bg-slate-900/60 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              شبیه‌ساز چت و ربات
            </button>

            <button
              onClick={() => setActiveTab('ranks')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ranks'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              سفارشی‌سازی رتبه‌ها
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'code'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              <Code className="w-4 h-4 shrink-0" />
              کدهای کامل پروژه
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'guide'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              <Compass className="w-4 h-4 shrink-0" />
              راهنمای دیپلوی ابری
            </button>
          </nav>

        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        
        {/* Intro Announcement card */}
        <section className="mb-8 bg-gradient-to-r from-slate-900 to-slate-950 rounded-2xl border border-slate-800 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex gap-3.5 items-start">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-1" />
            <div>
              <h3 className="text-sm font-bold text-slate-200">کسب رتبه‌های نظامی با چت گروهی تلگرام</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                این پلتفرم به شما اجازه می‌دهد رتبه‌های تلگرامی (به صورت تگ کنار نام کاربران بدون نیاز به ادمین کردن آنها با متد رسمی <code>setChatMemberTag</code>) را به صورت کاملاً زنده شبیه‌سازی کنید، درجات فرضی بسازید و کدهای آماده را مستقیم در پنل رایگان Cloudflare Workers کپی کنید.
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('guide')}
              className="text-xs font-bold text-slate-200 bg-slate-900 px-3.5 py-2 rounded-lg border border-slate-800 hover:bg-slate-850 transition-all cursor-pointer shrink-0"
            >
              راهنمای سریع دیپلوی
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className="text-xs font-bold text-amber-500 bg-amber-500/10 px-3.5 py-2 rounded-lg border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer shrink-0"
            >
              کدهای آماده نهایی
            </button>
          </div>
        </section>

        {/* Tab switcher view */}
        <div className="transition-all duration-300">
          {activeTab === 'simulator' && (
            <ChatSimulator
              ranks={ranks}
              onSqlLog={handleSqlLog}
              sqlLogs={sqlLogs}
              onClearLogs={handleClearLogs}
            />
          )}

          {activeTab === 'ranks' && (
            <RankManager
              ranks={ranks}
              onRanksChange={handleRanksChange}
              onReset={handleResetRanks}
            />
          )}

          {activeTab === 'code' && (
            <CodeViewer
              ranks={ranks}
            />
          )}

          {activeTab === 'guide' && (
            <DeploymentGuide
              onGoToTab={handleGoToTab}
            />
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span>شبیه‌ساز و سازنده سیستم رتبه‌بندی تلگرامی • طراحی شده با استانداردهای مدرن تلگرام Bot API</span>
          <div className="flex gap-3 text-[10px]">
            <span>بدون وابستگی خارجی</span>
            <span>•</span>
            <span>طراحی متد اختصاصی setChatMemberTag</span>
            <span>•</span>
            <span>Cloudflare workers & D1 database</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
