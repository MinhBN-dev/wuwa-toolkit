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
      <div className="dropzone-frame p-6 text-center opacity-50">
        <div className="flex flex-col items-center gap-2">
          <Lock className="w-7 h-7 text-ww-muted" />
          <p className="text-ww-muted text-sm font-display tracking-wide">{blockedReason}</p>
        </div>
      </div>
    )
  }

  // ── Compact mode (after image loaded) ────────────────────────────────────────
  if (preview) {
    return (
      <div className="space-y-2" ref={containerRef}>
        <div className="relative rounded-lg overflow-hidden border border-ww-border-glow shadow-panel">
          <img src={preview} alt="Echo preview" className="w-full object-contain bg-black/30" />
          {loading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-ww-cyan animate-spin" />
            </div>
          )}
        </div>
        {!loading && (
          <div
            {...getRootProps()}
            className="dropzone-frame flex items-center justify-center gap-2 py-2 px-3 cursor-pointer text-xs text-ww-muted hover:text-ww-cyan font-display uppercase tracking-wider"
          >
            <input {...getInputProps()} />
            <Upload className="w-3 h-3" />
            <span>Change · paste new (Ctrl+V)</span>
          </div>
        )}
      </div>
    )
  }

  // ── Full drop zone ────────────────────────────────────────────────────────────
  const stateClass = (pasteHighlight || isDragActive) ? 'dropzone-active' : ''

  return (
    <div className="space-y-3" ref={containerRef}>
      <div
        {...getRootProps()}
        className={`
          dropzone-frame p-7 text-center cursor-pointer
          ${stateClass}
          ${loading ? 'opacity-60 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {loading ? (
            <Loader2 className="w-9 h-9 text-ww-cyan animate-spin" />
          ) : (
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 border border-ww-cyan/30 rotate-45" />
              <Upload className="w-5 h-5 text-ww-cyan relative" />
            </div>
          )}
          <div>
            <p className="text-ww-text font-display font-semibold uppercase tracking-[0.15em] text-sm">
              {loading ? 'Extracting Stats' : 'Drop Echo Screenshot'}
            </p>
            <p className="text-ww-muted text-xs mt-1">
              {loading ? 'OCR pipeline reading image…' : 'Click to browse · JPG · PNG · WEBP'}
            </p>
          </div>
        </div>
      </div>

      {/* Paste hint */}
      {!loading && (
        <div className={`
          flex items-center justify-center gap-2 py-1.5 px-3 rounded-md border transition-all duration-150 text-[11px] font-display uppercase tracking-wider
          ${pasteHighlight
            ? 'border-ww-accent text-ww-accent bg-ww-accent/10 shadow-glow-gold'
            : 'border-ww-border text-ww-muted'}
        `}>
          <Clipboard className="w-3 h-3" />
          <span>
            Paste from clipboard{' '}
            <kbd className="bg-ww-border-glow text-ww-text text-[10px] px-1.5 py-0.5 rounded font-mono ml-1">Ctrl+V</kbd>
          </span>
        </div>
      )}
    </div>
  )
}
