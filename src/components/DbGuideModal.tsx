import React, { useState } from 'react';
import { Database, Copy, Check, Terminal, ExternalLink, AlertTriangle } from 'lucide-react';

interface DbGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  supabaseUrl: string;
}

export default function DbGuideModal({ isOpen, onClose, supabaseUrl }: DbGuideModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sqlCode = `-- 1. Tạo bảng "users" lưu trữ thông tin người dùng báo lỗi
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pass TEXT NOT NULL,
  google_email TEXT,
  avatar_url TEXT,
  session_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm trường session_token phòng trường hợp bảng users đã tồn tại
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT;

-- 2. Tạo bảng "bugs" lưu trữ thông tin lỗi đã báo
CREATE TABLE IF NOT EXISTS bugs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  image TEXT[] DEFAULT '{}',
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE
);

-- Vô hiệu hóa bảo mật RLS để cho phép ứng dụng client-side dễ dàng CRUD
-- (Thích hợp cho môi trường phát triển & thử nghiệm nhanh)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE bugs DISABLE ROW LEVEL SECURITY;
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-[#111113] rounded-2xl max-w-2xl w-full border border-[#222224] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-[#222224] flex items-center justify-between bg-[#0D0D0F]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#161618] text-blue-400 border border-[#222224] rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">
                Supabase Database Setup Guide
              </h3>
              <p className="text-xs text-zinc-500">
                Khởi tạo bảng trong Supabase SQL Editor để ứng dụng hoạt động đầy đủ
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 hover:bg-[#161618] rounded-md transition-colors text-sm font-semibold"
          >
            Đóng
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4 flex gap-3 text-amber-300 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold text-amber-200">Bắt buộc khởi tạo cơ sở dữ liệu</p>
              <p className="mt-1 text-amber-300/80 leading-relaxed text-xs">
                Vì đây là dự án Supabase thực tế mới của bạn, các bảng <code className="bg-amber-900/30 text-amber-200 px-1 rounded">users</code> và <code className="bg-amber-900/30 text-amber-200 px-1 rounded">bugs</code> chưa được tạo sẵn. Vui lòng copy đoạn mã SQL bên dưới và chạy trong trang quản trị của bạn.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-zinc-500" /> SQL Schema Code
              </span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 text-xs bg-[#161618] border border-[#222224] text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-[#1C1C1E] transition-colors cursor-pointer font-medium"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Đã sao chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Sao chép code SQL</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative group">
              <pre className="bg-[#0D0D0F] text-zinc-300 text-xs p-4 rounded-xl overflow-x-auto font-mono leading-relaxed select-all border border-[#222224] max-h-72">
                {sqlCode}
              </pre>
            </div>
          </div>

          <div className="border-t border-[#222224] pt-4 space-y-2">
            <h4 className="text-xs font-semibold text-zinc-300">Các bước thực hiện:</h4>
            <ol className="list-decimal list-inside text-xs text-zinc-400 space-y-1.5 pl-1 leading-relaxed">
              <li> Truy cập trang quản trị dự án Supabase của bạn.</li>
              <li> Click vào mục <span className="font-semibold text-zinc-200">SQL Editor</span> ở menu bên trái.</li>
              <li> Click <span className="font-semibold text-zinc-200">New Query</span>.</li>
              <li> Dán đoạn mã SQL đã sao chép ở trên vào ô nhập liệu.</li>
              <li> Nhấn nút <span className="font-semibold text-zinc-200">Run</span> (hoặc Ctrl + Enter / Cmd + Enter).</li>
              <li> Trở lại ứng dụng và F5 tải lại trang để trải nghiệm đầy đủ!</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0D0D0F] border-t border-[#222224] flex items-center justify-between">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
          >
            Mở Supabase Dashboard <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onClose}
            className="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors cursor-pointer font-semibold shadow-md shadow-blue-900/20"
          >
            Tôi đã chạy SQL / Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
