// src/app/m/playoffs/page.tsx
import MobilePlayoffs from "./MobilePlayoffs";

export const revalidate = 60;

export default async function MobilePlayoffsPage() {
  return <MobilePlayoffs />;
}
