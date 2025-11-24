import React, { useState } from "react";
import InputPanel from "./components/InputPanel";
import GraphVisualization from "./components/GraphVisualization";
import { analyzeText } from "./utils/api";
import "./App.css";

function App() {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleAnalyze = async (formData) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await analyzeText(formData);
      setGraphData(result.analysis_result);
      setSuccessMessage("Analysis completed successfully!");
    } catch (err) {
      setError(err.message || "Error processing analysis");
      setGraphData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setGraphData(null);
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="app-container">
      <InputPanel
        onAnalyze={handleAnalyze}
        loading={loading}
        onClear={handleClear}
      />
      <GraphVisualization
        data={graphData}
        loading={loading}
        error={error}
        successMessage={successMessage}
      />
    </div>
  );
}

export default App;
