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
MONO, TITLE, BODY = "JetBrains Mono", "Space Grotesk", "Inter"

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.33), Inches(7.5)
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
    p.text, p.font.size, p.font.bold, p.font.color.rgb, p.font.name, p.alignment = value, Pt(size), bold, color, font, align
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
    p.text, p.font.size, p.font.bold, p.font.color.rgb, p.font.name = title, Pt(17), True, RGBColor(0xF8, 0xF9, 0xFB) if dark else (ACCENT if accent else INK), TITLE
    p2 = tf.add_paragraph()
    p2.text, p2.font.size, p2.font.color.rgb, p2.font.name = body, Pt(13), RGBColor(0xF8, 0xF9, 0xFB) if dark else INK, MONO if dark else BODY

def heading(s, kicker, title, number):
    text(s, 0.7, 0.4, 11.7, 0.28, kicker, 10, False, MUTED, font=MONO)
    text(s, 0.7, 0.82, 11.7, 0.72, title, 31, True, INK, font=TITLE)
    bar = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(1.68), Inches(0.9), Inches(0.07))
    bar.fill.solid(); bar.fill.fore_color.rgb = ACCENT; bar.line.fill.background()
    text(s, 11.75, 6.95, 0.85, 0.25, f"{number:02d} / 10", 10, False, MUTED, PP_ALIGN.RIGHT, MONO)

def footer(s):
    text(s, 0.7, 6.95, 9.5, 0.25, "Cardano Risk Desk  /  x402  /  Sokosumi  /  Masumi", 10, False, MUTED, font=MONO)

s = slide()
text(s, 0.8, 1.25, 11.7, 1.55, "An approval step before your agent pays anyone on Cardano", 40, True, INK, PP_ALIGN.CENTER, TITLE)
text(s, 1.65, 3.55, 10.0, 0.6, "A paid check between the seller’s request and the wallet signature.", 20, False, INK, PP_ALIGN.CENTER)
text(s, 3.25, 5.15, 6.8, 0.45, "ARROW KEYS TO READ  /  P TO OPEN THE HUMAN UI", 12, True, MUTED, PP_ALIGN.CENTER, MONO)
text(s, 11.75, 6.95, 0.85, 0.25, "01 / 10", 10, False, MUTED, PP_ALIGN.RIGHT, MONO)

s = slide(); heading(s, "THE FEAR", "Your agent holds the wallet. The seller controls the story.", 2)
text(s, 0.7, 1.95, 11.7, 0.55, "A payment request can name a real address, a real asset, and a real price while nobody has checked what sits behind them.", 19)
panel(s, 0.7, 3.0, 3.75, 2.2, "The agent sees", "A 402 response with an amount, asset, payTo, and resource")
panel(s, 4.8, 3.0, 3.75, 2.2, "The wallet can do", "Sign and send value before a human inspects the counterparty")
panel(s, 8.9, 3.0, 3.75, 2.2, "The missing step", "Check the asset policy, address history, and protocol surface before payment", True)
footer(s)

s = slide(); heading(s, "THE PROBLEM IS REAL", "Payment rails do not tell an agent whether the purchase was wise.", 3)
text(s, 0.7, 1.95, 11.7, 0.55, "x402 contributors ask for chargebacks and better payment intent. Cardano users already see imitation tokens and rug-pull warnings.", 18)
panel(s, 0.7, 2.75, 3.75, 2.7, "x402 issue #508", "Phishing-like scams behind paid pages\n\ngithub.com/x402-foundation/x402/issues/508", False, True)
panel(s, 4.8, 2.75, 3.75, 2.7, "x402 issue #3500", "Agent paid $5.00 for a premium tier after asking for less\n\ngithub.com/x402-foundation/x402/issues/3500", False, True)
panel(s, 8.9, 2.75, 3.75, 2.7, "38 / 100", "HN report: average fidelity across roughly 1,700 monitored services\n\nnews.ycombinator.com/item?id=47158809", True)
footer(s)

s = slide(); heading(s, "WHAT CAN GO WRONG ON CARDANO", "The risk is in the asset, the address, and the script.", 4)
text(s, 0.7, 1.95, 11.7, 0.55, "The report turns chain facts into a refusal before the agent pays.", 19)
panel(s, 0.7, 2.9, 3.75, 2.55, "Open mint policy", "MIN.json\nscriptType=native\nrequiredSigners=1\nmintOpen=true\n\nMore supply can still be minted.", True)
panel(s, 4.8, 2.9, 3.75, 2.55, "Fresh address", "agent-demo/runs/1791341265898.json\nSeller B tx count: 1\nFirst seen: 2026-10-06\n\nNewness becomes a condition.")
panel(s, 8.9, 2.9, 3.75, 2.55, "Fake protocol script", "MINt.json\nmint-open / high\nliquidity: 1766.6595103971542 ADA\n\nA familiar name does not make an asset safe.")
footer(s)

s = slide(); heading(s, "THE CHECK", "x402 becomes a payment gate, not just a payment rail.", 5)
steps = [("402", "Seller asks", "asset · amount · payTo"), ("01", "Risk Desk", "paid assessment"), ("02", "Evidence", "policy · address · script"), ("03", "Decision", "interact or refuse"), ("04", "Payment", "sign only after check")]
for i, (num, title, body) in enumerate(steps):
    panel(s, 0.7 + i * 2.45, 2.75, 2.1, 2.55, num, f"{title}\n\n{body}", i == 3)
footer(s)

s = slide(); heading(s, "PREPROD RUN / agent-demo/runs/1791341265898.json", "The check sent one seller payment and stopped the other.", 6)
text(s, 0.7, 1.95, 11.7, 0.5, "The same agent handled both 402 responses on Cardano preprod. Koios confirms every proof transaction.", 18)
panel(s, 0.7, 2.75, 3.75, 2.75, "Seller A / INTERACT", "Quote: 2,000,000 lovelace\n\nRisk check 91ae89f5...\nSeller paid 6f514c89...", True)
panel(s, 4.8, 2.75, 3.75, 2.75, "Seller B / DO_NOT_INTERACT", "Quote: 5 custom-token units\n\nRisk check c063f45b...\nReason: asset-mint-open\nSeller payment was not sent")
panel(s, 8.9, 2.75, 3.75, 2.75, "The branch", "INTERACT  →  pay seller\n\nDO_NOT_INTERACT  →  refuse seller", False, True)
footer(s)

s = slide(); heading(s, "PRODUCTION PROOF / web/lib/x402/LIVE-PROOF.json", "The live endpoint settles once and rejects a replay.", 7)
text(s, 0.7, 1.95, 11.7, 0.5, "The production x402 call returned INTERACT. The same payment presented again returned HTTP 409.", 18)
panel(s, 0.7, 2.85, 5.65, 2.75, "Cardano preprod", "Endpoint: cardano-risk-coworker.vercel.app/api/x402/risk-check\n\nPaid: HTTP 200\nDecision: INTERACT\nKoios confirmations: 1", True)
panel(s, 6.75, 2.85, 5.85, 2.75, "Replay protection", "Same payment\n\nHTTP 409\n\n66d28ffbb319d191ee62bc0833af6af031c463604cba5b2121f007ce705dd5ba", False, True)
footer(s)

s = slide(); heading(s, "ONE-LINE INTEGRATION", "Put the Risk Desk where the wallet would have signed.", 8)
text(s, 0.7, 1.95, 11.7, 0.5, "The agent keeps its existing seller call. Add one paid check before the final payment.", 19)
panel(s, 0.7, 2.75, 11.9, 1.65, "curl", "curl -i https://cardano-risk-coworker.vercel.app/api/x402/risk-check \\\\\n  -H 'x-payment: <signed-cardano-payment>'", False, True)
text(s, 0.7, 5.05, 11.7, 0.45, "402  →  pay the Risk Desk  →  read the assessment  →  continue or refuse", 18, True, INK, PP_ALIGN.CENTER)
footer(s)

s = slide(); heading(s, "WHY CARDANO + MASUMI", "Cardano supplies the evidence. Masumi supplies the accountable work.", 9)
panel(s, 0.7, 2.25, 5.7, 3.0, "Cardano", "Native asset policies expose mint authority.\n\nAddresses and scripts are inspectable on chain.\n\nKoios turns those facts into cited evidence.", True)
panel(s, 6.8, 2.25, 5.8, 3.0, "Masumi", "The Coworker is discoverable through Sokosumi.\n\nA task makes the decision accountable.\n\nPayment turns the check into a service an agent can hire.")
footer(s)

s = slide()
text(s, 0.8, 1.1, 11.7, 0.28, "CLOSE", 10, False, MUTED, font=MONO)
text(s, 0.8, 1.65, 11.7, 1.25, "Let the agent move fast. Make the wallet ask first.", 42, True, INK, PP_ALIGN.CENTER, TITLE)
text(s, 1.65, 3.45, 10.0, 0.6, "Cardano Risk Analyst is the approval step before an autonomous payment becomes an irreversible one.", 19, False, INK, PP_ALIGN.CENTER)
text(s, 0.7, 5.25, 11.7, 0.45, "REQUEST   →   CHECK   →   APPROVE OR REFUSE", 15, True, ACCENT, PP_ALIGN.CENTER, MONO)
text(s, 11.75, 6.95, 0.85, 0.25, "10 / 10", 10, False, MUTED, PP_ALIGN.RIGHT, MONO)

out = Path(__file__).parent / "cardano-risk-analyst.pptx"
prs.save(out)
print(out)
