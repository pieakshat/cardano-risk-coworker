import RiskDesk from "./risk-desk";

export const metadata = {
  title: "Cardano Risk Desk: an approval step before your agent pays on Cardano",
  description: "Your agent pays the Risk Desk 1 ADA over x402 and receives INTERACT, INTERACT WITH CONDITIONS or DO NOT INTERACT with the rule ids behind it, then signs the seller payment only on an allowing verdict.",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%231f2937'/><path d='M8 8h16v4H12v4h8v4h-8v4H8z' fill='%23fff'/></svg>" },
};

export default function Page() {
  return <RiskDesk />;
}
