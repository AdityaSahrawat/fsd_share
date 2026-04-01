import type { Request, Response } from "express";

import prisma from "../prisma";
import { uploadImageToSupabase } from "../utils/uploadImage";

export async function createOutPass(req: Request, res: Response) {
  const {
    image_url,
    imageDataUrl,
    image_data_url,
    imageBase64,
    image_base64,
    imageContentType,
    image_content_type,
    days,
    start_date,
    end_date,
    student_id,
  } = req.body as {
    image_url?: string | null;
    imageDataUrl?: string;
    image_data_url?: string;
    imageBase64?: string;
    image_base64?: string;
    imageContentType?: string;
    image_content_type?: string;
    days?: number;
    start_date?: string;
    end_date?: string;
    student_id?: string;
  };

  if (typeof days !== "number" || !start_date || !end_date || !student_id) {
    return res.status(400).json({ error: "days, start_date, end_date, student_id are required" });
  }

  let finalImageUrl = image_url ?? undefined;
  const dataUrl = imageDataUrl ?? image_data_url;
  const base64 = imageBase64 ?? image_base64;
  const contentType = imageContentType ?? image_content_type;

  if (!finalImageUrl && (dataUrl || base64)) {
    try {
      const uploaded = await uploadImageToSupabase({
        prefix: `outpass-${student_id}`,
        imageDataUrl: dataUrl,
        imageBase64: base64,
        imageContentType: contentType,
      });
      finalImageUrl = uploaded.publicUrl;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to upload image";
      return res.status(400).json({ error: message });
    }
  }

  // Image is optional. If none provided, keep it null in DB.

  const outpass = await prisma.outPass.create({
    data: {
      image_url: finalImageUrl ?? null,
      days,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      student_id,
    },
  });

  return res.status(201).json(outpass);
}

export async function listOutPasses(_req: Request, res: Response) {
  const outpasses = await prisma.outPass.findMany({
    orderBy: { start_date: "desc" },
  });
  return res.status(200).json(outpasses);
}

export async function getOutPass(req: Request, res: Response) {
  const { id } = req.params;
  const outpass = await prisma.outPass.findUnique({ where: { id } });
  if (!outpass) return res.status(404).json({ error: "Not Found" });
  return res.status(200).json(outpass);
}

export async function updateOutPass(req: Request, res: Response) {
  const { id } = req.params;
  const { image_url, days, start_date, end_date } = req.body as {
    image_url?: string | null;
    days?: number;
    start_date?: string;
    end_date?: string;
  };

  const existing = await prisma.outPass.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Not Found" });

  const outpass = await prisma.outPass.update({
    where: { id },
    data: {
      image_url,
      days,
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
    },
  });

  return res.status(200).json(outpass);
}

export async function deleteOutPass(req: Request, res: Response) {
  const { id } = req.params;

  const existing = await prisma.outPass.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Not Found" });

  await prisma.outPass.delete({ where: { id } });
  return res.status(204).send();
}
