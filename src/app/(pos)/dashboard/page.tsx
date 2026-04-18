import { permanentRedirect } from "next/navigation";

export default function DashboardLegacyRedirect() {
    permanentRedirect("/");
}
