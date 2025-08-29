import { NewsCallout } from "@/components/callout";
import { NewsList } from "@/components/news-list";

export default function DevelopersPage() {
  return (
    <>
      <NewsCallout
        badgeText="Open for Review"
        badgeVariant="outline"
        title="Vote on SIMD-0326: Alpenglow"
        description="A new proposal to upgrade Solana's core consensus protocol from TowerBFT to Alpenglow (Votor). This change promises higher resilience, better performance, lower latency, and reduced bandwidth usage."
        highlights={[
          "Consensus finality under 1 second in optimal conditions.",
          "Increases fault tolerance to 40% crashes and 20% Byzantine faults.",
          "Removes on-chain voting, introduces direct P2P votes and BLS signature aggregation.",
          "Maintains economic incentives with Validator Admission Ticket (VAT).",
        ]}
        link="https://github.com/solana-foundation/solana-improvement-documents/pull/326"
      />
      <NewsList
        title="Developers"
        description="Articles for developers."
        audience="developers"
        enOnly
      />
    </>
  );
}
