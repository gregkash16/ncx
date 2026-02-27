import AtlanticClient from "./AtlanticClient";

export const metadata = {
  title: "Atlantic Division Standings",
};

export default function AtlanticStandingsPage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold text-white mb-4">
          Atlantic Division Standings
        </h1>
        <AtlanticClient />
      </div>
    </div>
  );
}