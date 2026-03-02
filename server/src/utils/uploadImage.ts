import { getSupabaseBucket, getSupabaseClient } from "./supabase";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function extFromContentType(contentType: string) {
  const ct = contentType.toLowerCase();
  if (ct === "image/png") return "png";
  if (ct === "image/jpeg" || ct === "image/jpg") return "jpg";
  if (ct === "image/webp") return "webp";
  if (ct === "image/gif") return "gif";
  return "bin";
}

function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");

  const contentType = match[1];
  if (!contentType.startsWith("image/")) throw new Error("Only image files are allowed");

  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");
  return { contentType, buffer };
}

function parseBase64(base64: string, contentType?: string): { contentType: string; buffer: Buffer } {
  if (!contentType) throw new Error("image_content_type is required when sending raw base64");
  if (!contentType.startsWith("image/")) throw new Error("Only image files are allowed");
  const buffer = Buffer.from(base64, "base64");
  return { contentType, buffer };
}

export async function uploadImageToSupabase(params: {
  prefix: string;
  imageDataUrl?: string;
  imageBase64?: string;
  imageContentType?: string;
}): Promise<{ publicUrl: string; path: string }> {
  const { prefix, imageDataUrl, imageBase64, imageContentType } = params;

  const parsed = imageDataUrl
    ? parseDataUrl(imageDataUrl)
    : imageBase64
      ? parseBase64(imageBase64, imageContentType)
      : null;

  if (!parsed) throw new Error("No image provided");
  if (parsed.buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("File size must be less than 5MB");

  const supabase = getSupabaseClient();
  const bucket = getSupabaseBucket();

  const ext = extFromContentType(parsed.contentType);
  const fileName = `${prefix}-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, parsed.buffer, { contentType: parsed.contentType, upsert: false });

  if (error || !data?.path) {
    throw new Error(error?.message ?? "Failed to upload image");
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  if (!urlData.publicUrl) throw new Error("Failed to get public URL");

  return { publicUrl: urlData.publicUrl, path: data.path };
}
