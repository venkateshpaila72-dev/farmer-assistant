import { Select } from "../../../components/ui/Select";

const LANGUAGES = ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Marathi", "Bengali", "Punjabi"];

export function LanguageStep({ value, onChange }) {
  return (
    <div>
      <h2 className="text-xl mb-1">Which language should we chat in?</h2>
      <p className="text-sm text-ink-soft mb-5">Used for your WhatsApp reports and the chat assistant.</p>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </Select>
    </div>
  );
}