import "./globals.css";

export const metadata = {
  title: "ArchLens — Code-to-Diagram Architecture Visualizer",
  description:
    "Turn a GitHub backend repository into an evidence-grounded architecture diagram and Mermaid.js source.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
