'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, Image, Music, Video, FileText, CheckCircle } from 'lucide-react';
import { Button } from './button';

interface MediaUploadProps {
  value: string;
  onChange: (url: string, filename?: string) => void;
  /** Restrict accepted file types. If empty, all media types allowed. */
  accept?: string;
  label?: string;
}

const MEDIA_TYPE_MAP: Record<string, { type: string; icon: typeof Image; label: string }> = {
  'image/jpeg': { type: 'image', icon: Image, label: 'Imagem' },
  'image/png': { type: 'image', icon: Image, label: 'Imagem' },
  'image/gif': { type: 'image', icon: Image, label: 'Imagem' },
  'image/webp': { type: 'image', icon: Image, label: 'Imagem' },
  'audio/mpeg': { type: 'audio', icon: Music, label: 'Áudio' },
  'audio/ogg': { type: 'audio', icon: Music, label: 'Áudio' },
  'audio/opus': { type: 'audio', icon: Music, label: 'Áudio' },
  'audio/wav': { type: 'audio', icon: Music, label: 'Áudio' },
  'audio/mp4': { type: 'audio', icon: Music, label: 'Áudio' },
  'video/mp4': { type: 'video', icon: Video, label: 'Vídeo' },
  'video/webm': { type: 'video', icon: Video, label: 'Vídeo' },
  'video/quicktime': { type: 'video', icon: Video, label: 'Vídeo' },
  'application/pdf': { type: 'document', icon: FileText, label: 'Documento' },
  'application/msword': { type: 'document', icon: FileText, label: 'Documento' },
  'text/plain': { type: 'document', icon: FileText, label: 'Documento' },
};

/** Detect media category from MIME type or file extension */
export function detectMediaType(file: File): 'image' | 'audio' | 'video' | 'document' {
  const mime = MEDIA_TYPE_MAP[file.type];
  if (mime) return mime.type as 'image' | 'audio' | 'video' | 'document';

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (['mp3', 'ogg', 'opus', 'wav', 'm4a'].includes(ext)) return 'audio';
  if (['mp4', 'avi', 'mov', 'webm'].includes(ext)) return 'video';
  return 'document';
}

export function MediaUpload({ value, onChange, accept, label }: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedInfo, setUploadedInfo] = useState<{ name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao enviar arquivo');
      }

      const data = await res.json();
      onChange(data.url, data.original_name);
      setUploadedInfo({ name: data.original_name, type: data.mime_type });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar arquivo';
      // Use console to show error since we don't want to import toast here
      console.error(msg);
      alert(msg);
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [uploadFile]);

  const clearFile = () => {
    onChange('', '');
    setUploadedInfo(null);
  };

  const getIcon = () => {
    if (uploadedInfo) {
      const info = MEDIA_TYPE_MAP[uploadedInfo.type];
      if (info) {
        const IconComp = info.icon;
        return <IconComp className="w-8 h-8 text-violet-400" />;
      }
    }
    return <Upload className="w-8 h-8 text-slate-500" />;
  };

  // Already has a value (either uploaded or manually entered)
  if (value) {
    return (
      <div className="space-y-2">
        {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}
        <div className="flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 rounded-lg">
          {uploadedInfo ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{uploadedInfo.name}</p>
                <p className="text-xs text-slate-400">{value}</p>
              </div>
            </>
          ) : (
            <>
              {getIcon()}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{value}</p>
              </div>
            </>
          )}
          <button
            onClick={clearFile}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-all duration-200
          ${dragOver
            ? 'border-violet-500 bg-violet-500/10'
            : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
          }
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept || 'image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'}
          onChange={handleFileSelect}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            <p className="text-sm text-slate-400">Enviando arquivo...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className={`w-8 h-8 ${dragOver ? 'text-violet-400' : 'text-slate-500'}`} />
            <div>
              <p className="text-sm text-slate-300">
                <span className="text-violet-400 font-medium">Clique para escolher</span> ou arraste um arquivo
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Imagens, áudios, vídeos ou documentos (max 20MB)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
