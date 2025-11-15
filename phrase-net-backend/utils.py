from PyPDF2 import PdfReader
import io
import mimetypes
from typing import IO

async def extract_text_from_source(file_stream: IO[bytes], filename: str) -> str:
    
    # Guess the file's MIME type based on the extension
    mime_type, _ = mimetypes.guess_type(filename)

    if mime_type == 'application/pdf':
        # PDF to Text Conversion
        try:
            reader = PdfReader(file_stream)
            text = ""
            for page in reader.pages:
                # Use .extract_text() and default to empty string if extraction fails on a page
                text += page.extract_text() or ""
            return text
        except Exception as e:
            # Raise a specific IOError for front-end handling
            raise IOError("Could not extract text from the PDF file.")

    elif mime_type == 'text/plain' or filename.endswith('.txt'):
        # Reading a TXT file
        try:
            # Assumes the file is UTF-8 encoded
            return file_stream.read().decode('utf-8')
        except Exception as e:
            # Raise a specific IOError for front-end handling
            raise IOError("Could not read the TXT file.")
    
    else:
        # Unsupported file type
        raise ValueError(f"Unsupported file type: {mime_type} or {filename}")