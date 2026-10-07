import RiskDesk from "./risk-desk";

export const metadata = {
  title: "Cardano Risk Analyst: should I interact with this Cardano contract?",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%231f2937'/><path d='M8 8h16v4H12v4h8v4h-8v4H8z' fill='%23fff'/></svg>" },
};

export default function Page() {
  return <RiskDesk />;
}
