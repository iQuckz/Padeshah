import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Bot, Database, Globe, Key, Settings, Sparkles, CheckCircle2 } from 'lucide-react';

interface DeploymentGuideProps {
  onGoToTab: (tab: 'simulator' | 'code' | 'ranks') => void;
}

export default function DeploymentGuide({ onGoToTab }: DeploymentGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [botToken, setBotToken] = useState('');
  const [workerUrl, setWorkerUrl] = useState('');

  const webhookUrl = botToken && workerUrl 
    ? `https://api.telegram.org/bot${botToken.trim()}/setWebhook?url=${encodeURIComponent(workerUrl.trim())}` 
    : '';

  const steps = [
    {
      title: 'ساخت ربات تلگرام',
      icon: <Bot className="w-5 h-5 text-amber-400" />,
      description: 'ایجاد ربات و دریافت توکن از BotFather',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            ۱. وارد تلگرام شده و ربات رسمی <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-amber-400 underline hover:text-amber-300">@BotFather</a> را استارت کنید.
            <br />
            ۲. دستور <code>/newbot</code> را بفرستید، یک نام و سپس یک آیدی انگلیسی منحصر‌به‌فرد (که آخرش کلمه bot باشد) وارد کنید.
            <br />
            ۳. توکن ارائه‌شده (موسوم به <b>HTTP API Token</b>) را کپی کنید.
          </p>
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <h5 className="text-xs font-bold text-slate-400">توکن خود را برای تنظیم وب‌هوک در مراحل بعدی اینجا بنویسید (اختیاری):</h5>
            <input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-mono text-left"
              dir="ltr"
            />
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs text-amber-400">
            <strong>⚠️ نکته طلایی مقتدرانه:</strong>
            <p className="mt-1 leading-relaxed">
              پس از ساخت ربات، آن را به گروه تلگرامی خود اضافه کرده و ارتقا به <b>ادمین (Administrator)</b> دهید.
              حتماً دسترسی <b>مدیریت تگ‌ها (Manage Tags)</b> یا در صورت نبود گزینه مجزا، تمام دسترسی‌ها را به ربات بدهید تا متد <code>setChatMemberTag</code> با خطای عدم دسترسی مواجه نشود.
            </p>
          </div>
        </div>
      )
    },
    {
      title: 'ایجاد دیتابیس D1',
      icon: <Database className="w-5 h-5 text-sky-400" />,
      description: 'ساخت دیتابیس SQLite در پنل کلودفلر',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            ۱. وارد حساب کاربری کلودفلر خود شوید و به بخش <span className="text-amber-400">Workers & Pages &gt; D1</span> بروید.
            <br />
            ۲. روی دکمه <b>Create database</b> و سپس <b>Create D1 database</b> کلیک کنید.
            <br />
            ۳. یک نام برای دیتابیس انتخاب کنید (مثلاً: <code>telegram-rank-db</code>) و روی <b>Create</b> کلیک کنید.
          </p>
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <h5 className="text-xs font-bold text-slate-400">اجرای اسکیما و کدهای SQL:</h5>
            <p className="text-xs text-slate-400 leading-relaxed">
              پس از ساخت دیتابیس، روی نام دیتابیس خود کلیک کنید و به تب <b>Console</b> بروید.
              کد اسکیما را از تب <b>«کدهای کامل پروژه»</b> کپی کرده، در کادر کنسول پیست کنید و دکمه <b>Execute</b> را بزنید تا جداول و رتبه‌ها مستقیماً نصب شوند.
            </p>
            <button
              onClick={() => onGoToTab('code')}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
            >
              کپی کردن کدهای SQL اسکیما ←
            </button>
          </div>
        </div>
      )
    },
    {
      title: 'ساخت Worker کلودفلر',
      icon: <Globe className="w-5 h-5 text-emerald-400" />,
      description: 'ایجاد سرویس ابری و قرار دادن کدها',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            ۱. در داشبورد کلودفلر به بخش <span className="text-amber-400">Workers & Pages</span> بروید و روی <b>Create Application</b> و سپس <b>Create Worker</b> کلیک کنید.
            <br />
            ۲. نام آن را وارد کرده و روی <b>Deploy</b> کلیک کنید.
            <br />
            ۳. سپس روی <b>Edit code</b> کلیک کنید تا ادیتور زنده وب (Quick Edit) باز شود.
            <br />
            ۴. تمام کدهای پیش‌فرض را حذف کرده و کدهای تب <b>«کدهای کامل پروژه» (فایل index.js)</b> را عیناً در آنجا کپی-پیست کنید.
            <br />
            ۵. در نهایت روی دکمه <b>Save and deploy</b> در بالای صفحه کلیک کنید.
          </p>
          <button
            onClick={() => onGoToTab('code')}
            className="inline-block bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
          >
            کپی کدهای جاوااسکریپت Worker ←
          </button>
        </div>
      )
    },
    {
      title: 'تنظیمات بایندینگ (Binding)',
      icon: <Settings className="w-5 h-5 text-purple-400" />,
      description: 'اتصال دیتابیس D1 به Worker',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            برای اینکه Worker به دیتابیس ساخته‌شده در مرحله دوم دسترسی پیدا کند، باید اتصال برقرار کنید:
          </p>
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300 leading-relaxed">
            ۱. به صفحه اصلی Worker ساخته شده در کلودفلر برگردید.
            <br />
            ۲. به تب <span className="text-amber-400">Settings</span> و سپس زیر‌بخش <span className="text-amber-400">Variables</span> بروید.
            <br />
            ۳. صفحه را به پایین اسکرول کنید تا بخش <b>D1 Database Bindings</b> را بیابید.
            <br />
            ۴. روی دکمه <b>Add binding</b> کلیک کنید.
            <br />
            ۵. کادر <b>Variable name</b> را دقیقاً برابر با کلمه بزرگ <code className="font-mono bg-slate-950 px-1 py-0.5 rounded text-rose-400 font-bold">DB</code> بنویسید (حساس به حروف بزرگ و کوچک).
            <br />
            ۶. کادر <b>D1 database</b> را روی دیتابیسی که ساخته بودید (مثلا <code>telegram-rank-db</code>) تنظیم کنید.
            <br />
            ۷. در پایان روی دکمه <b>Save</b> کلیک کنید.
          </div>
        </div>
      )
    },
    {
      title: 'متغیرهای محیطی',
      icon: <Key className="w-5 h-5 text-teal-400" />,
      description: 'تعریف توکن و آیدی گروه در پنل کلودفلر',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            در همان مسیر قبلی (در تب Settings &gt; Variables)، بخش <b>Environment Variables</b> را پیدا کنید و متغیرهای زیر را ثبت کنید:
          </p>
          <div className="overflow-x-auto bg-slate-950 p-3 rounded-lg border border-slate-800">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2">نام متغیر (Variable Name)</th>
                  <th className="pb-2">مقدار نمونه (Value)</th>
                  <th className="pb-2">توضیحات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-slate-300 font-mono">
                <tr>
                  <td className="py-2.5 font-bold text-amber-400">BOT_TOKEN</td>
                  <td className="py-2.5">1234567:AAFe...</td>
                  <td className="py-2.5 text-slate-400 font-sans">توکن دریافتی از BotFather</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-amber-400">OWNER_ID</td>
                  <td className="py-2.5">12345678</td>
                  <td className="py-2.5 text-slate-400 font-sans">آیدی تلگرام مالک گروه (شاهنشاه)</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-amber-400">CHAT_ID</td>
                  <td className="py-2.5">-100123456789</td>
                  <td className="py-2.5 text-slate-400 font-sans">آیدی گروه تلگرامی (حتما با منفی شروع می‌شود)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 italic">
            پس از وارد کردن این سه متغیر محیطی، روی دکمه <b>Deploy</b> یا <b>Save</b> کلیک کنید تا متغیرها فعال و ایمن شوند.
          </p>
        </div>
      )
    },
    {
      title: 'تنظیم وب‌هوک (Webhook)',
      icon: <Globe className="w-5 h-5 text-rose-400" />,
      description: 'فعال‌سازی نهایی برای دریافت اتوماتیک پیام‌ها',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            در مرحله آخر، باید به تلگرام اطلاع دهید که هر وقت پیامی در گروه ارسال شد، آن را به آدرس Worker شما هدایت کند (فرآیند ست کردن وب‌هوک):
          </p>
          
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <h5 className="text-xs font-bold text-slate-400">تولید آسان آدرس وب‌هوک تلگرام:</h5>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">آدرس Worker کلودفلر شما (دومین انتسابی):</label>
              <input
                type="text"
                value={workerUrl}
                onChange={(e) => setWorkerUrl(e.target.value)}
                placeholder="مثال: https://telegram-rank-bot-worker.yourdomain.workers.dev"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-mono text-left"
                dir="ltr"
              />
            </div>

            {webhookUrl && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="block text-[10px] text-emerald-400">لینک نهایی را در یک تب جدید مرورگر باز کنید:</span>
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[10px] font-mono break-all text-left text-slate-300" dir="ltr">
                  {webhookUrl}
                </div>
                <a
                  href={webhookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  باز کردن لینک و ست کردن وب‌هوک تلگرام
                </a>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  پس از کلیک، باید پاسخ <code>{"{ok: true, result: true, description: \"Webhook was set\"}"}</code> را دریافت کنید. تبریک می‌گوییم! ربات شما آماده به کار است.
                </p>
              </div>
            )}
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="bg-[#1e293b]/90 backdrop-blur-md rounded-2xl border border-slate-700/60 p-6 md:p-8 text-right" dir="rtl" id="deployment-guide-container">
      
      {/* Step Progress Visual */}
      <div className="flex justify-between items-center mb-8 overflow-x-auto pb-2 gap-4">
        {steps.map((s, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentStep(idx)}
            className="flex flex-col items-center gap-1.5 min-w-[100px] cursor-pointer group shrink-0"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
              idx === currentStep 
                ? 'bg-amber-500 border-amber-500 text-slate-950 scale-110 shadow-lg shadow-amber-500/20' 
                : idx < currentStep 
                ? 'bg-slate-950 border-emerald-500/50 text-emerald-400'
                : 'bg-slate-950 border-slate-800 text-slate-500 group-hover:border-slate-700'
            }`}>
              {idx < currentStep ? <CheckCircle2 className="w-4 h-4" /> : s.icon}
            </div>
            <span className={`text-[10px] font-bold transition-colors ${
              idx === currentStep ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'
            }`}>
              {s.title}
            </span>
          </button>
        ))}
      </div>

      {/* Steps Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left description */}
        <div className="lg:col-span-8 bg-slate-900/40 p-6 rounded-2xl border border-slate-800/80 min-h-[380px] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              {steps[currentStep].icon}
              <h3 className="text-lg font-bold text-slate-100">{steps[currentStep].title}</h3>
            </div>
            <span className="block text-xs text-slate-400 mb-6 border-b border-slate-800 pb-2">
              {steps[currentStep].description}
            </span>

            <div className="text-slate-300">
              {steps[currentStep].content}
            </div>
          </div>

          <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-850">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg transition-all cursor-pointer ${
                currentStep === 0 
                  ? 'text-slate-600 bg-slate-900/10 border border-transparent' 
                  : 'text-slate-300 bg-slate-900/60 border border-slate-800 hover:bg-slate-850'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
              مرحله قبلی
            </button>

            <span className="text-xs text-slate-500 font-semibold font-mono">
              گام {currentStep + 1} از {steps.length}
            </span>

            <button
              onClick={handleNext}
              disabled={currentStep === steps.length - 1}
              className={`flex items-center gap-1 text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer ${
                currentStep === steps.length - 1 
                  ? 'text-slate-600 bg-slate-900/10 border border-transparent' 
                  : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md'
              }`}
            >
              مرحله بعدی
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Info Box */}
        <div className="lg:col-span-4 bg-slate-950 p-5 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-4">
          <div className="flex gap-2 items-center text-amber-400 font-bold">
            <Sparkles className="w-4 h-4" />
            <span>چرا بدون Wrangler CLI؟</span>
          </div>
          <p className="leading-relaxed">
            پلن‌های رایگان کلودفلر و سیستم Quick Edit به شما اجازه می‌دهند بدون نیاز به نصب npm، نصب Node.js روی سیستم، یا درگیری با خطوط فرمان ترمینال، کدهای جاوااسکریپت خود را بنویسید و متصل به دیتابیس D1 مستقر کنید.
          </p>
          
          <div className="bg-rose-500/10 p-3.5 rounded-lg border border-rose-500/20 space-y-2 leading-relaxed">
            <strong className="text-rose-400 flex items-center gap-1">
              🚨 چرا ربات کار نمی‌کند؟ (رفع مشکل):
            </strong>
            <ul className="space-y-1.5 list-disc list-inside text-slate-300">
              <li>
                <span className="font-bold text-amber-400">تست در گروه (نه پیوی):</span> این ربات فقط پیام‌های گروه تعریف شده را پردازش می‌کند و پیام‌های شخصی (PV) را کاملاً نادیده می‌گیرد.
              </li>
              <li>
                <span className="font-bold text-amber-400">غیرفعال کردن Privacy Mode:</span> به طور پیش‌فرض ربات‌ها پیام‌های معمولی گروه را نمی‌بینند. حتماً به <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline">@BotFather</a> پیام داده و از بخش <code className="bg-slate-900 px-1 py-0.5 rounded text-rose-300 font-mono">Bot Settings &gt; Group Privacy</code> آن را <span className="text-rose-400 font-bold">Turn off</span> کنید.
              </li>
              <li>
                <span className="font-bold text-amber-400">ادمین کردن ربات:</span> مطمئن شوید ربات در گروه ادمین است و دسترسی مدیریت تگ‌ها را دارد.
              </li>
              <li>
                <span className="font-bold text-amber-400">فرمت شناسه CHAT_ID:</span> آیدی گروه‌ها در تلگرام حتماً باید منفی باشد و معمولاً با <code className="font-mono bg-slate-900 px-1 rounded text-emerald-400">-100</code> شروع می‌شود (مثال: <code className="font-mono bg-slate-900 px-1 rounded text-emerald-400">-100123456789</code>).
              </li>
            </ul>
          </div>

          <div className="bg-slate-900/40 p-3.5 rounded-lg border border-slate-850 space-y-1 leading-relaxed">
            <strong className="text-slate-300">💡 نکات دیپلوی عالی:</strong>
            <p>
              دیتابیس D1 کلودفلر یک دیتابیس SQLite کاملاً مستقل از کد Worker شماست. بنابراین با هر بار بروزرسانی یا تغییر نسخه کدهای Worker شما در آینده، اطلاعات رتبه‌بندی، پیام‌ها و آمارهای اعضای گروه شما به هیچ وجه حذف نخواهند شد.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
