// src/app/m/players/page.tsx
import PlayersPanelServer from "@/app/components/PlayersPanelServer";

export const revalidate = 0;

export default async function MobilePlayersPage() {
  return (
    <div className="py-4">
      <PlayersPanelServer />
    </div>
  );
}
