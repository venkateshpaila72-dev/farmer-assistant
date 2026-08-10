import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Volume2, VolumeX, Type, Languages, HelpCircle } from "lucide-react";
import { LANGUAGE_OPTIONS } from "../i18n";
import { speakText, stopSpeaking } from "../utils/speak";

export default function AccessibilityBar() {
    const { t, i18n } = useTranslation();
    const [largeText, setLargeText] = useState(() => localStorage.getItem("large-text") === "true");
    const [speechMode, setSpeechMode] = useState(() => localStorage.getItem("speech-mode") === "true");
    const [showLanguages, setShowLanguages] = useState(false);

    // Toggle large text style on body
    useEffect(() => {
        if (largeText) {
            document.body.classList.add("accessibility-large-text");
        } else {
            document.body.classList.remove("accessibility-large-text");
        }
        localStorage.setItem("large-text", largeText);
    }, [largeText]);

    // Speech Mode listener
    useEffect(() => {
        localStorage.setItem("speech-mode", speechMode);
        if (!speechMode) {
            stopSpeaking();
            return;
        }

        // Function to speak when an element is hovered
        const handleMouseOver = (e) => {
            // Find closest read-me element
            const readMe = e.target.closest(".read-me");
            if (readMe && readMe.dataset.readText !== readMe.textContent) {
                // Cache text
                const text = readMe.innerText || readMe.textContent;
                // Avoid speaking empty or short control elements unless requested
                if (text && text.trim().length > 1) {
                    speakText(text.trim());
                }
            }
        };

        const handleClick = (e) => {
            const readMe = e.target.closest(".read-me");
            if (readMe) {
                const text = readMe.innerText || readMe.textContent;
                if (text) speakText(text.trim());
            }
        };

        document.addEventListener("mouseover", handleMouseOver);
        document.addEventListener("click", handleClick);

        return () => {
            document.removeEventListener("mouseover", handleMouseOver);
            document.removeEventListener("click", handleClick);
            stopSpeaking();
        };
    }, [speechMode]);

    const handleLangChange = (code) => {
        i18n.changeLanguage(code);
        setShowLanguages(false);

        // Announce language change
        const selectedOption = LANGUAGE_OPTIONS.find(o => o.code === code);
        if (speechMode && selectedOption) {
            setTimeout(() => {
                speakText(`Language changed to ${selectedOption.label}`);
            }, 500);
        }
    };

    const handleTutorial = () => {
        speakText("Welcome to Farmer Assistant. Press the speaker button to turn on voice descriptions. Move your finger or mouse over any card to listen. Press the letter A button to make text larger. Select your language from the map or list.");
    };

    return (
        <div className="accessibility-bar">
            <div style={{ display: "flex", gap: "var(--spacing-md)", alignItems: "center" }}>
                {/* Voice Read Aloud Toggle */}
                <button
                    className={`option-pill ${speechMode ? "active" : ""}`}
                    onClick={() => setSpeechMode(!speechMode)}
                    title="Toggle Read Aloud"
                    style={{ transition: "all 0.2s" }}
                >
                    {speechMode ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    <span className="read-me">Voice Reader: {speechMode ? "ON" : "OFF"}</span>
                </button>

                {/* Text Scaling Toggle */}
                <button
                    className={`option-pill ${largeText ? "active" : ""}`}
                    onClick={() => setLargeText(!largeText)}
                    title="Toggle Large Text Size"
                >
                    <Type size={18} />
                    <span className="read-me">Large Text: {largeText ? "ON" : "OFF"}</span>
                </button>

                {/* Quick Voice Tour */}
                <button
                    className="option-pill"
                    onClick={handleTutorial}
                    title="Voice Guide"
                >
                    <HelpCircle size={18} />
                    <span className="read-me">Voice Guide</span>
                </button>
            </div>

            {/* Language Switch Pannel */}
            <div style={{ position: "relative" }}>
                <button
                    className="option-pill"
                    onClick={() => setShowLanguages(!showLanguages)}
                >
                    <Languages size={18} />
                    <span className="read-me">Language: {LANGUAGE_OPTIONS.find(o => o.code === i18n.language)?.label || "English"}</span>
                </button>

                {showLanguages && (
                    <div style={{
                        position: "absolute",
                        bottom: "100%",
                        right: 0,
                        backgroundColor: "var(--color-primary-dark)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "var(--radius-md)",
                        padding: "var(--spacing-sm)",
                        zIndex: 200,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "var(--spacing-xs)",
                        width: "300px",
                        boxShadow: "0 -4px 10px rgba(0,0,0,0.3)"
                    }}>
                        {LANGUAGE_OPTIONS.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleLangChange(lang.code)}
                                style={{
                                    background: i18n.language === lang.code ? "var(--color-primary-light)" : "transparent",
                                    border: "none",
                                    color: "white",
                                    padding: "6px 12px",
                                    borderRadius: "var(--radius-sm)",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    fontSize: "0.85rem"
                                }}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
