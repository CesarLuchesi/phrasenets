import React, { useState } from 'react';
import './InputPanel.css';

const PRESET_PATTERNS = [
  { name: 'X and Y', pattern: '(\\w+)\\s+(and)\\s+(\\w+)' },
  { name: "X 's Y", pattern: "(\\w+)'s\\s+(\\w+)" },
  { name: 'X of Y', pattern: '(\\w+)\\s+(of)\\s+(\\w+)' },
  { name: 'X is Y', pattern: '(\\w+)\\s+(is)\\s+(\\w+)' },
  { name: 'X at Y', pattern: '(\\w+)\\s+(at)\\s+(\\w+)' },
  { name: 'X to Y', pattern: '(\\w+)\\s+(to)\\s+(\\w+)' },
  { name: 'X with Y', pattern: '(\\w+)\\s+(with)\\s+(\\w+)' },
];

const SAMPLE_TEXT = `The quick brown fox jumps over the lazy dog. 
The brown dog was quick and lazy. 
A quick and fast fox jumped over the fence.
The lazy dog and quick fox played together.
The fox was quick, brown, and clever.`;

function InputPanel({ onAnalyze, loading, onClear }) {
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState(null);
  const [linkingType, setLinkingType] = useState('orthographic');
  const [selectedPattern, setSelectedPattern] = useState(PRESET_PATTERNS[0].pattern);
  const [customPattern, setCustomPattern] = useState('');
  const [maxNodes, setMaxNodes] = useState(100);
  const [activeTab, setActiveTab] = useState('text');

  const pattern = customPattern || selectedPattern;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setTextInput('');
    }
  };

  const handleTextChange = (e) => {
    setTextInput(e.target.value);
    setFile(null);
  };

  const handleLoadSample = () => {
    setTextInput(SAMPLE_TEXT);
    setFile(null);
    setActiveTab('text');
  };

  const handleProcess = async () => {
    if (!textInput && !file) {
      alert('Por favor, forneça texto ou arquivo');
      return;
    }

    if (linkingType === 'orthographic' && !pattern) {
      alert('Por favor, defina um padrão regex');
      return;
    }

    const formData = new FormData();

    if (file) {
      formData.append('file', file);
    } else if (textInput) {
      formData.append('text_content', textInput);
    }

    formData.append('linking_type', linkingType);
    if (linkingType === 'orthographic') {
      formData.append('pattern', pattern);
    }
    formData.append('max_nodes', maxNodes);

    onAnalyze(formData);
  };

  const handleClearAll = () => {
    setTextInput('');
    setFile(null);
    setLinkingType('orthographic');
    setSelectedPattern(PRESET_PATTERNS[0].pattern);
    setCustomPattern('');
    setMaxNodes(100);
    setActiveTab('text');
    onClear();
  };

  return (
    <div className="input-panel">
      <div className="panel-header">
        <h1>🔗 Phrase Net Analyzer</h1>
        <p>Análise de padrões textuais</p>
      </div>

      {/* TAB NAVIGATION */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
        >
          Texto
        </button>
        <button
          className={`tab-button ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => setActiveTab('file')}
        >
          Arquivo
        </button>
      </div>

      {/* TEXT INPUT */}
      {activeTab === 'text' && (
        <div className="input-section">
          <label>Colar Texto</label>
          <textarea
            value={textInput}
            onChange={handleTextChange}
            placeholder="Cole seu texto aqui..."
            rows={6}
          />
          <div className="char-count">
            {textInput.length} / 5000 caracteres
          </div>
          <button className="btn-secondary" onClick={handleLoadSample}>
            Carregar Texto de Exemplo
          </button>
        </div>
      )}

      {/* FILE INPUT */}
      {activeTab === 'file' && (
        <div className="input-section">
          <label>Upload de Arquivo</label>
          <div className="file-drop-zone">
            <input
              type="file"
              accept=".txt,.pdf"
              onChange={handleFileChange}
              id="file-input"
            />
            <label htmlFor="file-input" className="drop-label">
              Arraste arquivos aqui ou clique para selecionar
            </label>
          </div>
          {file && (
            <div className="file-info">
              📄 {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}
        </div>
      )}

      {/* LINKING TYPE */}
      <div className="input-section">
        <label>Tipo de Ligação</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              value="orthographic"
              checked={linkingType === 'orthographic'}
              onChange={(e) => setLinkingType(e.target.value)}
            />
            Orthographic
          </label>
          <label>
            <input
              type="radio"
              value="syntactic"
              checked={linkingType === 'syntactic'}
              onChange={(e) => setLinkingType(e.target.value)}
            />
            Syntactic
          </label>
        </div>
      </div>

      {/* PATTERN */}
      {linkingType === 'orthographic' && (
        <div className="input-section">
          <label>Padrão Regex</label>
          <select
            value={selectedPattern}
            onChange={(e) => {
              setSelectedPattern(e.target.value);
              setCustomPattern('');
            }}
          >
            {PRESET_PATTERNS.map((p) => (
              <option key={p.pattern} value={p.pattern}>
                {p.name}
              </option>
            ))}
            <option value="">--- Padrão Customizado ---</option>
          </select>
          {selectedPattern === '' && (
            <input
              type="text"
              value={customPattern}
              onChange={(e) => setCustomPattern(e.target.value)}
              placeholder="Ex: (\w+)\s+(and)\s+(\w+)"
              className="custom-pattern-input"
            />
          )}
        </div>
      )}

      {/* MAX NODES */}
      <div className="input-section">
        <label>Máximo de Nós: {maxNodes}</label>
        <input
          type="range"
          min="10"
          max="500"
          value={maxNodes}
          onChange={(e) => setMaxNodes(parseInt(e.target.value))}
        />
      </div>

      {/* ACTION BUTTONS */}
      <div className="button-group">
        <button
          className="btn-primary"
          onClick={handleProcess}
          disabled={loading || (!textInput && !file)}
        >
          {loading ? '⏳ Processando...' : '▶️ Processar'}
        </button>
        <button
          className="btn-secondary"
          onClick={handleClearAll}
          disabled={loading}
        >
          🗑️ Limpar Tudo
        </button>
      </div>
    </div>
  );
}

export default InputPanel;