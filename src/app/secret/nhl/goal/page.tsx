// /src/app/secret/nhl/goal/page.tsx
import GoalClient from "./GoalClient";

export const metadata = {
  title: "Secret NHL Goal Light",
};

export default function GoalPage() {
  return (
    <div className="min-h-screen bg-black">
      <GoalClient />
    </div>
  );
}