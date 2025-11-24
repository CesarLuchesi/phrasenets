from PyPDF2 import PdfReader
import io
import mimetypes
from typing import IO


async def extract_text_from_source(file_stream: IO[bytes], filename: str) -> str:

    mime_type, _ = mimetypes.guess_type(filename)

    if mime_type == "application/pdf":
        try:
            reader = PdfReader(file_stream)
            text = ""
            for page in reader.pages:

                text += page.extract_text() or ""
            return text
        except Exception as e:
            raise IOError("Could not extract text from the PDF file.")

    elif mime_type == "text/plain" or filename.endswith(".txt"):

        try:
            return file_stream.read().decode("utf-8")
        except Exception as e:
            raise IOError("Could not read the TXT file.")

    else:
        raise ValueError(f"Unsupported file type: {mime_type} or {filename}")
