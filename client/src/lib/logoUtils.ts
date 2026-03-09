import { supabase } from "@/lib/supabaseClient";

export type LogoCropParams = {
  scale: number;
  offsetX: number;
  offsetY: number;
  framePadding: number;
  frameColor: "white" | "black" | "custom";
  frameCustomColor: string;
};

export const DEFAULT_CROP_PARAMS: LogoCropParams = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  framePadding: 6,
  frameColor: "white",
  frameCustomColor: "#dbeafe",
};

export async function renderAndUploadFramedLogoAsset({
  sourceUrl,
  filePath,
  previewScale,
  previewOffsetX,
  previewOffsetY,
  framePadding,
  frameColor,
  frameCustomColor,
  fitMode = "cover",
}: {
  sourceUrl: string;
  filePath: string;
  previewScale: number;
  previewOffsetX: number;
  previewOffsetY: number;
  framePadding: number;
  frameColor: "white" | "black" | "custom";
  frameCustomColor: string;
  fitMode?: "cover" | "contain";
}): Promise<string> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = sourceUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to load logo for processing."));
  });

  const size = 1024;
  const editorBaseSize = 224;
  const paddingRatio = Math.max(0, Math.min(0.45, framePadding / editorBaseSize));
  const paddingPx = Math.round(size * paddingRatio);
  const innerSize = Math.max(1, size - paddingPx * 2);

  const mainCanvas = document.createElement("canvas");
  mainCanvas.width = size;
  mainCanvas.height = size;
  const mainCtx = mainCanvas.getContext("2d");
  if (!mainCtx) throw new Error("Unable to prepare logo output canvas.");

  const resolvedCustomFrameColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(frameCustomColor)
    ? frameCustomColor
    : "#dbeafe";
  const resolvedFrameColor =
    frameColor === "black"
      ? "#000000"
      : frameColor === "custom"
        ? resolvedCustomFrameColor
        : "#ffffff";
  mainCtx.fillStyle = resolvedFrameColor;
  mainCtx.fillRect(0, 0, size, size);

  mainCtx.save();
  const dx = (previewOffsetX / 100) * innerSize;
  const dy = (previewOffsetY / 100) * innerSize;
  mainCtx.translate(size / 2 + dx, size / 2 + dy);
  mainCtx.scale(previewScale, previewScale);
  const imageRatio = image.width / image.height;
  if (fitMode === "contain") {
    let drawWidth = innerSize;
    let drawHeight = innerSize;
    if (imageRatio > 1) {
      drawHeight = innerSize / imageRatio;
    } else if (imageRatio < 1) {
      drawWidth = innerSize * imageRatio;
    }
    mainCtx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  } else {
    const targetRatio = 1;
    let sx = 0;
    let sy = 0;
    let sWidth = image.width;
    let sHeight = image.height;
    if (imageRatio > targetRatio) {
      sWidth = image.height * targetRatio;
      sx = (image.width - sWidth) / 2;
    } else if (imageRatio < targetRatio) {
      sHeight = image.width / targetRatio;
      sy = (image.height - sHeight) / 2;
    }
    mainCtx.drawImage(image, sx, sy, sWidth, sHeight, -innerSize / 2, -innerSize / 2, innerSize, innerSize);
  }
  mainCtx.restore();

  const blob = await new Promise<Blob>((resolve, reject) => {
    mainCanvas.toBlob(result => {
      if (!result) {
        reject(new Error("Unable to encode processed logo."));
        return;
      }
      resolve(result);
    }, "image/png");
  });

  const { error: uploadError } = await supabase.storage
    .from("lab-logos")
    .upload(filePath, blob, { upsert: true, contentType: "image/png" });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("lab-logos").getPublicUrl(filePath);
  return data.publicUrl;
}
