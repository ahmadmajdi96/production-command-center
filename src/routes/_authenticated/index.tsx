import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    throw redirect({ to: "/scheduling" });
  },
  head: () => ({
    meta: [
      { title: "Cortanex APS — Advanced Planning & Scheduling" },
      { name: "description", content: "Production schedules, capacity, shifts and crew assignments." },
      { property: "og:title", content: "Cortanex APS — Advanced Planning & Scheduling" },
      { property: "og:description", content: "Production schedules, capacity, shifts and crew assignments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
