from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt


BG = RGBColor(0xF4, 0xF7, 0xF5)
INK = RGBColor(0x13, 0x25, 0x2F)
MUTED = RGBColor(0x5B, 0x6B, 0x73)
ACCENT = RGBColor(0x00, 0x78, 0x6B)
CARD = RGBColor(0xFF, 0xFF, 0xFF)
MONO = "Courier New"
TITLE = "Trebuchet MS"
BODY = "Aptos"


prs = Presentation()
prs.slide_width = Inches(13.33)
prs.slide_height = Inches(7.5)
blank = prs.slide_layouts[6]


def slide():
    s = prs.slides.add_slide(blank)
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = BG
    return s


def text(s, x, y, w, h, value, size=20, bold=False, color=INK,
         align=PP_ALIGN.LEFT, font=BODY):
    box = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = value
    p.font.size = Pt(size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.font.name = font
    p.alignment = align
    return box


def card(s, x, y, w, h, title, body, accent=False):
    shape = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.adjustments[0] = 0.08
    shape.fill.solid()
    shape.fill.fore_color.rgb = CARD
    shape.line.color.rgb = ACCENT if accent else RGBColor(0xD9, 0xE2, 0xE0)
    shape.line.width = Pt(1.5)
    tf = shape.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = ACCENT if accent else INK
    p.font.name = TITLE
    p2 = tf.add_paragraph()
    p2.text = body
    p2.font.size = Pt(14)
    p2.font.color.rgb = INK
    p2.font.name = BODY
    return shape


def heading(s, title, number):
    text(s, 0.7, 0.4, 11.6, 0.65, title, 38, True, INK, font=TITLE)
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.25), Inches(1.0), Inches(0.08))
    bar.fill.solid()
    bar.fill.fore_color.rgb = ACCENT
    bar.line.fill.background()
    text(s, 11.9, 6.95, 0.7, 0.25, f"{number}/8", 11, False, MUTED, PP_ALIGN.RIGHT)


def footer(s):
    text(s, 0.7, 6.95, 9.5, 0.25, "Cardano Risk Analyst | Sokosumi + Masumi", 11, False, MUTED)


s = slide()
text(s, 0.8, 1.55, 11.7, 1.0, "Should I interact with this", 34, True, INK, PP_ALIGN.CENTER, TITLE)
text(s, 0.8, 2.55, 11.7, 1.0, "Cardano contract?", 34, True, ACCENT, PP_ALIGN.CENTER, TITLE)
text(s, 1.8, 4.0, 9.7, 0.65, "One paid Coworker for control, code safety, and getting in and out.", 20, False, INK, PP_ALIGN.CENTER)
text(s, 0.7, 6.95, 11.9, 0.25, "1/8", 11, False, MUTED, PP_ALIGN.RIGHT)

s = slide(); heading(s, "The decision comes before the swap", 2)
text(s, 0.7, 1.65, 11.8, 0.6, "Tokens, pools, lending markets, escrows, and Plutus scripts use the same decision.", 23)
card(s, 0.7, 2.65, 3.75, 2.2, "Who controls it", "Policy, admin key, age, protocol identity, holders", True)
card(s, 4.8, 2.65, 3.75, 2.2, "Is the code safe", "Script type, size, source review when public")
card(s, 8.9, 2.65, 3.75, 2.2, "Can you get in and out", "TVL, UTxOs, transactions, liquidity, Settlement Desk")
footer(s)

s = slide(); heading(s, "One deterministic report", 3)
text(s, 0.7, 1.65, 11.8, 0.6, "The language model writes the memo. Fixed rules decide the verdict.", 23)
steps = [("01", "Resolve", "token, address, hash, or repo"), ("02", "Gather", "Koios, protocol data, registry"), ("03", "Score", "interaction findings"), ("04", "Explain", "facts with source calls")]
for i, (num, title, body) in enumerate(steps):
    x = 0.7 + i * 3.1
    card(s, x, 2.7, 2.7, 2.5, f"{num}  {title}", body, i == 3)
footer(s)

s = slide(); heading(s, "What the chain contributes", 4)
rows = [
    ("Koios mainnet", "asset facts, policy script, holder addresses, transactions"),
    ("Minswap", "pool pairs and ADA TVL for practical exit context"),
    ("Cardano token registry", "identity metadata and registry presence"),
    ("Masumi MPS", "Task lifecycle and preprod escrow settlement"),
]
for i, (title, body) in enumerate(rows):
    card(s, 0.7, 1.75 + i * 1.12, 11.9, 0.82, title, body, i == 3)
footer(s)

s = slide(); heading(s, "Verdicts answer a narrow question", 5)
card(s, 0.7, 1.85, 3.75, 3.2, "INTERACT", "No high finding and fewer than two medium findings.", True)
card(s, 4.8, 1.85, 3.75, 3.2, "INTERACT WITH CONDITIONS", "Medium findings need a buyer decision before signing.")
card(s, 8.9, 1.85, 3.75, 3.2, "DO NOT INTERACT", "A high finding is present, such as a single admin key.")
text(s, 0.7, 5.55, 11.9, 0.5, "Every finding carries an exact value and the source call that produced it.", 18, True, INK, PP_ALIGN.CENTER)
footer(s)

s = slide(); heading(s, "The buyer sees evidence, not a score", 6)
text(s, 0.7, 1.65, 11.8, 0.6, "A memo stays useful when the numbers can be traced back to the report.", 23)
card(s, 0.7, 2.55, 5.7, 2.8, "Memo sections", "Verdict\nWhat this token is\nWho controls minting\nWho holds it\nCan you exit\nRed flags\nSources", True)
code = card(s, 6.8, 2.55, 5.8, 2.8, "Report shape", "unit + policy + supply\nholders + liquidity + activity\nfindings[] + verdict\nsources[]", False)
code.text_frame.paragraphs[1].font.name = MONO
footer(s)

s = slide(); heading(s, "Hire it where the work gets paid", 7)
text(s, 0.7, 1.7, 11.8, 0.6, "Sokosumi discovery starts the Task. Masumi escrow releases payment to the seller wallet after completion.", 22)
for i, (title, body) in enumerate([
    ("Hire", "Choose Cardano Risk Analyst\nCoworker: 01a11080-a6c3-7686-abf4-b0d1594cb82b"),
    ("Run", "Submit a token string as the Task input"),
    ("Settle", "Receive memo + JSON and a preprod payout"),
]):
    card(s, 0.7 + i * 4.1, 2.8, 3.6, 2.1, title, body, i == 2)
footer(s)

s = slide(); heading(s, "Live proof and next action", 8)
text(s, 0.7, 1.75, 11.8, 0.6, "Run the CLI, open the report, or hire either Coworker.", 24, True)
card(s, 0.7, 2.7, 5.7, 2.35, "Try a token", "bun engine/cli.ts MIN\nbun engine/cli.ts SNEK\n\nEach command prints the JSON report used by the memo.", True)
card(s, 6.8, 2.7, 5.8, 2.35, "Security gate", "Aiken Security Reviewer\nagent-to-agent Masumi hire\nlive scan produces candidates\nexploit test must pass", False)
footer(s)

s = slide(); heading(s, "Live verdicts and holder evidence", 9)
card(s, 0.7, 1.8, 3.75, 2.8, "MIN · HIGH", "Native mint policy\n1 required signer\nNo time lock\nBlockfrost top-100 sample flagged", True)
card(s, 4.8, 1.8, 3.75, 2.8, "SNEK · LOW", "Timelocked native policy\nLargest 88 holder addresses sampled\nTop 1: 2.39%\nTop 10: 6.57%")
card(s, 8.9, 1.8, 3.75, 2.8, "Live scanner", "Aiken source\nCandidates and attack tests\nPassing exploit tests only\nRule + file + line evidence", False)
text(s, 0.7, 5.35, 11.9, 0.65, "The Risk Analyst hires the Aiken Security Reviewer through Masumi escrow when a public script needs an exploit-gated review.", 18, True, INK, PP_ALIGN.CENTER)
footer(s)

out = Path(__file__).parent / "cardano-risk-analyst.pptx"
prs.save(out)
print(out)
