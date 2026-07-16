import React, { useState, useEffect } from 'react';
import { User as UserType, Bug, BugStatus } from '../types';
import { Calendar, User, CheckCircle, Clock, AlertCircle, Play, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';

interface BugCardProps {
  bug: Bug;
  onBugUpdate: (
    bugId: string,
    newStatus: BugStatus,
    newMetadata?: { resolved_hours?: number; recheck_reason?: string; priority?: 'Low' | 'Medium' | 'High' }
  ) => Promise<void>;
  currentUser: UserType | null;
}

const getAnnotationsForImage = (desc: string, imageIndex: number): string => {
  const targetHeader = `📌 Chú thích ảnh ${imageIndex + 1}:`;
  const lines = desc.split('\n');
  const resultLines: string[] = [];
  let found = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('📌 Chú thích ảnh ')) {
      if (line.startsWith(targetHeader)) {
        found = true;
      } else {
        found = false;
      }
      continue;
    }
    if (found) {
      if (line.startsWith('- ')) {
        resultLines.push(lines[i]);
      }
    }
  }
  return resultLines.join('\n');
};

const formatDuration = (hours: number): string => {
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} phút`;
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) {
    return `${h} giờ`;
  }
  return `${h} giờ ${m} phút`;
};

const parseDuration = (input: string): number | null => {
  const cleaned = input.trim().toLowerCase();
  if (!cleaned) return null;

  const minuteMatch = cleaned.match(/^([\d.]+)\s*(p|phút|phut|m|min|minute|minutes)$/);
  if (minuteMatch) {
    const val = parseFloat(minuteMatch[1]);
    return isNaN(val) ? null : val / 60;
  }

  const hourMatch = cleaned.match(/^([\d.]+)\s*(h|g|giờ|gio|hour|hours)$/);
  if (hourMatch) {
    const val = parseFloat(hourMatch[1]);
    return isNaN(val) ? null : val;
  }

  const rawVal = parseFloat(cleaned);
  if (isNaN(rawVal)) return null;
  return rawVal;
};

export const BugCard: React.FC<BugCardProps> = ({ bug, onBugUpdate, currentUser }) => {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Status transition wizard states
  const [pendingStatus, setPendingStatus] = useState<BugStatus | null>(null);
  const [showReporterAction, setShowReporterAction] = useState<boolean>(false);
  const [inputHours, setInputHours] = useState('');
  const [inputRecheckReason, setInputRecheckReason] = useState('');

  const currentUserId = currentUser?.id || '';
  const userRole = currentUser?.role || 'reporter';
  const isFixer = userRole === 'fixer';
  const isApprover = userRole === 'approver';

  // Determine allowed action based on role:
  // - fixer: Pending, In Progress, Recheck
  // - reporter/approver/owner: Resolved, Recheck
  const isOwner = bug.user_id === currentUserId;
  const isAllowedReporterOrApprover = (userRole === 'reporter' && isOwner) || userRole === 'approver';
  const canChangeStatus = 
    (isFixer && (bug.status === 'Pending' || bug.status === 'In Progress' || bug.status === 'Recheck')) ||
    (isAllowedReporterOrApprover && (bug.status === 'Resolved' || bug.status === 'Recheck'));

  useEffect(() => {
    if (showDetails || activeImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showDetails, activeImage]);

  // Keyboard navigation for Lightbox (Left/Right arrow to cycle images, Escape to close)
  useEffect(() => {
    if (!activeImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = bug.image.indexOf(activeImage);
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setActiveImage(bug.image[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && currentIndex < bug.image.length - 1) {
        setActiveImage(bug.image[currentIndex + 1]);
      } else if (e.key === 'Escape') {
        setActiveImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeImage, bug.image]);

  const getStatusStyle = (status: BugStatus) => {
    switch (status) {
      case 'Resolved':
        return {
          bg: 'bg-emerald-950/40 border-emerald-900/50 text-emerald-400',
          dot: 'bg-emerald-500',
          icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
          text: 'Hoàn tất'
        };
      case 'In Progress':
        return {
          bg: 'bg-blue-950/40 border-blue-900/50 text-blue-400',
          dot: 'bg-blue-500',
          icon: <Play className="w-3.5 h-3.5 text-blue-400" />,
          text: 'Đang xử lý'
        };
      case 'Recheck':
        return {
          bg: 'bg-rose-950/40 border-rose-900/50 text-rose-400',
          dot: 'bg-rose-500',
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />,
          text: 'Kiểm tra lại'
        };
      case 'Closed':
        return {
          bg: 'bg-zinc-950/40 border-zinc-800/50 text-zinc-400',
          dot: 'bg-zinc-650',
          icon: <X className="w-3.5 h-3.5 text-zinc-400" />,
          text: 'Đã đóng'
        };
      case 'Cancelled':
        return {
          bg: 'bg-red-950/25 border-red-900/30 text-red-400',
          dot: 'bg-red-500',
          icon: <X className="w-3.5 h-3.5 text-red-450" />,
          text: 'Đã hủy'
        };
      case 'Rejected':
        return {
          bg: 'bg-red-950/25 border-red-900/30 text-red-400',
          dot: 'bg-red-500',
          icon: <X className="w-3.5 h-3.5 text-red-450" />,
          text: 'Từ chối'
        };
      case 'Pending':
      default:
        return {
          bg: 'bg-amber-950/40 border-amber-900/50 text-amber-400',
          dot: 'bg-amber-500',
          icon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
          text: 'Chờ xử lý'
        };
    }
  };

  const statusInfo = getStatusStyle(bug.status);

  const handleStatusCycle = async () => {
    if (!canChangeStatus) return;

    // Reporter, Approver, or Owner action choice on Resolved or Recheck (Only when user is NOT fixer)
    if (!isFixer && isAllowedReporterOrApprover && (bug.status === 'Resolved' || bug.status === 'Recheck')) {
      setShowReporterAction(true);
      return;
    }

    let nextStatus: BugStatus = 'Pending';
    if (bug.status === 'Pending') nextStatus = 'In Progress';
    else if (bug.status === 'In Progress') nextStatus = 'Resolved';
    else if (bug.status === 'Recheck') nextStatus = 'In Progress';
    else return;

    // Check validation constraints
    if (nextStatus === 'Resolved') {
      // Must prompt fixer for hours
      setPendingStatus('Resolved');
      return;
    }

    // Direct transition for other states
    setIsUpdating(true);
    try {
      await onBugUpdate(bug.id, nextStatus);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const formattedDate = new Date(bug.timestamp).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const getGeneralDescription = (fullDesc: string): string => {
    const pinIndex = fullDesc.indexOf('📌');
    if (pinIndex === -1) {
      // Strips the metadata from the raw string for general description representation
      const metadataRegex = /\n\n\[Metadata: ({.*?})\]$/s;
      return fullDesc.replace(metadataRegex, '').trim();
    }
    return fullDesc.substring(0, pinIndex).trim();
  };

  const generalDescription = getGeneralDescription(bug.description);
  
  const cardPriority = bug.priority || 'Low';
  const getCardBorderClass = () => {
    if (cardPriority === 'High') return 'border-rose-950/60 hover:border-rose-800/80 shadow-md shadow-rose-950/5';
    if (cardPriority === 'Medium') return 'border-amber-950/60 hover:border-amber-700/80 shadow-md shadow-amber-950/5';
    return 'border-[#222224] hover:border-[#2C2C2E]';
  };

  return (
    <div className={`bg-[#111113] rounded-xl border p-3.5 shadow-xs transition-all duration-200 flex flex-col gap-3 relative group ${getCardBorderClass()}`}>
      
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            title="Xem chi tiết"
            className="font-mono text-[9px] text-blue-400 hover:text-blue-300 font-semibold tracking-wider bg-blue-950/20 hover:bg-blue-950/40 border border-blue-900/50 hover:border-blue-800/60 px-1.5 py-0.5 rounded-md cursor-pointer transition-all duration-200"
          >
            #{bug.id.substring(0, 8)}
          </button>

          {/* Priority selector or label (Default to Low / 1 Star) */}
          {isApprover ? (
            <select
              value={bug.priority || 'Low'}
              onChange={async (e) => {
                const newPriority = e.target.value as 'Low' | 'Medium' | 'High';
                setIsUpdating(true);
                try {
                  await onBugUpdate(bug.id, bug.status, { priority: newPriority });
                } finally {
                  setIsUpdating(false);
                }
              }}
              className={`border rounded-md text-[10px] font-bold focus:outline-hidden py-0.5 px-1.5 cursor-pointer transition-all duration-200 ${
                (bug.priority || 'Low') === 'High'
                  ? 'bg-rose-950/30 border-rose-800/60 text-rose-400'
                  : (bug.priority || 'Low') === 'Medium'
                  ? 'bg-amber-950/30 border-amber-700/60 text-amber-400'
                  : 'bg-[#161618] border-[#222224] text-zinc-400 hover:border-zinc-700'
              }`}
              title="Thiết lập độ ưu tiên"
            >
              <option value="Low" className="bg-[#111113] text-zinc-400">⭐</option>
              <option value="Medium" className="bg-[#111113] text-amber-400">⭐⭐</option>
              <option value="High" className="bg-[#111113] text-rose-450">⭐⭐⭐</option>
            </select>
          ) : (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${
              (bug.priority || 'Low') === 'High' 
                ? 'bg-rose-950/40 border-rose-900/50 text-rose-400' 
                : (bug.priority || 'Low') === 'Medium'
                ? 'bg-amber-950/40 border-amber-900/50 text-amber-400'
                : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400'
            }`}>
              {(bug.priority || 'Low') === 'High' ? '⭐⭐⭐' : (bug.priority || 'Low') === 'Medium' ? '⭐⭐' : '⭐'}
            </span>
          )}
        </div>
        
        {/* Status Badge & Selector */}
        <div className="flex items-center gap-1.5">
          {isFixer && bug.status === 'Pending' && (
            <button
              onClick={() => setPendingStatus('Rejected')}
              disabled={isUpdating}
              title="Từ chối sự cố"
              className="flex items-center gap-1 border border-red-900/50 bg-red-950/20 hover:bg-red-950/40 text-red-400 px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer active:scale-95 transition-all"
            >
              <X className="w-3 h-3 text-red-400" />
              <span>Từ chối</span>
            </button>
          )}
          {canChangeStatus ? (
            <button
              onClick={handleStatusCycle}
              disabled={isUpdating}
              title={isFixer ? "Click để đổi trạng thái" : "Yêu cầu kiểm tra lại"}
              className={`flex items-center gap-1 border px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer active:scale-95 hover:brightness-110 transition-all ${statusInfo.bg}`}
            >
              {isUpdating ? (
                <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin"></div>
              ) : (
                statusInfo.icon
              )}
              <span>{statusInfo.text}</span>
            </button>
          ) : (
            <div
              title="Chỉ Người xử lý (Fixer) mới có quyền đổi trạng thái này"
              className={`flex items-center gap-1 border px-2 py-0.5 rounded-full text-[11px] font-semibold opacity-70 ${statusInfo.bg}`}
            >
              {statusInfo.icon}
              <span>{statusInfo.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Description Preview (Only general description) */}
      <div className="max-h-24 overflow-y-auto pr-1 border border-transparent hover:border-[#222224] rounded-md transition-all">
        <p className="text-xs text-zinc-200 leading-relaxed font-sans font-medium break-words whitespace-pre-line">
          {generalDescription}
        </p>
      </div>

      {/* Images List (Visual Gallery limited to max 4 items with +X overlay) */}
      {bug.image && bug.image.length > 0 && (() => {
        const displayImages = bug.image.slice(0, 4);
        const hasMore = bug.image.length > 4;
        const moreCount = bug.image.length - 3;

        return (
          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            {displayImages.map((imgUrl, i) => {
              const isLast = i === 3 && hasMore;
              return (
                <div
                  key={i}
                  onClick={() => setActiveImage(imgUrl)}
                  className="relative aspect-square rounded-md overflow-hidden border border-[#222224] bg-[#161618] cursor-zoom-in hover:brightness-110 transition-all group/img"
                >
                  <img
                    src={imgUrl}
                    alt={`Bug attachment ${i + 1}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {isLast ? (
                    <div className="absolute inset-0 bg-[#070708]/75 flex flex-col items-center justify-center gap-0.5 backdrop-blur-xxs">
                      <span className="text-white text-xs font-bold">+{moreCount}</span>
                      <span className="text-[7px] text-zinc-400 font-mono tracking-wider uppercase">Xem thêm</span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Footer Info */}
      <div className="border-t border-[#222224] pt-2.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-500 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-zinc-300 font-medium flex-wrap">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3 text-zinc-500" />
              <span className="truncate max-w-[120px]">
                {bug.user_name || bug.user_id}
              </span>
              {bug.user_id === currentUserId && (
                <span className="bg-blue-600 text-white text-[7px] font-bold px-1 py-0.5 rounded-full scale-90">Tôi</span>
              )}
            </div>

            {/* Badges */}
            {bug.resolved_hours !== undefined && (
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                className="bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-900/30 hover:border-emerald-800/40 rounded-md px-1.5 py-0.5 text-[10px] text-emerald-450 flex items-center gap-1 cursor-pointer transition-all duration-200"
                title="Bấm để xem lịch sử & chi tiết số giờ sửa"
              >
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>Đã sửa: <strong>{formatDuration(bug.resolved_hours)}</strong></span>
              </button>
            )}
            {bug.recheck_reason && bug.status !== 'Closed' && bug.status !== 'Cancelled' && bug.status !== 'Rejected' && (
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                className={bug.status === 'Cancelled' || bug.status === 'Rejected'
                  ? "bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-800/40 rounded-md px-1.5 py-0.5 text-[10px] text-red-400 flex items-center gap-1 cursor-pointer transition-all duration-200"
                  : bug.status === 'Closed'
                  ? "bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800/50 hover:border-zinc-700/50 rounded-md px-1.5 py-0.5 text-[10px] text-zinc-450 flex items-center gap-1 cursor-pointer transition-all duration-200"
                  : "bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 hover:border-rose-800/40 rounded-md px-1.5 py-0.5 text-[10px] text-rose-450 flex items-center gap-1 cursor-pointer transition-all duration-200"
                }
                title={
                  bug.status === 'Cancelled' ? "Bấm để xem lý do hủy" :
                  bug.status === 'Rejected' ? "Bấm để xem lý do từ chối" :
                  bug.status === 'Closed' ? "Bấm để xem lý do đóng" :
                  "Bấm để xem lý do kiểm tra lại"
                }
              >
                <AlertCircle className={
                  bug.status === 'Cancelled' || bug.status === 'Rejected' ? "w-3 h-3 text-red-400" :
                  bug.status === 'Closed' ? "w-3 h-3 text-zinc-500" :
                  "w-3 h-3 text-rose-400"
                } />
                <span>{
                  bug.status === 'Cancelled' ? "Đã Hủy" :
                  bug.status === 'Rejected' ? "Từ chối" :
                  bug.status === 'Closed' ? "Đã Đóng" :
                  "Cần Recheck"
                }</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isOwner && bug.status === 'Pending' && (
              <button
                type="button"
                onClick={() => setPendingStatus('Cancelled')}
                className="px-2 py-0.5 bg-red-950/40 hover:bg-red-900/50 border border-red-900/50 text-red-400 rounded-md text-[10px] font-bold cursor-pointer transition-all duration-200"
              >
                Hủy yêu cầu
              </button>
            )}
            <div className="flex items-center gap-0.5">
              <Calendar className="w-3 h-3 text-zinc-500" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal Popup overlay */}
      {showDetails && (
        <div className="fixed inset-0 bg-[#070708]/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111113] rounded-2xl border border-[#222224] shadow-2xl p-5 md:p-6 max-w-4xl w-full relative animate-fade-in flex flex-col gap-4 text-left">
            <button
              onClick={() => setShowDetails(false)}
              className="absolute right-4 top-4 p-1.5 bg-[#161618] hover:bg-[#1E1E20] text-zinc-400 hover:text-white border border-[#222224] rounded-lg transition-all cursor-pointer z-50"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 border-b border-[#222224] pb-3 pr-8">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-400 font-bold bg-[#161618] border border-[#222224] px-2 py-0.5 rounded-md">
                  #{bug.id}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">{formattedDate}</span>
              </div>
              
              <div className="flex items-center gap-1.5">
                {isFixer && bug.status === 'Pending' && (
                  <button
                    onClick={() => setPendingStatus('Rejected')}
                    disabled={isUpdating}
                    title="Từ chối sự cố"
                    className="flex items-center gap-1 border border-red-900/50 bg-red-950/20 hover:bg-red-950/40 text-red-400 px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer hover:brightness-110 transition-all"
                  >
                    <X className="w-3 h-3 text-red-400" />
                    <span>Từ chối</span>
                  </button>
                )}
                {canChangeStatus ? (
                  <button
                    onClick={handleStatusCycle}
                    disabled={isUpdating}
                    className={`flex items-center gap-1 border px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer hover:brightness-110 transition-all ${statusInfo.bg}`}
                  >
                    {isUpdating ? (
                      <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      statusInfo.icon
                    )}
                    <span>{statusInfo.text}</span>
                  </button>
                ) : (
                  <div className={`flex items-center gap-1 border px-2.5 py-0.5 rounded-full text-[11px] font-semibold opacity-70 ${statusInfo.bg}`}>
                    {statusInfo.icon}
                    <span>{statusInfo.text}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Creator Info */}
            <div className="flex items-center justify-between gap-2 border-b border-[#222224] pb-2 text-xs text-zinc-450">
              <div className="flex items-center gap-2 text-zinc-400">
                <User className="w-3.5 h-3.5 text-zinc-500" />
                <span>Người báo cáo: </span>
                <span className="font-semibold text-zinc-200">{bug.user_name || bug.user_id}</span>
                {bug.user_id === currentUserId && (
                  <span className="bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full scale-90">Tôi</span>
                )}
              </div>

              {(bug.priority || 'Low') && (
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest font-bold">Độ ưu tiên:</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                    (bug.priority || 'Low') === 'High' 
                      ? 'bg-rose-950/40 border-rose-900/50 text-rose-400' 
                      : (bug.priority || 'Low') === 'Medium'
                      ? 'bg-amber-950/40 border-amber-900/50 text-amber-400'
                      : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400'
                  }`}>
                    {(bug.priority || 'Low') === 'High' ? '⭐⭐⭐' : (bug.priority || 'Low') === 'Medium' ? '⭐⭐' : '⭐'}
                  </span>
                </div>
              )}
            </div>

            {/* Scrollable Modal Content wrapper */}
            <div className="flex-1 overflow-y-auto pr-3 space-y-4 max-h-[70vh] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">

            {/* Additional Info block in Details modal */}
            {(bug.resolved_hours !== undefined || (bug.recheck_reason && bug.status !== 'Closed')) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bug.resolved_hours !== undefined && (
                  <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3 text-xs text-emerald-450 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-[9px] font-mono font-bold text-emerald-500/80 uppercase">THỜI GIAN SỬA LỖI</p>
                      <p className="text-zinc-200 mt-0.5">Thực hiện: <strong>{bug.resolved_hours} giờ</strong></p>
                    </div>
                  </div>
                )}

                {bug.recheck_reason && bug.status !== 'Closed' && (
                  <div className={
                    bug.status === 'Cancelled' || bug.status === 'Rejected'
                      ? "bg-red-950/20 border border-red-900/30 rounded-xl p-3 text-xs text-red-400 flex flex-col gap-1"
                      : bug.status === 'Closed'
                      ? "bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3 text-xs text-zinc-450 flex flex-col gap-1"
                      : "bg-rose-950/20 border border-rose-900/30 rounded-xl p-3 text-xs text-rose-450 flex flex-col gap-1"
                  }>
                    <span className={
                      bug.status === 'Cancelled' || bug.status === 'Rejected' ? "text-[9px] font-mono font-bold text-red-500/80 uppercase" :
                      bug.status === 'Closed' ? "text-[9px] font-mono font-bold text-zinc-500/80 uppercase" :
                      "text-[9px] font-mono font-bold text-rose-500/80 uppercase"
                    }>
                      {bug.status === 'Cancelled' ? "LÝ DO HỦY YÊU CẦU" :
                       bug.status === 'Rejected' ? "LÝ DO TỪ CHỐI YÊU CẦU" :
                       bug.status === 'Closed' ? "LÝ DO XÁC NHẬN HOÀN TẤT" :
                       "LÝ DO YÊU CẦU KIỂM TRA LẠI"}
                    </span>
                    <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap">{bug.recheck_reason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Detailed Description with Pre-line formatting */}
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Nội dung chi tiết sự cố</h4>
              <div className="bg-[#161618] border border-[#222224] rounded-xl p-3.5 text-xs text-zinc-100 leading-relaxed whitespace-pre-wrap font-sans break-words max-h-[220px] overflow-y-auto">
                {generalDescription}
              </div>
            </div>

            {/* Attachment Images */}
            {bug.image && bug.image.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Hình ảnh đính kèm ({bug.image.length})</h4>
                <div className="grid grid-cols-3 gap-2 flex-1 overflow-y-auto max-h-[480px]">
                  {bug.image.map((imgUrl, i) => (
                    <div
                      key={i}
                      onClick={() => setActiveImage(imgUrl)}
                      className="relative aspect-video rounded-lg overflow-hidden border border-[#222224] bg-[#161618] cursor-zoom-in hover:brightness-110 transition-all group/modal-img"
                    >
                      <img
                        src={imgUrl}
                        alt={`Attachment ${i + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/modal-img:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History Logs Timeline */}
            <div className="space-y-2 border-t border-[#222224] pt-4">
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Lịch sử thay đổi trạng thái</h4>
              {bug.history && bug.history.length > 0 ? (
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                  {bug.history.map((log, index) => {
                    const logDate = new Date(log.timestamp).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    const fromStyle = getStatusStyle(log.from_status as BugStatus);
                    const toStyle = getStatusStyle(log.to_status as BugStatus);

                    return (
                      <div key={index} className="flex gap-3 text-xs leading-relaxed items-start border-b border-[#1c1c1e] pb-2 last:border-0 last:pb-0">
                        <div className="text-[10px] font-mono text-zinc-500 shrink-0 w-24 pt-0.5">{logDate}</div>
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-zinc-300">
                            <span className="font-semibold text-zinc-100">{log.user_name}</span>
                            <span>đã chuyển từ</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${fromStyle.bg}`}>{fromStyle.text}</span>
                            <span>sang</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${toStyle.bg}`}>{toStyle.text}</span>
                          </div>
                          {log.resolved_hours !== undefined && (
                            <div className="text-[11px] text-emerald-400 font-medium">
                              Số giờ: +{formatDuration(log.resolved_hours)}
                            </div>
                          )}
                          {log.recheck_reason && (
                            <div className="text-[11px] text-rose-450 italic bg-rose-950/10 border border-rose-900/20 rounded-md p-1.5 mt-1 font-sans">
                              Lý do: {log.recheck_reason}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-zinc-500 italic py-2">Chưa có lịch sử thay đổi.</div>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Lightbox / Zoom modal */}
      {activeImage && (() => {
        const activeImgIndex = bug.image.indexOf(activeImage);
        const imgAnnotations = getAnnotationsForImage(bug.description, activeImgIndex);
        
        const handlePrevImage = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (activeImgIndex > 0) {
            setActiveImage(bug.image[activeImgIndex - 1]);
          }
        };

        const handleNextImage = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (activeImgIndex < bug.image.length - 1) {
            setActiveImage(bug.image[activeImgIndex + 1]);
          }
        };

        return (
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-zoom-out"
            onClick={() => setActiveImage(null)}
          >
            <div 
              className="bg-[#111113] border border-[#222224] rounded-2xl max-w-5xl w-full max-h-[85vh] flex flex-col md:flex-row overflow-hidden shadow-2xl animate-fade-in relative text-left cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveImage(null)}
                className="absolute right-4 top-4 p-1.5 bg-[#161618] hover:bg-[#1E1E20] text-zinc-400 hover:text-white border border-[#222224] rounded-lg transition-all cursor-pointer z-50"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Image View Area */}
              <div className="flex-1 bg-[#0A0A0B] flex items-center justify-center p-4 min-h-[300px] md:min-h-0 relative">
                {activeImgIndex > 0 && (
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-4 p-2 bg-[#111113]/70 hover:bg-[#1E1E20]/90 text-zinc-400 hover:text-white border border-[#222224] rounded-full transition-all cursor-pointer z-40 select-none backdrop-blur-xs shadow-lg"
                    title="Ảnh trước đó (←)"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                <img
                  src={activeImage}
                  alt={`Attachment ${activeImgIndex + 1}`}
                  className="max-w-full max-h-[75vh] object-contain select-none animate-fade-in"
                  referrerPolicy="no-referrer"
                />

                {activeImgIndex < bug.image.length - 1 && (
                  <button
                    onClick={handleNextImage}
                    className="absolute right-4 p-2 bg-[#111113]/70 hover:bg-[#1E1E20]/90 text-zinc-400 hover:text-white border border-[#222224] rounded-full transition-all cursor-pointer z-40 select-none backdrop-blur-xs shadow-lg"
                    title="Ảnh tiếp theo (→)"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Sidebar Description Area */}
              <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-[#222224] p-4 bg-[#161618]/30 flex flex-col gap-3 overflow-y-auto">
                <div className="border-b border-[#222224] pb-2">
                  <h3 className="text-xs font-bold text-white tracking-wide">
                    Ảnh đính kèm {activeImgIndex + 1} / {bug.image.length}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">#{bug.id.substring(0, 8)}</p>
                </div>

                <div className="space-y-1.5 flex-1">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                    Danh sách chú thích vẽ lỗi
                  </h4>
                  {imgAnnotations ? (
                    <div className="bg-[#161618]/60 border border-[#222224] rounded-xl p-3 text-[11px] text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans break-words overflow-y-auto max-h-[30vh] md:max-h-[50vh]">
                      {imgAnnotations}
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-500 italic py-6 text-center border border-dashed border-[#222224] rounded-xl bg-[#161618]/20">
                      Ảnh này không chứa ký hiệu khoanh vùng chú thích vẽ lỗi.
                    </div>
                  )}
                </div>

                {/* Footer status/info inside Lightbox */}
                <div className="border-t border-[#222224] pt-3 mt-auto flex items-center justify-between text-[10px] text-zinc-500">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-zinc-600" />
                    <span className="truncate max-w-[120px]">{bug.user_name || bug.user_id}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Calendar className="w-3 h-3 text-zinc-600" />
                    <span>{formattedDate.split(' ')[0]}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal / Form for additional inputs (resolved_hours / recheck_reason) */}
      {pendingStatus && (
        <div className="fixed inset-0 bg-[#070708]/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#111113] rounded-2xl border border-[#222224] shadow-2xl p-5 max-w-sm w-full space-y-4 text-left">
            <h3 className="font-semibold text-sm text-white">
              {pendingStatus === 'Resolved' && 'Hoàn tất sửa lỗi'}
              {pendingStatus === 'Recheck' && 'Yêu cầu kiểm tra lại'}
              {pendingStatus === 'Cancelled' && 'Hủy yêu cầu'}
              {pendingStatus === 'Rejected' && 'Từ chối sự cố'}
            </h3>
            
            {pendingStatus === 'Resolved' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">
                  Thời gian thực hiện sửa lỗi *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 10p hoặc 2h"
                  value={inputHours}
                  onChange={(e) => setInputHours(e.target.value)}
                  className="w-full px-3 py-2 bg-[#161618] border border-[#222224] rounded-lg text-xs focus:outline-hidden focus:border-blue-500 text-white"
                  required
                />
                <span className="text-[9px] text-zinc-500 block">
                  Nhập số phút (vd: 10p) hoặc số giờ (vd: 2h hoặc 2)
                </span>
              </div>
            )}

            {pendingStatus === 'Recheck' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">
                  Lý do yêu cầu kiểm tra lại (recheck_reason) *
                </label>
                <textarea
                  placeholder="Nhập lý do chi tiết..."
                  value={inputRecheckReason}
                  onChange={(e) => setInputRecheckReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-[#161618] border border-[#222224] rounded-lg text-xs focus:outline-hidden focus:border-blue-500 text-white resize-none"
                  required
                />
              </div>
            )}

            {pendingStatus === 'Cancelled' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">
                  Lý do hủy yêu cầu (recheck_reason) *
                </label>
                <textarea
                  placeholder="Nhập lý do hủy sự cố này..."
                  value={inputRecheckReason}
                  onChange={(e) => setInputRecheckReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-[#161618] border border-[#222224] rounded-lg text-xs focus:outline-hidden focus:border-blue-500 text-white resize-none"
                  required
                />
              </div>
            )}

            {pendingStatus === 'Rejected' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">
                  Lý do từ chối sự cố (recheck_reason) *
                </label>
                <textarea
                  placeholder="Nhập lý do từ chối sự cố này..."
                  value={inputRecheckReason}
                  onChange={(e) => setInputRecheckReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-[#161618] border border-[#222224] rounded-lg text-xs focus:outline-hidden focus:border-blue-500 text-white resize-none"
                  required
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222224]">
              <button
                type="button"
                onClick={() => {
                  setPendingStatus(null);
                  setInputHours('');
                  setInputRecheckReason('');
                }}
                className="px-3 py-1.5 bg-[#161618] hover:bg-[#1E1E20] text-zinc-400 border border-[#222224] rounded-lg text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (pendingStatus === 'Resolved') {
                    const hours = parseDuration(inputHours);
                    if (hours === null || hours <= 0) {
                      alert("Vui lòng nhập thời gian hợp lệ (ví dụ: 10p, 2.5h hoặc 2)");
                      return;
                    }
                    setIsUpdating(true);
                    try {
                      await onBugUpdate(bug.id, 'Resolved', { resolved_hours: hours });
                      setPendingStatus(null);
                      setInputHours('');
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setIsUpdating(false);
                    }
                  } else if (pendingStatus === 'Recheck') {
                    if (!inputRecheckReason.trim()) {
                      alert("Vui lòng nhập lý do kiểm tra lại");
                      return;
                    }
                    setIsUpdating(true);
                    try {
                      await onBugUpdate(bug.id, 'Recheck', { recheck_reason: inputRecheckReason.trim() });
                      setPendingStatus(null);
                      setInputRecheckReason('');
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setIsUpdating(false);
                    }
                  } else if (pendingStatus === 'Cancelled') {
                    if (!inputRecheckReason.trim()) {
                      alert("Vui lòng nhập lý do hủy sự cố");
                      return;
                    }
                    setIsUpdating(true);
                    try {
                      await onBugUpdate(bug.id, 'Cancelled', { recheck_reason: inputRecheckReason.trim() });
                      setPendingStatus(null);
                      setInputRecheckReason('');
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setIsUpdating(false);
                    }
                  } else if (pendingStatus === 'Rejected') {
                    if (!inputRecheckReason.trim()) {
                      alert("Vui lòng nhập lý do từ chối sự cố");
                      return;
                    }
                    setIsUpdating(true);
                    try {
                      await onBugUpdate(bug.id, 'Rejected', { recheck_reason: inputRecheckReason.trim() });
                      setPendingStatus(null);
                      setInputRecheckReason('');
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setIsUpdating(false);
                    }
                  }
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Action Choice Modal for Reporter/Approver/Owner */}
      {showReporterAction && (
        <div className="fixed inset-0 bg-[#070708]/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#111113] rounded-2xl border border-[#222224] shadow-2xl p-5 max-w-sm w-full space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-[#222224] pb-2">
              <h3 className="font-semibold text-sm text-white">Lựa chọn thao tác</h3>
              <button 
                onClick={() => setShowReporterAction(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-zinc-450 leading-relaxed">
              Vui lòng chọn thao tác bạn muốn thực hiện đối với sự cố này:
            </p>

            <div className="flex flex-col gap-2 pt-1">
              {bug.status === 'Resolved' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowReporterAction(false);
                    setPendingStatus('Recheck');
                  }}
                  className="w-full py-2.5 px-4 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/50 text-rose-450 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 text-center"
                >
                  Kiểm tra lại (Yêu cầu làm lại)
                </button>
              )}
              
              <button
                type="button"
                onClick={async () => {
                  setShowReporterAction(false);
                  setIsUpdating(true);
                  try {
                    await onBugUpdate(bug.id, 'Closed');
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsUpdating(false);
                  }
                }}
                className="w-full py-2.5 px-4 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-900/50 text-emerald-400 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 text-center"
              >
                Xác nhận hoàn tất (Đóng Case)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BugCard;
