import { useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { cn } from "../../utils/cn";

export function ImageUpload({ onFileSelect, disabled, label }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setFileName(file.name);
    onFileSelect(file);
  }

  function clear() {
    setPreview(null);
    setFileName("");
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

      {preview ? (
        <div className="relative">
          <img src={preview} alt="" className="w-full max-h-72 object-cover rounded-md border border-border" />
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-ink/70 text-white flex items-center justify-center"
          >
            <X size={16} />
          </button>
          <p className="text-xs text-ink-soft mt-2 truncate">{fileName}</p>
        </div>
      ) : (
        <label
          htmlFor="image-upload-input"
          className={cn(
            "flex flex-col items-center justify-center gap-2.5 border-2 border-dashed border-border rounded-md py-10 px-6 text-center cursor-pointer transition-colors duration-150 hover:border-primary hover:bg-primary-tint/40",
            disabled && "opacity-50 pointer-events-none"
          )}
        >
          <span className="w-11 h-11 rounded-full bg-primary-tint text-primary flex items-center justify-center">
            <Camera size={20} />
          </span>
          <span className="text-sm font-semibold text-ink">{label}</span>
          <span className="text-xs text-ink-soft flex items-center gap-1">
            <ImagePlus size={13} /> JPEG, PNG or WEBP
          </span>
        </label>
      )}
    </div>
  );
}