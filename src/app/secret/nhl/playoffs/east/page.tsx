import EastPlayoffsClient from "./EastPlayoffsClient";

export const metadata = {
  title: "Eastern Conference Playoff Seeding",
};

export default function EastPlayoffsPage() {
  return (
    <div className="min-h-screen w-screen bg-black">
      <div className="w-full p-10 space-y-6">
        <h1 className="text-2xl font-bold text-white mb-4">
          Eastern Conference Playoff Seeding
        </h1>

        <EastPlayoffsClient />
      </div>
    </div>
  );
}