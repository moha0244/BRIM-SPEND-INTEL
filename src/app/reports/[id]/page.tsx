// src/app/reports/[id]/page.tsx
import { ReportDetail } from "@/components/reports/ReportDetail";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#080C12" }}>
      <ReportDetail reportId={parseInt(id)} />
    </div>
  );
}
