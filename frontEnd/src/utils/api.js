const BACKEND_URL = "http://localhost:8000";

const API_URL = "/api";

export async function analyzeText(formData) {
  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Erro ao conectar com backend");
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

export async function getAnalysisText() {
  try {
    const response = await fetch(`${API_URL}/analysis/text`, {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Erro ao buscar texto");
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}
