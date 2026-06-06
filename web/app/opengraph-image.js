import { renderOg, ogSize, ogContentType, ogAlt } from "@/lib/og";

export const runtime = "edge";
export const size = ogSize;
export const contentType = ogContentType;
export const alt = ogAlt;

export default function OpengraphImage() {
  return renderOg();
}
