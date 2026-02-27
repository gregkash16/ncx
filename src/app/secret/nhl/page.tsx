import ScoresClient from "./ScoresClient";

export const metadata = {
  title: "Secret NHL Scores",
};

export default function SecretNhlPage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold text-white mb-4">NHL Scores</h1>
        <ScoresClient />
      </div>
    </div>
  );
}