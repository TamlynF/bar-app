/* One look for the playlist QR wherever it is printed: the preview page
   renders it server-side, the PDF builder in the browser. Plain black on
   white scans most reliably from paper. */
export const QR_OPTIONS = {
  width: 256,
  margin: 1,
  errorCorrectionLevel: "M" as const,
  color: { dark: "#000000", light: "#ffffff" },
};
