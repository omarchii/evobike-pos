import path from "path";
import { Font } from "@react-pdf/renderer";

export const FONT_FAMILY = "Inter";

let registered = false;

export function registerFonts(): void {
  if (registered) return;
  registered = true;

  const base = path.join(process.cwd(), "public", "fonts");

  Font.register({
    family: FONT_FAMILY,
    fonts: [
      {
        src: path.join(base, "Inter-Regular.ttf"),
        fontWeight: 400,
        fontStyle: "normal",
      },
      {
        src: path.join(base, "Inter-Medium.ttf"),
        fontWeight: 500,
        fontStyle: "normal",
      },
      {
        src: path.join(base, "Inter-SemiBold.ttf"),
        fontWeight: 600,
        fontStyle: "normal",
      },
      {
        src: path.join(base, "Inter-Bold.ttf"),
        fontWeight: 700,
        fontStyle: "normal",
      },
    ],
  });
}
