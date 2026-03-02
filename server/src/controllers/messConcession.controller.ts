import type { Request, Response } from "express";

import prisma from "../prisma";
import { uploadImageToSupabase } from "../utils/uploadImage";

export async function createMessConcession(req: Request, res: Response) {
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
    amount,
    student_id,
  } = req.body as {
    image_url?: string;
    imageDataUrl?: string;
    image_data_url?: string;
    imageBase64?: string;
    image_base64?: string;
    imageContentType?: string;
    image_content_type?: string;
    days?: number;
    start_date?: string;
    end_date?: string;
    amount?: number;
    student_id?: string;
  };

  if (
    typeof days !== "number" ||
    !start_date ||
    !end_date ||
    typeof amount !== "number" ||
    !student_id
  ) {
    return res
      .status(400)
      .json({ error: "days, start_date, end_date, amount, student_id are required" });
  }

  let finalImageUrl = image_url;
  const dataUrl = imageDataUrl ?? image_data_url;
  const base64 = imageBase64 ?? image_base64;
  const contentType = imageContentType ?? image_content_type;

  if (!finalImageUrl && (dataUrl || base64)) {
    try {
      const uploaded = await uploadImageToSupabase({
        prefix: `messconcession-${student_id}`,
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

  if (!finalImageUrl) {
    return res.status(400).json({ error: "image_url is required (or provide imageDataUrl/imageBase64)" });
  }

  const mc = await prisma.messConcession.create({
    data: {
      image_url: finalImageUrl,
      days,
      start_date: new Date(start_date),
      End_date: new Date(end_date),
      amount,
      student_id,
    },
  });

  return res.status(201).json(mc);
}

export async function listMessConcessions(_req: Request, res: Response) {
  const items = await prisma.messConcession.findMany({
    orderBy: { start_date: "desc" },
  });
  return res.status(200).json(items);
}

export async function getMessConcession(req: Request, res: Response) {
  const { id } = req.params;
  const item = await prisma.messConcession.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "Not Found" });
  return res.status(200).json(item);
}

export async function updateMessConcession(req: Request, res: Response) {
  const { id } = req.params;
  const { image_url, days, start_date, end_date, amount } = req.body as {
    image_url?: string;
    days?: number;
    start_date?: string;
    end_date?: string;
    amount?: number;
  };

  const existing = await prisma.messConcession.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Not Found" });

  const updated = await prisma.messConcession.update({
    where: { id },
    data: {
      image_url,
      days,
      start_date: start_date ? new Date(start_date) : undefined,
      End_date: end_date ? new Date(end_date) : undefined,
      amount,
    },
  });

  return res.status(200).json(updated);
}

export async function deleteMessConcession(req: Request, res: Response) {
  const { id } = req.params;

  const existing = await prisma.messConcession.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Not Found" });

  await prisma.messConcession.delete({ where: { id } });
  return res.status(204).send();
}
