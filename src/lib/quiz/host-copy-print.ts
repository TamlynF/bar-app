import { toast } from "sonner";
import { getHostCopyAction } from "@/app/(private)/event-setups/events/actions";
import { buildHostCopyPdf } from "./host-copy-pdf";
import { pictureSheetFileName, pictureSheetUsesShareSheet, sharePictureSheet } from "./picture-sheet-pdf";

/* The same path the picture sheet takes: build the PDF, then hand it to the
   phone's share sheet or open it in a tab on desktop. */
export async function printHostCopy(eventId: number) {
  const title = "Quiz host copy";

  if (!pictureSheetUsesShareSheet()) {
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Allow pop-ups to print the host copy");
      return;
    }
    win.document.title = title;
    win.document.body.textContent = "Preparing host copy…";
    try {
      const copy = await getHostCopyAction(eventId);
      win.location.href = URL.createObjectURL(await buildHostCopyPdf(copy));
    } catch {
      win.close();
      toast.error("Couldn't build the host copy");
    }
    return;
  }

  const pending = toast.loading("Preparing host copy…");
  try {
    const copy = await getHostCopyAction(eventId);
    const blob = await buildHostCopyPdf(copy);
    const file = new File([blob], pictureSheetFileName(`${copy.title} - host copy`), { type: "application/pdf" });
    toast.dismiss(pending);
    const outcome = await sharePictureSheet(file, title);
    if (outcome === "blocked") toast.error("Couldn't open the share sheet - use Preview, then print instead");
  } catch {
    toast.dismiss(pending);
    toast.error("Couldn't build the host copy");
  }
}
