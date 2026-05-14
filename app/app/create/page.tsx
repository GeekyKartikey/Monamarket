// Server Component shell — client logic lives in CreateMarketClient
import { CreateMarketClient } from "@/components/CreateMarketClient";

export const metadata = { title: "Create Market · Monamarket" };

export default function CreatePage() {
  return (
    <div className="max-w-2xl mx-auto py-4">
      <CreateMarketClient />
    </div>
  );
}
