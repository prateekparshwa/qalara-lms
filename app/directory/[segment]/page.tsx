import { notFound } from "next/navigation";
import LeadsDashboard from "@/components/LeadsDashboard";
import { getSegment, DISCOVER_SEGMENT } from "@/lib/segments";

export default function SegmentDashboardPage({
  params,
}: {
  params: { segment: string };
}) {
  // The 'discover' segment (General Discovery saves) is viewable too.
  if (params.segment === DISCOVER_SEGMENT) {
    return (
      <LeadsDashboard segment={DISCOVER_SEGMENT} segmentLabel="Discovered Buyers" />
    );
  }
  const seg = getSegment(params.segment);
  if (!seg) notFound();
  return <LeadsDashboard segment={seg.key} segmentLabel={seg.label} />;
}
