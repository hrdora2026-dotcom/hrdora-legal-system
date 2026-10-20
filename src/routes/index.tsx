import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "H R DORA, ADVOCATE — Legal Opinion & Billing" },
      { name: "description", content: "Legal opinion register and billing management for H R DORA, ADVOCATE." },
      { property: "og:title", content: "H R DORA, ADVOCATE" },
      { property: "og:description", content: "Legal opinion register and billing management." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
