import QRCode from "qrcode";

export async function generateQrSvg(
  data: string,
  color = "#111111",
): Promise<string> {
  return QRCode.toString(data, {
    type: "svg",
    color: { dark: color, light: "#00000000" },
    margin: 0,
    errorCorrectionLevel: "M",
  });
}
