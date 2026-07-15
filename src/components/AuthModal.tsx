import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';
import { KeyRound, User as UserIcon, ShieldAlert, Chrome, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  onLoginSuccess: (user: User) => void;
  isSupabaseActive: boolean;
}

export default function AuthModal({ onLoginSuccess, isSupabaseActive }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !pass || (isSignUp && (!name || !confirmPass))) {
      setErrorMsg('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    if (isSignUp && pass !== confirmPass) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (!isSupabaseActive) {
        throw new Error('Hệ thống chưa kết nối cơ sở dữ liệu Supabase. Vui lòng click "SETUP SQL TABLES" ở phía trên để hoàn tất cấu hình bảng dữ liệu trước.');
      }

      if (isSignUp) {
        // Check if user already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', id.trim())
          .single();

        if (existingUser) {
          setErrorMsg('ID người dùng đã tồn tại trên hệ thống!');
          setLoading(false);
          return;
        }

        // Create new user in users table
        const newUser: User = {
          id: id.trim().toLowerCase(),
          name: name.trim(),
          pass: pass,
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`
        };

        const { error } = await supabase.from('users').insert(newUser);

        if (error) {
          throw error;
        }

        setSuccessMsg('Đăng ký tài khoản thành công!');
        setTimeout(() => {
          onLoginSuccess(newUser);
        }, 1000);
      } else {
        // Standard login
        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', id.trim().toLowerCase())
          .single();

        if (error || !user) {
          setIsSignUp(true);
          setErrorMsg('Tài khoản chưa tồn tại. Hệ thống đã chuyển sang trang tạo mới, vui lòng điền đầy đủ thông tin.');
          setLoading(false);
          return;
        }

        if (user.pass !== pass) {
          setErrorMsg('Mật khẩu nhập chưa chính xác.');
          setLoading(false);
          return;
        }

        setSuccessMsg('Đăng nhập thành công!');
        setTimeout(() => {
          onLoginSuccess(user as User);
        }, 1000);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleOAuthLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (!isSupabaseActive) {
        throw new Error('Hệ thống chưa kết nối cơ sở dữ liệu Supabase.');
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Lỗi chuyển hướng đăng nhập Google.');
    }
  };

  return (
    <div className="bg-[#111113] rounded-xl border border-[#222224] shadow-xl overflow-hidden max-w-sm w-full mx-auto p-5 space-y-4 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="font-display font-bold text-lg text-white tracking-tight">
          {isSignUp ? 'Tạo tài khoản mới' : 'Đăng nhập hệ thống'}
        </h2>
        <p className="text-zinc-500 text-xs">
          {isSignUp 
            ? 'Đăng ký để gửi báo cáo lỗi và theo dõi trạng thái.' 
            : 'Sử dụng tài khoản báo lỗi để tiếp tục.'}
        </p>
      </div>

      {!isSupabaseActive && (
        <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 flex gap-2.5 text-red-300 text-xs items-center leading-relaxed animate-pulse">
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
          <span>
            <strong>Yêu cầu cơ sở dữ liệu:</strong> Vì lý do bảo mật, chế độ lưu trữ Offline đã bị vô hiệu hóa. Bạn cần chạy cấu hình bảng SQL trong mục "SETUP SQL TABLES" ở phía trên để có thể tạo tài khoản và báo cáo lỗi trực tiếp lên Supabase.
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-950/20 border border-red-900/30 text-red-300 text-xs p-3.5 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 text-xs p-3.5 rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono" htmlFor="id-input">
            ID Người Dùng (Viết liền, không dấu)
          </label>
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              id="id-input"
              type="text"
              placeholder="e.g. tungtran"
              value={id}
              onChange={(e) => setId(e.target.value.toLowerCase().replace(/\s+/g, ''))}
              className="w-full pl-10 pr-4 py-2.5 bg-[#161618] border border-[#222224] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors placeholder:text-zinc-600 text-white"
              required
            />
          </div>
        </div>

        {isSignUp && (
          <div className="space-y-1.5 animate-slide-down">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono" htmlFor="name-input">
              Họ và tên
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                id="name-input"
                type="text"
                placeholder="e.g. Tùng Trần"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#161618] border border-[#222224] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors placeholder:text-zinc-600 text-white"
                required={isSignUp}
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono" htmlFor="password-input">
            Mật khẩu
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              id="password-input"
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-[#161618] border border-[#222224] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors placeholder:text-zinc-600 text-white"
              required
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isSignUp && (
          <div className="space-y-1.5 animate-slide-down">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono" htmlFor="confirm-password-input">
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                id="confirm-password-input"
                type={showConfirmPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-[#161618] border border-[#222224] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 transition-colors placeholder:text-zinc-600 text-white"
                required={isSignUp}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-xl hover:bg-blue-500 cursor-pointer active:scale-[0.99] transition-all text-sm shadow-md shadow-blue-900/20 flex items-center justify-center mb-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            isSignUp ? 'Đăng ký tài khoản' : 'Đăng nhập'
          )}
        </button>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-[#222224]"></div>
          <span className="flex-shrink mx-4 text-zinc-600 text-xs font-mono">HOẶC</span>
          <div className="flex-grow border-t border-[#222224]"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleOAuthLogin}
          className="w-full flex items-center justify-center gap-2 border border-[#222224] bg-[#161618] hover:bg-[#1C1C1E] rounded-xl py-2.5 text-xs text-zinc-300 font-semibold cursor-pointer transition-all active:scale-[0.98]"
        >
          <Chrome className="w-4 h-4 text-red-500 shrink-0" />
          <span>Tiếp tục với Google</span>
        </button>
      </form>

      <div className="text-center pt-2">
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setErrorMsg('');
            setSuccessMsg('');
            setConfirmPass('');
          }}
          className="text-xs text-zinc-400 hover:text-white transition-all font-medium cursor-pointer"
        >
          {isSignUp ? 'Đã có tài khoản? Đăng nhập ngay' : 'Chưa có tài khoản? Tạo tài khoản báo lỗi mới'}
        </button>
      </div>
    </div>
  );
}
