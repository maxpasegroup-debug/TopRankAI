import io
import re
import sys

from pypdf import PdfReader


def clean(value: str) -> str:
    # Some NTA PDFs map glyphs into the surrogate range; UTF-8 cannot store them.
    return re.sub(r"[\ud800-\udfff]", " ", value)


def main() -> None:
    source, target = sys.argv[1], sys.argv[2]
    reader = PdfReader(io.BytesIO(sys.stdin.buffer.read()) if source == "-" else source)
    pages = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            pages.append(clean(page.extract_text() or ""))
        except Exception as error:
            raise RuntimeError(f"Could not extract page {index}") from error
    document = "\n\n".join(pages)
    if target == "-":
        sys.stdout.buffer.write(document.encode("utf-8"))
    else:
        with open(target, "w", encoding="utf-8") as handle:
            handle.write(document)


if __name__ == "__main__":
    main()
