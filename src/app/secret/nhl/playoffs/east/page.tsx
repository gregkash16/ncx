import EastPlayoffsClient from "./EastPlayoffsClient";

export const metadata = {
  title: "Eastern Conference Playoff Seeding",
};

export default function EastPlayoffsPage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold text-white mb-4">
          Eastern Conference Playoff Seeding
        </h1>
        <EastPlayoffsClient />
      </div>
    </div>
  );
}