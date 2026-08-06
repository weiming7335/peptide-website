from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"


def crop(source: str, output: str, box: tuple[int, int, int, int]) -> None:
    image = Image.open(BRAND / source)
    image.crop(box).save(BRAND / output, optimize=True)


crop("jike-logo-source.png", "jike-logo.png", (190, 275, 1260, 650))
crop("jike-mark-source.png", "jike-mark.png", (350, 250, 1120, 760))
