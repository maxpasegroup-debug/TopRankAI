import re
import sys

from pypdf import PdfReader


def clean(value: str) -> str:
    # Some NTA PDFs map glyphs into the surrogate range; UTF-8 cannot store them.
    return re.sub(r"[\ud800-\udfff]", " ", value)


def main() -> None:
    source, target = sys.argv[1], sys.argv[2]
    reader = PdfReader(source)
    pages = []
    for page in reader.pages:
        try:
            pages.append(clean(page.extract_text() or ""))
        except Exception:
            pages.append("")
    with open(target, "w", encoding="utf-8") as handle:
        handle.write("\n\n".join(pages))


if __name__ == "__main__":
    main()
