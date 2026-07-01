import React, { useState } from 'react';
import { generateWorkerCode, generateSqlSchema } from '../utils/codeGenerator';
import { Rank } from '../types';
import { Copy, Check, FileCode, Database, Terminal, Shield } from 'lucide-react';

interface CodeViewerProps {
  ranks: Rank[];
}

export default function CodeViewer({ ranks }: CodeViewerProps) {
  const [activeTab, setActiveTab] = useState<'worker' | 'sql'>('worker');
  const [copied, setCopied] = useState(false);

  const workerCode = generateWorkerCode(ranks);
  const sqlSchema = generateSqlSchema(ranks);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#1e293b]/90 backdrop-blur-md rounded-2xl border border-slate-700/60 overflow-hidden text-right" dir="rtl" id="code-viewer-container">
      
      {/* Tabs Header */}
      <div className="bg-slate-800/80 p-4 border-b border-slate-700/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('worker'); setCopied(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'worker'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
            }`}
          >
            <FileCode className="w-4 h-4" />
            کد کامل Worker (index.js)
          </button>
          
          <button
            onClick={() => { setActiveTab('sql'); setCopied(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'sql'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/40'
            }`}
          >
            <Database className="w-4 h-4" />
            اسکیمای دیتابیس D1 (schema.sql)
          </button>
        </div>

        <button
          onClick={() => handleCopy(activeTab === 'worker' ? workerCode : sqlSchema)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-slate-950 text-slate-200 border border-slate-800 hover:bg-slate-900 transition-all cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              کپی شد! ✅
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-amber-500" />
              کپی کردن کل کدها
            </>
          )}
        </button>
      </div>

      {/* Code Area */}
      <div className="relative">
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded px-2.5 py-1 text-[10px] text-slate-400 font-mono" dir="ltr">
          <Terminal className="w-3.5 h-3.5 text-amber-500" />
          <span>{activeTab === 'worker' ? 'index.js' : 'schema.sql'}</span>
        </div>

        <div className="bg-slate-950 p-6 overflow-x-auto max-h-[500px] text-left" dir="ltr">
          <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre select-all">
            {activeTab === 'worker' ? workerCode : sqlSchema}
          </pre>
        </div>
      </div>

      {/* Notice / Features Footer */}
      <div className="bg-slate-900/40 p-4 border-t border-slate-800 text-slate-400 text-xs flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            {activeTab === 'worker' 
              ? 'این کد شامل ضداسپم، هندلر کلیک دکمه‌های شیشه‌ای، و دستورات ادمین ریپلای است.'
              : 'اسکیما شامل جداول تنظیمات، لیست درجات، و آمار کاربران است که در D1 ماندگار می‌ماند.'}
          </span>
        </div>
        <span className="text-[10px] text-slate-500">کاملاً بهینه‌سازی شده بدون وابستگی خارجی (No Wrangler)</span>
      </div>

    </div>
  );
}
