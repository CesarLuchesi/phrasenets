#  phrasenets: Software Visualization with a Phrase Nets Technique

Phrase Nets is a novel technique for generating visual overviews of **unstructured text**. It creates a **network graph** where **words act as the nodes** and **edges** represent a specific, user-defined relationship, offering a higher level of analysis than looking at individual terms.

---

## Key Features and Methodology

The Phrase Nets technique relies on three core phases to transform raw text into a clear visualization:

### 1. Linking (Establishing Relationships)

Edges are established between nodes (words) using one of two methods, chosen by the user:

* **Orthographic Linking:** Rapid linking based on **simple pattern matching** (e.g., regular expressions).
* **Syntactic Linking:** Detailed linking based on **grammatical structure** and syntactic dependency analysis (using Stanford NLP's Stanza).

### 2. Network Filtering

Reduces the initial graph to include only the most **relevant nodes** and connections, improving focus.

### 3. Edge Compression

Ensures the resulting map is readable and uncluttered. This technique simplifies the graph by collapsing sets of **topologically equivalent nodes** into single **supernodes**.

---

## Installation and Setup

This project requires both **Python** (for the FastAPI backend and analysis) and **Node.js/Yarn** (for the frontend development environment). It's recommended to start within a virtual environment.

### 1. Python Backend Dependencies

You can install all necessary Python packages manually or using `requirements.txt`.

#### A. Manual Installation for Virtual Environment
| Package | Purpose | Installation Command |
| :--- | :--- | :--- |
| **FastAPI** & **Uvicorn** | Web framework and server for the REST API. | `pip install fastapi uvicorn` |
| **python-multipart** | Required for handling file uploads (PDF/TXT). | `pip install python-multipart` |
| **Stanza** (Stanford NLP) | Provides syntactic analysis for **Syntactic Linking**. | `pip install stanza` |
| **NetworkX** | Essential for graph manipulation, Filtering, and **Edge Compression**. | `pip install networkx` |
| **PyPDF2** | Tool used to extract raw text from PDF files. | `pip install pypdf2` |

#### B. Quick Install (Using `requirements.txt`)
```bash
pip install -r requirements.txt
````

#### C. Stanza Language Model Setup

After installation, you **must** download the English language model:

```bash
python -c "import stanza; stanza.download('en')"
```

### 2\. Frontend Dependencies (Yarn/NPM)

To run the visualization in development mode:

```bash
npm install
```
-----

## Backend File Structure

The application's backend is modularly divided into three core files:

| File | Role | Description and Functionality |
| :--- | :--- | :--- |
| **`main.py`** | **API & Initialization** | The application's entry point. Defines the FastAPI server, the main `/analyze` route, handles input validation (file/text, linking parameters), and orchestrates the call to the core analysis logic. |
| **`phrase_net_core.py`** | **Core Logic** | The "brain" of the project. Implements the three main phases: **Linking** (`_orthographic_linking` or `_syntactic_linking`), **Network Filtering**, and **Edge Compression**. |
| **`utils.py`** | **Utilities** | Handles data input/output. The primary function, `extract_text_from_source`, reads input data streams, converting content from `.txt` files or `.pdf` files into raw text usable by the core analysis. |

-----

## HOW-TO GUIDE: Running the Application

To successfully execute the Phrase Net application, both the backend API and the frontend development server must be running simultaneously.

### STEP 1: Start the Backend Server (API)

1.  Navigate to your project directory.
2.  Execute the main script to start the **Uvicorn** server:

-----

```bash
python main.py
```

> **Verification:** The terminal should confirm: `Uvicorn running on http://127.0.0.1:8000`

### STEP 2: Start the Frontend Application

1.  Ensure you are in the root directory.
2.  Run the development script using `yarn`:
------

```bash
yarn dev
```

> **Access:** The application should be running, typically accessible at `http://localhost:5173/`.

-----

## Testing with Swagger UI

The interactive Swagger UI documentation is the easiest way to test the core backend functionalities (PDF extraction and Syntactic Linking) before integrating with the frontend.

1.  **Access Docs:** Open your browser to the Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
2.  **Locate Endpoint:** Find and expand the **`POST /analyze`** route. Click **"Try it out"**.

### Test Case A: Syntactic Linking (Text Input)

  * `file`: Leave blank.
  * `text_content`: Enter a sample English sentence (e.g., "The quick brown fox jumps over the lazy dog.")
  * `linking_type`: Set to `syntactic`.
  * `pattern`: Leave blank.
  * `max_nodes`: Set to 20.
  * **Result:** Click **"Execute"**. The response should contain a JSON object with `nodes` and `edges` showing grammatical relationships extracted by Stanza.

### Test Case B: PDF Conversion and Analysis

  * `file`: Click **"Choose File"** and select a small PDF file.
  * `text_content`: Leave blank.
  * `linking_type`: Set to `syntactic` or `orthographic`.
  * `pattern` (if Orthographic): Provide a valid regex (e.g., `(\w+)\s+(and)\s+(\w+)`). If using `syntactic`, leave blank.
  * `max_nodes`: Set to 20.
  * **Result:** Click **"Execute"**. The **Response Code** should be `200`, and the **Response Body** will show the Phrase Net JSON, confirming successful PDF text extraction and processing.
