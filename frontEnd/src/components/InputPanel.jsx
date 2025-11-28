import React, { useState } from "react";
import "./InputPanel.css";

const DEFAULT_STOPWORDS = [
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "been",
  "be",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "should",
  "could",
  "may",
  "might",
  "can",
  "must",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "what",
  "which",
  "who",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "only",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "not",
  "no",
];

const PRESET_PATTERNS = [
  { name: "X and Y", pattern: "(\\w+)\\s+(and)\\s+(\\w+)" },
  { name: "X 's Y", pattern: "(\\w+)'s\\s+(\\w+)" },
  { name: "X of Y", pattern: "(\\w+)\\s+(of)\\s+(\\w+)" },
  { name: "X is Y", pattern: "(\\w+)\\s+(is)\\s+(\\w+)" },
  { name: "X at Y", pattern: "(\\w+)\\s+(at)\\s+(\\w+)" },
  { name: "X to Y", pattern: "(\\w+)\\s+(to)\\s+(\\w+)" },
  { name: "X with Y", pattern: "(\\w+)\\s+(with)\\s+(\\w+)" },
];

const SAMPLE_TEXT = `The quick brown fox jumps over the lazy dog. 
The brown dog was quick and lazy. 
A quick and fast fox jumped over the fence.
The lazy dog and quick fox played together.
The fox was quick,brown, and clever.`;

function InputPanel({ onAnalyze, loading, onClear }) {
  const [textInput, setTextInput] = useState("");
  const [file, setFile] = useState(null);
  const [linkingType, setLinkingType] = useState("orthographic");
  const [pattern, setPattern] = useState("(\\w+)\\s+(and)\\s+(\\w+)");
  const [maxNodes, setMaxNodes] = useState(100);
  const [analysisType, setAnalysisType] = useState("spacy");

  const [hiddenWords, setHiddenWords] = useState([]);
  const [wordFilterInput, setWordFilterInput] = useState("");
  const [hideDefaultStopwords, setHideDefaultStopwords] = useState(false);

  const handleAddHiddenWord = () => {
    const word = wordFilterInput.trim().toLowerCase();
    if (word && !hiddenWords.includes(word)) {
      setHiddenWords([...hiddenWords, word]);
      setWordFilterInput("");
    }
  };

  const handleRemoveHiddenWord = (word) => {
    setHiddenWords(hiddenWords.filter((w) => w !== word));
  };

  const handleWordFilterKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddHiddenWord();
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setTextInput("");
    }
  };

  const handleLoadSample = () => {
    setTextInput(SAMPLE_TEXT);
    setFile(null);
  };

  const handleProcess = async () => {
    if (!textInput && !file) {
      alert("Por favor, forneça texto ou arquivo");
      return;
    }

    const formData = new FormData();

    if (file) {
      formData.append("file", file);
    } else if (textInput) {
      formData.append("text_content", textInput);
    }

    formData.append("linking_type", linkingType);
    if (linkingType === "syntactic") {
      formData.append("analysis_type", analysisType);
    }
    if (linkingType === "orthographic") {
      formData.append("pattern", pattern);
    }
    formData.append("max_nodes", maxNodes);

    const allHiddenWords = hideDefaultStopwords
      ? [...DEFAULT_STOPWORDS, ...hiddenWords]
      : hiddenWords;

    formData.append("hidden_words", JSON.stringify(allHiddenWords));

    onAnalyze(formData);
  };

  const handleClearAll = () => {
    setTextInput("");
    setFile(null);
    setLinkingType("orthographic");
    setPattern("(\\w+)\\s+(and)\\s+(\\w+)");
    setAnalysisType("typeA");
    setMaxNodes(100);
    setHiddenWords([]);
    setWordFilterInput("");
    setHideDefaultStopwords(false);
    onClear();
  };

  return (
    <div className="input-panel">
      <h1> Phrase Nets Analyzer</h1>

      <div className="input-section">
        <label>📝 File or Text</label>
        <textarea
          value={textInput}
          onChange={(e) => {
            setTextInput(e.target.value);
            setFile(null);
          }}
          placeholder="Paste your text here..."
          className="text-input"
          rows="6"
        />
        <div className="button-row">
          <label className="btn btn-file">
            📁 Send File
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileChange}
              hidden
            />
          </label>
          <button className="btn btn-secondary" onClick={handleLoadSample}>
            📋 Load Example
          </button>
        </div>
        {file && <p className="file-name">✓ File: {file.name}</p>}
      </div>

      <div className="input-section">
        <label>🔀 View Type</label>
        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              value="orthographic"
              checked={linkingType === "orthographic"}
              onChange={(e) => setLinkingType(e.target.value)}
            />
            Orthographic
          </label>
          <label className="radio-label">
            <input
              type="radio"
              value="syntactic"
              checked={linkingType === "syntactic"}
              onChange={(e) => setLinkingType(e.target.value)}
            />
            Syntactic
          </label>
        </div>
      </div>

      {linkingType === "syntactic" && (
        <div className="input-section">
          <label>🧩 Syntactic Library</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                value="spacy"
                checked={analysisType === "spacy"}
                onChange={(e) => setAnalysisType(e.target.value)}
              />
              SpaCy
            </label>
            <label className="radio-label">
              <input
                type="radio"
                value="stanza"
                checked={analysisType === "stanza"}
                onChange={(e) => setAnalysisType(e.target.value)}
              />
              Stanza
            </label>
          </div>
        </div>
      )}

      {linkingType === "orthographic" && (
        <div className="input-section">
          <label>🎯 Pattern</label>
          <div className="pattern-selector">
            <select
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="pattern-dropdown"
            >
              {PRESET_PATTERNS.map((p) => (
                <option key={p.name} value={p.pattern}>
                  {p.name}
                </option>
              ))}
              <option value="">Custom</option>
            </select>
          </div>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Ex: (\\w+)\\s+(and)\\s+(\\w+)"
            className="pattern-input"
          />
        </div>
      )}

      <div className="input-section">
        <label>Max Nodes: {maxNodes}</label>
        <input
          type="range"
          min="10"
          max="500"
          step="10"
          value={maxNodes}
          onChange={(e) => setMaxNodes(parseInt(e.target.value))}
          className="slider"
        />
      </div>

      <div className="input-section hidden-words-section">
        <div className="checkbox-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={hideDefaultStopwords}
              onChange={(e) => setHideDefaultStopwords(e.target.checked)}
            />
            Use Standard Stopwords ({DEFAULT_STOPWORDS.length} words)
          </label>
        </div>

        <div className="word-filter-input-row">
          <input
            type="text"
            value={wordFilterInput}
            onChange={(e) => setWordFilterInput(e.target.value)}
            onKeyPress={handleWordFilterKeyPress}
            placeholder="Type a word and press Enter"
            className="word-filter-input"
          />
          <button
            className="btn-add-hidden-word"
            onClick={handleAddHiddenWord}
            type="button"
          >
            ➕
          </button>
        </div>

        {hiddenWords.length > 0 && (
          <div className="hidden-words-list">
            <div className="hidden-words-label">Custom Words:</div>
            <div className="hidden-words-tags">
              {hiddenWords.map((word) => (
                <span key={word} className="hidden-word-tag">
                  {word}
                  <button
                    className="remove-hidden-word"
                    onClick={() => handleRemoveHiddenWord(word)}
                    type="button"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={handleProcess}
          disabled={loading}
        >
          {loading ? "⏳ Loading..." : "🚀 Analize"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleClearAll}
          disabled={loading}
        >
          🔄 Clean
        </button>
      </div>
    </div>
  );
}

export default InputPanel;
