from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

BG = RGBColor(0xF8, 0xF9, 0xFB)
INK = RGBColor(0x1F, 0x24, 0x2E)
MUTED = RGBColor(0x5A, 0x64, 0x72)
ACCENT = RGBColor(0x46, 0x78, 0xE8)
RULE = RGBColor(0xC9, 0xD1, 0xDD)
GRAPHITE = RGBColor(0x22, 0x27, 0x31)
MONO = "Courier New"
TITLE = "Space Grotesk"
BODY = "Arial"

prs = Presentation()
prs.slide_width = Inches(13.33)
prs.slide_height = Inches(7.5)
blank = prs.slide_layouts[6]


def slide():
    s = prs.slides.add_slide(blank)
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = BG
    return s


def text(s, x, y, w, h, value, size=20, bold=False, color=INK, align=PP_ALIGN.LEFT, font=BODY):
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


def panel(s, x, y, w, h, title, body, accent=False, dark=False):
    shape = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = GRAPHITE if dark else BG
    shape.line.color.rgb = ACCENT if accent else RULE
    shape.line.width = Pt(1.2)
    tf = shape.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(17)
    p.font.bold = True
    p.font.color.rgb = RGBColor(0xF8, 0xF9, 0xFB) if dark else (ACCENT if accent else INK)
    p.font.name = TITLE
    p2 = tf.add_paragraph()
    p2.text = body
    p2.font.size = Pt(13)
    p2.font.color.rgb = RGBColor(0xF8, 0xF9, 0xFB) if dark else INK
    p2.font.name = MONO if dark else BODY
    return shape


def heading(s, title, number):
    text(s, 0.7, 0.45, 11.7, 0.65, title, 34, True, INK, font=TITLE)
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.22), Inches(0.9), Inches(0.07))
    bar.fill.solid()
    bar.fill.fore_color.rgb = ACCENT
    bar.line.fill.background()
    text(s, 11.75, 6.95, 0.85, 0.25, f"{number:02d} / 11", 10, False, MUTED, PP_ALIGN.RIGHT, MONO)


def footer(s):
    text(s, 0.7, 6.95, 9.5, 0.25, "Cardano Risk Analyst  /  x402  /  Sokosumi  /  Masumi", 10, False, MUTED, font=MONO)


s = slide()
text(s, 0.8, 1.45, 11.7, 0.9, "Should my agent pay this", 42, True, INK, PP_ALIGN.CENTER, TITLE)
text(s, 0.8, 2.35, 11.7, 0.9, "Cardano counterparty?", 42, True, ACCENT, PP_ALIGN.CENTER, TITLE)
text(s, 1.65, 3.85, 10.0, 0.6, "Cardano Risk Analyst is the paid preflight check before value moves.", 20, False, INK, PP_ALIGN.CENTER)
text(s, 3.25, 5.25, 6.8, 0.45, "ARROW KEYS TO READ  /  P TO OPEN THE HUMAN UI", 12, True, MUTED, PP_ALIGN.CENTER, MONO)
text(s, 0.7, 6.95, 11.9, 0.25, "01 / 11", 10, False, MUTED, PP_ALIGN.RIGHT, MONO)

s = slide(); heading(s, "The decision comes before the transaction", 2)
text(s, 0.7, 1.65, 11.7, 0.55, "A counterparty is the thing your agent is about to send value into.", 23)
panel(s, 0.7, 2.55, 3.75, 2.2, "Token", "Mint policy, holders, registry identity, pool exit")
panel(s, 4.8, 2.55, 3.75, 2.2, "Script", "Protocol identity, TVL, UTxOs, recent transactions")
panel(s, 8.9, 2.55, 3.75, 2.2, "x402 seller", "PayTo, asset, amount, resource, timeout", True)
text(s, 0.7, 5.45, 11.7, 0.45, "The output is one action: INTERACT, INTERACT WITH CONDITIONS, or DO NOT INTERACT.", 18, True, INK, PP_ALIGN.CENTER)
footer(s)

s = slide(); heading(s, "Three evidence checks become one verdict", 3)
text(s, 0.7, 1.65, 11.7, 0.55, "The report keeps facts and judgment separate.", 23)
panel(s, 0.7, 2.55, 3.75, 2.55, "01  Who controls it", "Mint policy open?\nAdmin key?\nFirst seen when?\nKnown protocol?")
panel(s, 4.8, 2.55, 3.75, 2.55, "02  Is the code safe", "Script type and size\nPublic Aiken source\nExploit test before finding")
panel(s, 8.9, 2.55, 3.75, 2.55, "03  Can you get in and out", "Liquidity for the amount\nTVL, UTxOs, recent txs\nSettlement Desk when paying", True)
footer(s)

s = slide(); heading(s, "Rules stay deterministic", 4)
text(s, 0.7, 1.65, 11.7, 0.55, "The memo can be narrated. The verdict comes from explicit rules.", 23)
panel(s, 0.7, 2.5, 5.7, 2.8, "Assessment shape", "decision\nblockingReasons[]\nconditions[]\nevidence[]\nsubject\ncheckedAt", False, True)
panel(s, 6.8, 2.5, 5.8, 2.8, "Rule examples", "mint policy open  →  blocking\namount above caller cap  →  blocking\nnew payTo  →  condition\nunknown protocol script  →  condition\nnon-HTTPS resource  →  blocking", True)
footer(s)

s = slide(); heading(s, "A paid agent hires the Risk Desk", 5)
text(s, 0.7, 1.65, 11.7, 0.55, "The same Coworker is available to agents, people, and Sokosumi Tasks.", 23)
panel(s, 0.7, 2.65, 3.7, 2.1, "x402", "Agent receives HTTP 402\nPays for a risk check\nReceives the assessment", True)
panel(s, 4.8, 2.65, 3.7, 2.1, "Human UI", "Enter a token or script\nInspect cited evidence\nChoose the next action")
panel(s, 8.9, 2.65, 3.7, 2.1, "Sokosumi", "Hire Cardano Risk Analyst\nTask input is the target\nMasumi tracks the result")
footer(s)

s = slide(); heading(s, "The x402 flow checks the seller before payment", 6)
steps = [("402", "Seller asks", "asset, amount, payTo, resource"), ("01", "Risk check", "x402 pays the Risk Desk"), ("02", "Evidence", "counterparty, asset, request"), ("03", "Decision", "stop or continue"), ("04", "Payment", "only after the verdict")]
for i, (num, title, body) in enumerate(steps):
    x = 0.7 + i * 2.45
    panel(s, x, 2.35, 2.1, 2.55, num, f"{title}\n\n{body}", i == 2)
text(s, 0.7, 5.55, 11.7, 0.45, "Risk Desk is the economic pause between receiving a payment request and signing it.", 18, True, INK, PP_ALIGN.CENTER)
footer(s)

s = slide(); heading(s, "Mainnet evidence: MIN", 7)
text(s, 0.7, 1.65, 11.7, 0.55, "The stored report says DO NOT INTERACT because the native mint policy remains open.", 23)
panel(s, 0.7, 2.45, 5.65, 2.9, "DO NOT INTERACT", "MIN\nNative policy\nRequired signers: 1\nMint policy: open\nFinding: mint-open / high", True)
panel(s, 6.75, 2.45, 5.85, 2.9, "Source calls", "asset_info_29d222ce...\nregistry_29d222ce...\nscript_info_29d222ce...\n\nReport: engine/reports/MIN.json", False, True)
footer(s)

s = slide(); heading(s, "Mainnet evidence: SNEK and MINt", 8)
panel(s, 0.7, 2.05, 5.65, 3.4, "SNEK  /  INTERACT", "Native policy is timelocked\nMint policy: closed\n999 sampled holders\nTop 1: 4.0821102137%\nTop 10: 4.3279131478%\nReport: engine/reports/SNEK.json", True)
panel(s, 6.75, 2.05, 5.85, 3.4, "MINt  /  DO NOT INTERACT", "Native policy remains open\n1 required signer\nMinswap liquidity: 1766.66 ADA\nFindings: mint-open, liquidity\nReport: engine/reports/MINt.json")
footer(s)

s = slide(); heading(s, "The pool report makes exit evidence concrete", 9)
text(s, 0.7, 1.65, 11.7, 0.55, "Minswap V2 is identified as a known Plutus protocol script.", 23)
panel(s, 0.7, 2.45, 5.7, 2.8, "INTERACT", "Script type: plutusV2\nScript size: 3965 bytes\nTVL: 23409267.450065 ADA\nRecent tx count: 1000\nKnown protocol: Minswap V2 pool", True)
panel(s, 6.8, 2.45, 5.8, 2.8, "Source calls", "script_info_ea07b733...\naddress_utxos_addr1z84...\naddress_txs_addr1z84...\nReport: engine/reports/POOL-MINSWAP.json", False, True)
footer(s)

s = slide(); heading(s, "The agent demo has one safe branch", 10)
text(s, 0.7, 1.65, 11.7, 0.55, "The execution agent pays a seller only when the assessment is not DO_NOT_INTERACT.", 23)
panel(s, 0.7, 2.45, 3.75, 2.6, "Seller returns 402", "The agent reads the payment requirements and target.")
panel(s, 4.8, 2.45, 3.75, 2.6, "Risk Desk returns verdict", "The decision is an Assessment, not a model confidence score.", True)
panel(s, 8.9, 2.45, 3.75, 2.6, "Agent branches", "INTERACT → pay seller\nCONDITIONS → inspect\nDO NOT INTERACT → refuse")
text(s, 0.7, 5.55, 11.7, 0.45, "The proof is the branch: evidence changes whether value moves.", 18, True, INK, PP_ALIGN.CENTER)
footer(s)

s = slide(); heading(s, "Why Cardano and Masumi", 11)
panel(s, 0.7, 2.0, 5.7, 3.2, "Cardano", "Native assets carry minting policy evidence.\nPlutus scripts expose protocol surfaces.\nKoios and protocol APIs give the report its sources.", True)
panel(s, 6.8, 2.0, 5.8, 3.2, "Masumi", "Sokosumi makes the Coworker discoverable.\nTasks make the read accountable.\nEscrow turns the evidence into paid work.")
text(s, 0.7, 5.75, 11.7, 0.45, "Agents do not need to understand Cardano before they spend. They can hire a Coworker that does.", 18, True, INK, PP_ALIGN.CENTER)
footer(s)

out = Path(__file__).parent / "cardano-risk-analyst.pptx"
prs.save(out)
print(out)
