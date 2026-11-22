import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { createFileRoute } from "@tanstack/react-router";
import { BookCheck } from "lucide-react";
import { Chip, Panel, PageHead, td, th } from "@/components/aps/kit";

export const Route = createFileRoute("/_authenticated/aps/compliance")({
  head: () => ({
    meta: [
      { title: "Standards & Ownership · APS" },
      {
        name: "description",
        content:
          "Which system owns each data object, and how APS maps to ISA-95, IEC 62443, ISO and Part 11 topics.",
      },
    ],
  }),
  component: Compliance,
});

const ownership: [string, string, string, string][] = [
  [
    "Customer, sales order, due date",
    "MES Command Central (OMS) / ERP",
    "Reads released demand; returns feasibility and plan references",
    "Order revision + sales order ref, idempotent upsert",
  ],
  [
    "Production order identity, quantity, status",
    "MES Command Central",
    "Read-only in APS; returns planned start/end, machine and sequence",
    "Orders page is read-only; new revisions arrive via /oms",
  ],
  [
    "Schedule, capacity, sequencing, conflicts",
    "APS",
    "Generates, versions, approves and reschedules",
    "Approved version ID, released on approval, MES acknowledgement, out-of-date detection",
  ],
  [
    "BOM, recipe, routing",
    "Product Lifecycle Command (PLM/RMS)",
    "Plans against approved revisions",
    "Revision IDs + effective dates stored; revision change flags the approved plan",
  ],
  [
    "Inventory and material availability",
    "MES Command Central (WMS)",
    "Reads timestamped snapshot, flags shortages",
    "as_of required on every inventory record",
  ],
  [
    "Machine state, downtime, maintenance",
    "MES Command Center + CMMS",
    "Uses availability and planned downtime",
    "Down machine or overlapping maintenance flags the approved plan",
  ],
  [
    "Operator qualifications and shifts",
    "Workforce / HR source",
    "Uses qualified availability",
    "Shift hours in plant time zone (setting)",
  ],
  [
    "Quality disposition",
    "CORTA QC System",
    "Held product/material is not usable for planning",
    "/qms feed: hold, released, rejected",
  ],
  [
    "Access and roles",
    "Command Access Hub",
    "Checks role on every change; refuses changes if Hub unreachable",
    "System key aps; read-only until linked",
  ],
  [
    "Integration delivery evidence",
    "Owning receiver",
    "Validates and logs every message; no independent retry engine",
    "Event envelope, idempotency key, message log",
  ],
  [
    "Audit and e-approval",
    "Each application",
    "Immutable plan snapshots, password re-check, hash-chained audit",
    "Integrity check, CSV export, retention setting",
  ],
];

type Status = "in_place" | "partial" | "external";
const tone: Record<Status, string> = { in_place: "success", partial: "warning", external: "muted" };
const label: Record<Status, string> = {
  in_place: "In place in APS",
  partial: "Partial",
  external: "Needs other system / process",
};

const standards: [string, Status, string, string][] = [
  [
    "ISA-95 / IEC 62264",
    "partial",
    "Ownership matrix above, versioned interface contract, shared event envelope, separate released / planned / approved states.",
    "Confirm the same semantics in MES Command Central and test with real systems.",
  ],
  [
    "ISA-88 (batch)",
    "external",
    "Recipe status and revision are planning inputs.",
    "Batch execution, parameter limits and genealogy belong in MES/QMS.",
  ],
  [
    "ISA/IEC 62443 + NIST SP 800-82",
    "partial",
    "Server-side permission checks, fail-closed on Hub outage, keyed integration endpoints, constant-time key check.",
    "Threat assessment, network zoning, key rotation, patching, backup/recovery and independent testing.",
  ],
  [
    "OPC UA / IEC 62541",
    "external",
    "APS only exchanges web API messages — never exposed to control networks.",
    "Use a segmented OT gateway in MES if PLC/SCADA data is needed.",
  ],
  [
    "ISO 9001",
    "partial",
    "Approvals, schedule versions, planning-rule change history, quality holds respected in planning.",
    "Nonconformance, CAPA, controlled SOPs and training records in a QMS.",
  ],
  [
    "ISO 14001",
    "external",
    "Not in APS scope.",
    "Environmental metrics workflow with a defined owner, if applicable.",
  ],
  [
    "ISO 45001",
    "external",
    "Operator skills and shifts only.",
    "Hazards, incidents, permits and training in a safety system, if applicable.",
  ],
  [
    "ISO 55001",
    "partial",
    "Machine status, rates and maintenance windows drive capacity.",
    "Connect a CMMS/EAM for criticality, failure history and lifecycle decisions.",
  ],
  [
    "FDA 21 CFR Part 11",
    "partial",
    "Signature with password re-check, signer name, meaning and time; append-only hash-chained audit trail; export.",
    "Only if in scope: system validation, SOPs, identity proofing and certification to FDA.",
  ],
];

function Compliance() {
  return (
    <>
      <PageHead
        icon={<BookCheck className="h-6 w-6 text-primary" />}
        title="Standards & Ownership"
        desc="Who owns each piece of data between APS and MES Command Central, and what APS provides toward each standard. This is a gap map, not a compliance certificate."
      />
      <Panel title="System of record">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b border-border/60">
                {["Data", "Owner", "APS role", "Control in APS"].map((h) => (
                  <TableHead key={h} className={th}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ownership.map(([d, o, r, c]) => (
                <TableRow key={d} className="border-b border-border/30">
                  <TableCell className={`${td} font-medium`}>{d}</TableCell>
                  <TableCell className={td}>{o}</TableCell>
                  <TableCell className={`${td} text-muted-foreground`}>{r}</TableCell>
                  <TableCell className={`${td} text-muted-foreground`}>{c}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <Panel title="Standards mapping">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b border-border/60">
                {["Standard", "Status", "What APS provides", "Still needed"].map((h) => (
                  <TableHead key={h} className={th}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {standards.map(([s, st, has, gap]) => (
                <TableRow key={s} className="border-b border-border/30">
                  <TableCell className={`${td} font-medium`}>{s}</TableCell>
                  <TableCell className={td}>
                    <Chip tone={tone[st]}>{label[st]}</Chip>
                  </TableCell>
                  <TableCell className={`${td} text-muted-foreground`}>{has}</TableCell>
                  <TableCell className={`${td} text-muted-foreground`}>{gap}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </>
  );
}
