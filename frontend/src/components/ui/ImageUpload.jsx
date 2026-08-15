import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, ImagePlus, X, RefreshCw, UploadCloud } from "lucide-react";
import { cn } from "../../utils/cn";

const easeOut = [0.16, 1, 0.3, 1];

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageUpload({ onFileSelect, disabled, label }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  function applyFile(file) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setFileName(file.name);
    setFileSize(file.size);
    onFileSelect(file);
  }

  function handleFile(e) {
    applyFile(e.target.files?.[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    applyFile(e.dataTransfer.files?.[0]);
  }

  function clear() {
    setPreview(null);
    setFileName("");
    setFileSize(0);
    if (inputRef.current) inputRef.current.value = "";
    onFileSelect(null);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg,image/webp"
        capture="environment"
        onChange={handleFile}
        disabled={disabled}
        className="hidden"
        id="image-upload-input"
      />

      <AnimatePresence mode="wait" initial={false}>
        {preview ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: easeOut }}
            className="relative rounded-md overflow-hidden border border-border"
          >
            <img src={preview} alt="" className="w-full max-h-80 object-cover" />
            {/* Gradient info bar instead of a bare filename caption below the image */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent px-4 pt-8 pb-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{fileName}</p>
                {fileSize > 0 && <p className="text-white/70 text-xs">{formatSize(fileSize)}</p>}
              </div>
              <label
                htmlFor="image-upload-input"
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-full px-3 py-1.5 cursor-pointer transition-colors",
                  disabled && "opacity-50 pointer-events-none"
                )}
              >
                <RefreshCw size={12} /> Change
              </label>
            </div>
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              aria-label="Remove photo"
              className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-ink/60 hover:bg-ink/80 text-white flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        ) : (
          <motion.label
            key="empty"
            htmlFor="image-upload-input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled) setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-md py-12 px-6 text-center cursor-pointer transition-colors duration-150",
              dragActive ? "border-primary bg-primary-tint" : "border-border hover:border-primary hover:bg-primary-tint/40",
              disabled && "opacity-50 pointer-events-none"
            )}
          >
            <motion.span
              className="w-12 h-12 rounded-full bg-primary-tint text-primary flex items-center justify-center"
              animate={dragActive ? { scale: 1.12 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              {dragActive ? <UploadCloud size={22} /> : <Camera size={22} />}
            </motion.span>
            <span className="text-sm font-semibold text-ink">{label}</span>
            <span className="text-xs text-ink-soft flex items-center gap-1">
              <ImagePlus size={13} /> JPEG, PNG or WEBP &middot; drag &amp; drop or tap
            </span>
          </motion.label>
        )}
      </AnimatePresence>
    </div>
  );
}