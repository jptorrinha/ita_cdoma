"""Extrai figuras das fontes locais; preserva os dados e traduz os rótulos."""

from pathlib import Path
from zipfile import ZipFile
import io

import fitz
from PIL import Image


HERE = Path(__file__).resolve().parent
LESSON = HERE.parent
FIGURES = HERE / "figures"
FIGURES.mkdir(exist_ok=True)


def paper_figure(page_number, clip, replacements, filename):
    source = fitz.open(LESSON / "data" / "Damage Propagation Modeling.pdf")
    working = fitz.open()
    working.insert_pdf(source, from_page=page_number - 1, to_page=page_number - 1)
    page = working[0]
    for rectangle, text, size, rotation in replacements:
        page.add_redact_annot(fitz.Rect(rectangle), fill=False)
    page.apply_redactions(images=0, graphics=0)
    for rectangle, text, size, rotation in replacements:
        result = page.insert_textbox(
            fitz.Rect(rectangle), text, fontsize=size, fontname="helv",
            rotate=rotation, align=1, color=(0, 0, 0),
        )
        if result < 0:
            raise ValueError((filename, text, result))
    output = fitz.open()
    rectangle = fitz.Rect(clip)
    target = output.new_page(width=rectangle.width, height=rectangle.height)
    target.show_pdf_page(target.rect, working, 0, clip=rectangle)
    output.save(FIGURES / filename, garbage=4, deflate=True)
    output.close()
    working.close()
    source.close()


def amanda_image(filename):
    with ZipFile(LESSON / "slides_defesa_ITA_Amanda.pptx") as source:
        return source.read("ppt/media/" + filename)


def amanda_figure(image_name, replacements, filename, padding=0):
    data = amanda_image(image_name)
    width, height = Image.open(io.BytesIO(data)).size
    output = fitz.open()
    page = output.new_page(width=width + 2 * padding, height=height + 2 * padding)
    page.insert_image(fitz.Rect(padding, padding, width + padding, height + padding), stream=data)
    for rectangle, text, size, rotation in replacements:
        box = fitz.Rect(rectangle)
        box += (padding, padding, padding, padding)
        page.draw_rect(box, color=None, fill=(1, 1, 1), overlay=True)
        if text:
            font = fitz.Font("helv")
            length = font.text_length(text, fontsize=size)
            space = box.height if rotation == 90 else box.width
            if length > space:
                raise ValueError((filename, text, length, space))
            offset = (font.ascender + font.descender) * size
            if rotation == 90:
                origin = (box.x0 + (box.width + offset) / 2,
                          box.y1 - (box.height - length) / 2)
            else:
                origin = (box.x0 + (box.width - length) / 2,
                          box.y0 + (box.height + offset) / 2)
            page.insert_text(origin, text, fontsize=size, fontname="helv",
                             rotate=rotation, color=(0, 0, 0))
    output.save(FIGURES / filename, garbage=4, deflate=True)
    output.close()


if __name__ == "__main__":
    paper_figure(
        5, (321, 57, 554, 161),
        [
            ((350, 58, 538, 70), "Parâmetro de eficiência de um motor", 7, 0),
            ((320, 70, 335, 146), "Perda de eficiência (%)", 6.5, 90),
            ((379, 148, 511, 161), "Tempo (ciclos)", 7, 0),
        ],
        "artigo_oscilacoes.pdf",
    )
    paper_figure(
        7, (65, 332, 286, 488),
        [
            ((145, 476, 230, 487), "Perda de eficiência (%)", 5, 0),
            ((66, 359, 78, 447), "Perda de vazão (%)", 5, 90),
            ((115, 361, 163, 395), "Região de\nfalha", 8, 0),
        ],
        "artigo_limite_falha.pdf",
    )
    # As curvas e pontos são imagens da defesa, sem reconstrução dos resultados.
    amanda_figure(
        "image12.png",
        [
            ((170, 20, 365, 48), "Sensor T50", 20, 0),
            ((170, 49, 365, 77), "Média móvel", 20, 0),
            ((170, 78, 365, 106), "Limite superior", 20, 0),
            ((170, 107, 365, 135), "Limite inferior", 20, 0),
            ((170, 136, 365, 164), "P detectado", 20, 0),
            ((510, 704, 990, 736), "Tempo (ciclos)", 24, 0),
            ((0, 220, 32, 490), "Temperatura (°R)", 24, 90),
        ],
        "amanda_deteccao_p.pdf",
    )
    for image_name, title, filename in [
        ("image30.png", "Antes da margem", "amanda_rul_antes.pdf"),
        ("image31.png", "Após a margem (q = 0,80)", "amanda_rul_depois.pdf"),
    ]:
        height = Image.open(io.BytesIO(amanda_image(image_name))).height
        shift = 9 if image_name == "image31.png" else 0
        amanda_figure(
            image_name,
            [
                ((0, -10, 651, 19 + shift), title, 22, 0),
                ((88, 27 + shift, 207, 42 + shift), "Superestimação", 11, 0),
                ((88, 44 + shift, 207, 58 + shift), "Previsão exata", 11, 0),
                ((88, 60 + shift, 207, 74 + shift), "RUL menor/igual", 11, 0),
                ((88, 77 + shift, 207, 92 + shift), "Superestimação", 11, 0),
                ((0, 180, 23, height - 195), "RUL prevista (ciclos)", 23, 90),
                ((170, height - 28, 494, height), "RUL verdadeira (ciclos)", 23, 0),
            ],
            filename,
            padding=20,
        )
    print("Cinco figuras preparadas com rótulos em português.")
