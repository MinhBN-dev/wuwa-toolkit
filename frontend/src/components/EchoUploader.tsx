import { useCallback, useState, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Loader2, Clipboard, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { extractEchoStats } from '../services/api'
import type { OcrResult } from '../types/echo'

interface Props {
  onExtracted: (result: OcrResult) => void
  /** When set, upload/paste is blocked and this message is shown instead */
  blockedReason?: string
}

export default function EchoUploader({ onExtracted, blockedReason }: Props) {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [pasteHighlight, setPasteHighlight] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const processFile = useCallback(
    async (file: File) => {
      setPreview(URL.createObjectURL(file))
      setLoading(true)

      const toastId = toast.loading('Đang đọc ảnh echo...')

      try {
        const result = await extractEchoStats(file)
        toast.success('Đọc thành công!', { id: toastId })
        onExtracted(result)
      } catch (err: unknown) {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        const msg = detail ?? (err instanceof Error ? err.message : 'OCR failed')
        toast.error(msg, { id: toastId })
      } finally {
        setLoading(false)
      }
    },
    [onExtracted],
  )

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  // Global paste listener (Ctrl+V anywhere on the page)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (loading || blockedReason) return
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItem = items.find(item => item.type.startsWith('image/'))
      if (!imageItem) return

      const file = imageItem.getAsFile()
      if (!file) return

      setPasteHighlight(true)
      setTimeout(() => setPasteHighlight(false), 600)
      processFile(file)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [loading, blockedReason, processFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    disabled: loading || !!blockedReason,
  })

  // ── Blocked state ────────────────────────────────────────────────────────────
  if (blockedReason) {
    return (
      <div className="border-2 border-dashed border-ww-border rounded-xl p-6 text-center opacity-60">
        <div className="flex flex-col items-center gap-2">
          <Lock className="w-8 h-8 text-ww-muted" />
          <p className="text-ww-muted text-sm">{blockedReason}</p>
        </div>
      </div>
    )
  }

  // ── Compact mode (after image loaded) ────────────────────────────────────────
  if (preview) {
    return (
      <div className="space-y-2" ref={containerRef}>
        <div className="relative rounded-lg overflow-hidden border border-ww-border">
          <img src={preview} alt="Echo preview" className="w-full object-contain bg-black/20" />
          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <Loader2 className="w-6 h-6 text-ww-accent animate-spin" />
            </div>
          )}
        </div>
        {!loading && (
          <div
            {...getRootProps()}
            className="flex items-center justify-center gap-2 py-1.5 rounded-lg border border-dashed border-ww-border text-ww-muted hover:border-ww-accent/50 hover:text-ww-text cursor-pointer transition-all text-xs"
          >
            <input {...getInputProps()} />
            <Upload className="w-3 h-3" />
            <span>Change image or paste new (Ctrl+V)</span>
          </div>
        )}
      </div>
    )
  }

  // ── Full drop zone ────────────────────────────────────────────────────────────
  const borderClass = pasteHighlight
    ? 'border-ww-accent bg-ww-accent/10'
    : isDragActive
      ? 'border-ww-accent bg-ww-accent/5'
      : 'border-ww-border hover:border-ww-accent/50 hover:bg-ww-surface/50'

  return (
    <div className="space-y-3" ref={containerRef}>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-150
          ${borderClass}
          ${loading ? 'opacity-60 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {loading ? (
            <Loader2 className="w-8 h-8 text-ww-accent animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-ww-muted" />
          )}
          <div>
            <p className="text-ww-text font-medium text-sm">
              {loading ? 'Extracting stats...' : 'Drop echo screenshot here'}
            </p>
            <p className="text-ww-muted text-xs mt-0.5">
              {loading ? 'AI is reading your echo' : 'or click to browse · JPG, PNG, WEBP'}
            </p>
          </div>
        </div>
      </div>

      {/* Paste hint */}
      {!loading && (
        <div className={`
          flex items-center justify-center gap-2 py-1.5 rounded-lg border transition-all duration-150 text-xs
          ${pasteHighlight
            ? 'border-ww-accent text-ww-accent bg-ww-accent/10'
            : 'border-ww-border text-ww-muted'}
        `}>
          <Clipboard className="w-3 h-3" />
          <span>
            Paste từ clipboard{' '}
            <kbd className="bg-ww-border text-ww-text text-xs px-1.5 py-0.5 rounded font-mono">Ctrl+V</kbd>
          </span>
        </div>
      )}
    </div>
  )
}
