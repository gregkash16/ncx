import StatsClient from "./StatsClient";

export const metadata = {
  title: "Secret NHL Sabres Live Stats",
};

export default function SecretSabresStatsPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-[853px] p-6">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Buffalo Sabres – Live Game Stats
        </h1>
        <StatsClient />
      </div>
    </div>
  );
}