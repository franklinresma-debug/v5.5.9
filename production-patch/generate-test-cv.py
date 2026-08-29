from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


OUTPUT = Path("output/pdf/NurseLink_Lifecycle_Test_CV.pdf")
OUTPUT.parent.mkdir(parents=True, exist_ok=True)


def watermark(canvas: Canvas, document) -> None:
    canvas.saveState()
    canvas.setFillColor(colors.Color(0.82, 0.12, 0.16, alpha=0.10))
    canvas.setFont("Helvetica-Bold", 42)
    canvas.translate(A4[0] / 2, A4[1] / 2)
    canvas.rotate(35)
    canvas.drawCentredString(0, 0, "TEST ONLY - NOT A REAL CREDENTIAL")
    canvas.restoreState()


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="TestBanner",
    parent=styles["Heading1"],
    alignment=TA_CENTER,
    textColor=colors.HexColor("#B91C1C"),
    fontSize=16,
    leading=20,
    spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="Section",
    parent=styles["Heading2"],
    textColor=colors.HexColor("#0B5FA5"),
    fontSize=12,
    leading=15,
    spaceBefore=8,
    spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="BodySmall",
    parent=styles["BodyText"],
    fontSize=9.5,
    leading=13,
))

doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=18 * mm,
    rightMargin=18 * mm,
    topMargin=15 * mm,
    bottomMargin=15 * mm,
    title="NurseLink Lifecycle Test CV",
    author="NurseLink automated lifecycle validation",
)

story = [
    Paragraph("SYNTHETIC TEST DOCUMENT", styles["TestBanner"]),
    Paragraph(
        "This document contains fictional data created solely to validate the NurseLink membership workflow. "
        "It is not evidence of identity, education, licensure, employment, or professional standing.",
        styles["BodySmall"],
    ),
    Spacer(1, 8),
    Table(
        [
            ["Applicant", "NurseLink Lifecycle Test"],
            ["Document type", "Synthetic CV / workflow test fixture"],
            ["Professional title", "Registered Nurse - Test Record"],
            ["Specialty", "General Nursing - Test Record"],
            ["Country", "Philippines"],
        ],
        colWidths=[42 * mm, 120 * mm],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EAF3FA")),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#173253")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9.5),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#C9D8E6")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]),
    ),
    Paragraph("Professional Summary", styles["Section"]),
    Paragraph(
        "Fictional nursing applicant used for end-to-end software testing. No clinical duties, employers, "
        "patients, licenses, or real institutions are represented by this record.",
        styles["BodySmall"],
    ),
    Paragraph("Education", styles["Section"]),
    Paragraph(
        "Bachelor of Science in Nursing - Synthetic Test University - 2020 (fictional)",
        styles["BodySmall"],
    ),
    Paragraph("Experience", styles["Section"]),
    Paragraph(
        "Workflow Test Nurse - Synthetic Test Hospital - 2020 to 2025 (fictional)<br/>"
        "Used exclusively to verify data extraction, applicant review, submission, and administrative lifecycle transitions.",
        styles["BodySmall"],
    ),
    Paragraph("Licensure", styles["Section"]),
    Paragraph(
        "No real license. Test reference: TEST-NL-0001. This reference must never be treated as a professional credential.",
        styles["BodySmall"],
    ),
    Spacer(1, 12),
    Paragraph(
        "END OF SYNTHETIC TEST DOCUMENT - DELETE OR ARCHIVE WITH THE TEST APPLICATION AFTER VALIDATION",
        ParagraphStyle(
            "FooterWarning",
            parent=styles["BodySmall"],
            alignment=TA_CENTER,
            textColor=colors.HexColor("#B91C1C"),
            fontName="Helvetica-Bold",
        ),
    ),
]

doc.build(story, onFirstPage=watermark, onLaterPages=watermark)
print(OUTPUT.resolve())
