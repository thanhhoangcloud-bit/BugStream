import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, AlertCircle, Sparkles, CheckCircle2, Trash2, Edit3, Type, Move, ZoomIn, ZoomOut, Plus } from 'lucide-react';
import { AppConfig } from '../types';

interface BugFormProps {
  userId: string;
  onBugSubmitted: (bug: { description: string; image: string[] }) => Promise<void>;
  appConfig: AppConfig;
}

interface Annotation {
  id: string;
  type: 'rect' | 'line';
  startX: number; // relative 0-1
  startY: number; // relative 0-1
  endX: number;   // relative 0-1
  endY: number;   // relative 0-1
  description: string;
}

interface SelectedFile {
  file: File;
  preview: string;
  annotations: Annotation[];
}

export default function BugForm({ userId, onBugSubmitted, appConfig }: BugFormProps) {
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const [activeEditIndex, setActiveEditIndex] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [activeTool, setActiveTool] = useState<'rect' | 'line'>('rect');
  const [translateX, setTranslateX] = useState<number>(0);
  const [translateY, setTranslateY] = useState<number>(0);
  const [isPanning, setIsPanning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorWorkspaceRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const currentAnnotRef = useRef<Annotation | null>(null);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Attach native wheel event listener to handle zoom in/out inside viewport
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomIntensity = 0.1;
      setZoomScale((currentScale) => {
        if (e.deltaY < 0) {
          return Math.min(2.5, currentScale + zoomIntensity);
        } else {
          return Math.max(0.75, currentScale - zoomIntensity);
        }
      });
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
    };
  }, [activeEditIndex]);

  // Trigger file upload dialog on mount
  useEffect(() => {
    triggerFileSelect();
  }, []);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const resizeImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_SIZE = 2000;
          let width = img.width;
          let height = img.height;
          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            } else {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                if (blob) {
                  const resizedFile = new File([blob], file.name, {
                    type: file.type,
                    lastModified: Date.now(),
                  });
                  resolve(resizedFile);
                } else {
                  resolve(file);
                }
              }, file.type);
            } else {
              resolve(file);
            }
          } else {
            resolve(file);
          }
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async (fileList: FileList) => {
    const newFiles: SelectedFile[] = [];
    const currentCount = files.length;
    const remainingCount = 10 - currentCount;

    if (remainingCount <= 0) {
      setErrorMsg('Bạn đã đạt giới hạn tối đa 10 ảnh.');
      return;
    }

    const filesToProcess = Array.from(fileList).slice(0, remainingCount);

    for (const file of filesToProcess) {
      if (file.type.startsWith('image/')) {
        const resizedFile = await resizeImage(file);
        newFiles.push({
          file: resizedFile,
          preview: URL.createObjectURL(resizedFile),
          annotations: []
        });
      }
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
      setErrorMsg('');
      // Auto open editor for the first newly added image
      setActiveEditIndex(currentCount);
      setZoomScale(1);
      setTranslateX(0);
      setTranslateY(0);
    } else {
      setErrorMsg('Vui lòng chọn các tệp tin hình ảnh hợp lệ.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
    if (activeEditIndex === index) {
      setActiveEditIndex(null);
      setTranslateX(0);
      setTranslateY(0);
    } else if (activeEditIndex !== null && activeEditIndex > index) {
      setActiveEditIndex(activeEditIndex - 1);
    }
  };

  // Drawing relative coordinate handling
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeEditIndex === null) return;
    if (e.button === 2) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - translateX, y: e.clientY - translateY };
      return;
    }
    const rect = editorWorkspaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    isDrawingRef.current = true;
    currentAnnotRef.current = {
      id: Math.random().toString(36).substring(2, 9),
      type: activeTool === 'rect' ? 'rect' : 'line',
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      description: ''
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setTranslateX(e.clientX - panStartRef.current.x);
      setTranslateY(e.clientY - panStartRef.current.y);
      return;
    }
    if (!isDrawingRef.current || !currentAnnotRef.current) return;
    if (activeEditIndex === null) return;
    const rect = editorWorkspaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    currentAnnotRef.current.endX = x;
    currentAnnotRef.current.endY = y;

    // Temporary force state update by refreshing annotation array
    setFiles(prev => {
      if (activeEditIndex === null || activeEditIndex >= prev.length || !prev[activeEditIndex]) {
        return prev;
      }
      const copy = [...prev];
      const curImg = copy[activeEditIndex];
      if (!curImg || !currentAnnotRef.current) return prev;
      const rest = curImg.annotations.filter(a => a.id !== currentAnnotRef.current!.id);
      curImg.annotations = [...rest, currentAnnotRef.current!];
      return copy;
    });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);
    if (e.button === 2) return;
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    currentAnnotRef.current = null;
  };

  const deleteAnnotation = (annotId: string) => {
    if (activeEditIndex === null) return;
    setFiles(prev => {
      if (activeEditIndex >= prev.length || !prev[activeEditIndex]) return prev;
      const copy = [...prev];
      copy[activeEditIndex].annotations = copy[activeEditIndex].annotations.filter(a => a.id !== annotId);
      return copy;
    });
  };

  const handleAnnotationDescChange = (annotId: string, text: string) => {
    if (activeEditIndex === null) return;
    setFiles(prev => {
      if (activeEditIndex >= prev.length || !prev[activeEditIndex]) return prev;
      const copy = [...prev];
      copy[activeEditIndex].annotations = copy[activeEditIndex].annotations.map(a => 
        a.id === annotId ? { ...a, description: text } : a
      );
      return copy;
    });
  };

  // Render annotated canvas back to base64 for uploading to Cloudinary
  const renderAnnotatedImage = (imgObj: SelectedFile): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imgObj.preview;
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imgObj.preview);
          return;
        }

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Draw each annotation
        imgObj.annotations.forEach((annot, idx) => {
          const sx = annot.startX * canvas.width;
          const sy = annot.startY * canvas.height;
          const ex = annot.endX * canvas.width;
          const ey = annot.endY * canvas.height;
          const labelNum = `${idx + 1}`;

          ctx.lineWidth = Math.max(3, canvas.width * 0.005);
          ctx.lineCap = 'round';

          if (annot.type === 'rect') {
            // Draw rectangle stroke
            ctx.strokeStyle = '#f43f5e'; // rose-500
            ctx.strokeRect(sx, sy, ex - sx, ey - sy);
          } else {
            // Draw simple line with an arrow head
            ctx.strokeStyle = '#3b82f6'; // blue-500
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();

            // Arrow head
            const angle = Math.atan2(ey - sy, ex - sx);
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - 12 * Math.cos(angle - Math.PI / 6), ey - 12 * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(ex - 12 * Math.cos(angle + Math.PI / 6), ey - 12 * Math.sin(angle + Math.PI / 6));
            ctx.fill();
          }

          // Draw custom number badge so developers can reference annotations
          const badgeX = sx;
          const badgeY = Math.max(15, sy - 8);
          const badgeRadius = Math.max(12, canvas.width * 0.015);

          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(12, canvas.width * 0.014)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelNum, badgeX, badgeY);
        });

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => {
        resolve(imgObj.preview);
      };
    });
  };

  const uploadToCloudinary = async (base64Image: string): Promise<string> => {
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          cloudName: appConfig.cloudinaryCloudName,
          apiKey: appConfig.cloudinaryApiKey,
          apiSecret: appConfig.cloudinaryApiSecret,
        }),
      });

      if (!response.ok) {
        throw new Error('Upload API failed');
      }

      const result = await response.json();
      return result.url;
    } catch (err) {
      console.warn("Upload fallback base64 used:", err);
      return base64Image;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Vui lòng điền mô tả chung lỗi gặp phải.');
      return;
    }

    setUploading(true);
    setErrorMsg('');

    try {
      const imageUrls: string[] = [];

      // Render annotations directly onto each canvas & upload
      for (const item of files) {
        const renderedBase64 = await renderAnnotatedImage(item);
        const url = await uploadToCloudinary(renderedBase64);
        imageUrls.push(url);
      }

      // Concat sub-annotations texts to main report
      let finalDescription = description.trim();
      files.forEach((fileObj, fIdx) => {
        if (fileObj.annotations.length > 0) {
          finalDescription += `\n\n📌 Chú thích ảnh ${fIdx + 1}:`;
          fileObj.annotations.forEach((annot, aIdx) => {
            const desc = annot.description.trim() || 'Chưa nhập mô tả';
            finalDescription += `\n  - ${aIdx + 1}: ${desc}`;
          });
        }
      });

      await onBugSubmitted({
        description: finalDescription,
        image: imageUrls
      });

      setDescription('');
      setFiles([]);
      setActiveEditIndex(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi xảy ra trong quá trình báo cáo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-[#111113] rounded-xl border border-[#222224] p-4 shadow-sm space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-blue-400" />
        <h3 className="font-semibold text-sm text-white uppercase tracking-wider font-mono">
          Báo cáo sự cố nâng cao
        </h3>
      </div>

      {success && (
        <div className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 text-xs p-3 rounded-lg flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <p className="font-semibold">Báo cáo lỗi thành công!</p>
            <p className="text-[11px] text-emerald-400/80">Hình vẽ khoanh vùng & chú thích chi tiết đã được đồng bộ.</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-950/20 border border-red-900/30 text-red-300 text-[11px] p-2.5 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">
            1. Mô tả chung sự cố
          </label>
          <textarea
            placeholder="Mô tả tổng quan về lỗi bạn phát hiện..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-[#161618] border border-[#222224] rounded-lg text-xs focus:outline-hidden focus:border-blue-500 placeholder:text-zinc-600 text-white resize-none"
            required
          />
        </div>
        {/* Images Selection & List with Inline Plus Button */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">
              2. Danh sách ảnh tải lên ({files.length}/10)
            </label>
            {files.length > 0 && (
              <span className="text-[9px] text-zinc-500">Click ảnh để khoanh vùng chú thích</span>
            )}
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            multiple
            className="hidden"
          />

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {files.map((fileObj, idx) => (
              <div 
                key={idx} 
                onClick={() => {
                  setActiveEditIndex(idx);
                  setZoomScale(1);
                  setTranslateX(0);
                  setTranslateY(0);
                }}
                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border transition-all ${
                  activeEditIndex === idx ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-[#222224] hover:border-zinc-600'
                }`}
              >
                <img
                  src={fileObj.preview}
                  alt={`Preview ${idx + 1}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="absolute top-1 right-1 bg-black/80 hover:bg-black text-white p-0.5 rounded-full transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-zinc-300 font-mono py-0.5 text-center font-bold">
                  Ảnh {idx + 1}
                </div>
              </div>
            ))}

            {/* "+" Add more images square box */}
            {files.length < 10 && (
              <div
                onClick={triggerFileSelect}
                className="relative aspect-square rounded-lg border border-dashed border-[#222224] hover:border-zinc-600 bg-[#161618]/50 hover:bg-[#161618] flex flex-col items-center justify-center cursor-pointer transition-all gap-1 text-zinc-500 hover:text-zinc-300"
              >
                <Plus className="w-5 h-5 text-blue-400" />
                <span className="text-[8px] font-mono font-bold uppercase">Thêm ảnh</span>
              </div>
            )}
          </div>
        </div>

        {/* Advanced Drawing Workspace */}
        {activeEditIndex !== null && files[activeEditIndex] && (
          <div className="bg-[#161618] border border-[#222224] rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-[#222224] pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] font-bold text-white uppercase font-mono">Không gian vẽ khoanh lỗi: Ảnh {activeEditIndex + 1}</span>
              </div>
              
              {/* Workspace Tools */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveTool('rect')}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-bold cursor-pointer transition-all ${
                    activeTool === 'rect' ? 'bg-blue-600 text-white' : 'bg-[#111113] text-zinc-400 hover:text-white border border-[#222224]'
                  }`}
                >
                  [▭] Khoanh Vùng
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool('line')}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-bold cursor-pointer transition-all ${
                    activeTool === 'line' ? 'bg-blue-600 text-white' : 'bg-[#111113] text-zinc-400 hover:text-white border border-[#222224]'
                  }`}
                >
                  [➔] Chỉ Mũi Tên
                </button>
                <span className="text-[9px] text-zinc-500 font-mono ml-1.5">
                  (Cuộn chuột để phóng to/thu nhỏ • Nhấn giữ chuột phải để kéo ảnh)
                </span>
              </div>
            </div>

            {/* Canvas Container */}
            <div className="flex flex-col md:flex-row gap-3">
              <div 
                ref={viewportRef}
                className="flex-1 bg-[#0f0f11] rounded-lg border border-[#222224] overflow-hidden flex items-center justify-center p-4 relative min-h-[250px] max-h-[400px]"
              >
                
                <div 
                  ref={editorWorkspaceRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`relative select-none ${
                    isPanning ? 'cursor-grabbing' : 'cursor-crosshair'
                  }`}
                  style={{
                    transform: `translate(${translateX}px, ${translateY}px) scale(${zoomScale})`,
                    transition: (isDrawingRef.current || isPanning) ? 'none' : 'transform 0.15s ease-out',
                    width: '100%',
                    maxWidth: '380px',
                    aspectRatio: '4/3',
                  }}
                >
                  <img
                    src={files[activeEditIndex].preview}
                    alt="Active workspace"
                    className="w-full h-full object-contain pointer-events-none rounded-md"
                    referrerPolicy="no-referrer"
                  />

                  {/* Render Drawing Vectors Responsive Overlays */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none select-none">
                    {files[activeEditIndex].annotations.map((annot, idx) => {
                      const sx = `${annot.startX * 100}%`;
                      const sy = `${annot.startY * 100}%`;
                      const ex = `${annot.endX * 100}%`;
                      const ey = `${annot.endY * 100}%`;

                      if (annot.type === 'rect') {
                        const left = `${Math.min(annot.startX, annot.endX) * 100}%`;
                        const top = `${Math.min(annot.startY, annot.endY) * 100}%`;
                        const width = `${Math.abs(annot.endX - annot.startX) * 100}%`;
                        const height = `${Math.abs(annot.endY - annot.startY) * 100}%`;

                        return (
                          <g key={annot.id}>
                            <rect
                              x={left}
                              y={top}
                              width={width}
                              height={height}
                              fill="rgba(244, 63, 94, 0.1)"
                              stroke="#f43f5e"
                              strokeWidth="2.5"
                              className="pointer-events-auto cursor-pointer"
                              onClick={(e) => {
                                if (activeTool === 'eraser') {
                                  e.stopPropagation();
                                  deleteAnnotation(annot.id);
                                }
                              }}
                            />
                            {/* Annotation Number Label */}
                            <circle cx={sx} cy={sy} r="8" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" />
                            <text x={sx} y={sy} fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle" dominantBaseline="central">
                              {idx + 1}
                            </text>
                          </g>
                        );
                      } else {
                        return (
                          <g key={annot.id}>
                            <line
                              x1={sx}
                              y1={sy}
                              x2={ex}
                              y2={ey}
                              stroke="#3b82f6"
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              className="pointer-events-auto cursor-pointer"
                              onClick={(e) => {
                                if (activeTool === 'eraser') {
                                  e.stopPropagation();
                                  deleteAnnotation(annot.id);
                                }
                              }}
                            />
                            {/* Direction Arrow Endpoint */}
                            <circle cx={sx} cy={sy} r="8" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" />
                            <text x={sx} y={sy} fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle" dominantBaseline="central">
                              {idx + 1}
                            </text>
                          </g>
                        );
                      }
                    })}
                  </svg>
                </div>
              </div>

              {/* Sub Annotation Text Inputs side checklist */}
              <div className="w-full md:w-64 flex flex-col min-h-[250px] max-h-[400px]">
                {files[activeEditIndex].annotations.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-[11px] text-zinc-600 italic p-4 text-center border border-[#222224] rounded-lg">
                    Chưa có hình khoanh nào. Kéo thả trực tiếp lên ảnh để chú thích.
                  </div>
                ) : (
                  <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                    {files[activeEditIndex].annotations.map((annot, idx) => (
                      <div key={annot.id} className="bg-[#111113] border border-[#222224] p-2 rounded-md space-y-1 relative">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold font-mono bg-blue-600 text-white rounded-full">
                            {idx + 1}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono">
                            {annot.type === 'rect' ? 'Vùng Khoanh' : 'Mũi Tên'}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteAnnotation(annot.id)}
                            className="text-zinc-600 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Mô tả sự cố của vùng này..."
                          value={annot.description}
                          onChange={(e) => handleAnnotationDescChange(annot.id, e.target.value)}
                          className="w-full px-2 py-1 bg-[#161618] border border-[#222224] rounded-sm text-[11px] focus:outline-hidden focus:border-blue-500 text-white"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg cursor-pointer active:scale-[0.99] transition-all text-xs font-semibold uppercase tracking-wider shadow-md shadow-blue-900/20 flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Đang kết xuất ảnh & tải lên Supabase...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Gửi báo cáo sự cố</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
