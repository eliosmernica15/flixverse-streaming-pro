/** Client-side QR data URL — avoids CSP-blocked external QR APIs. */
export async function generateQrDataUrl(text: string, size = 200): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: "#0a0a0a", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}
