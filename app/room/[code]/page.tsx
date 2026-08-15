import RoomBoard from "@/components/RoomBoard";
import { normalizeCode } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomBoard code={normalizeCode(code)} />;
}
