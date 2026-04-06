import type { Request, Response } from "express";
import prisma from "../prisma";

export async function listFines(req: Request, res: Response) {
  try {
    const fines = await prisma.fine.findMany({
      include: {
        student: true,
      },
      orderBy: {
        fine_date: 'desc',
      },
    });
    return res.status(200).json(fines);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch fines" });
  }
}

export async function createFine(req: Request, res: Response) {
  try {
    const { student_id, amount, fine_date } = req.body;

    if (!student_id || amount === undefined || !fine_date) {
      return res.status(400).json({ error: "student_id, amount, and fine_date are required" });
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    const parsedDate = new Date(fine_date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: "Invalid fine_date" });
    }

    const fine = await prisma.fine.create({
      data: {
        student_id,
        amount: parsedAmount,
        fine_date: parsedDate,
      },
    });

    return res.status(201).json(fine);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to create fine" });
  }
}

export async function markFinePaid(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { paid } = req.body; // Expect `{ paid: true }` or `{ paid: false }`

    const fine = await prisma.fine.findUnique({ where: { id } });
    if (!fine) return res.status(404).json({ error: "Fine not found" });

    // Reverse mechanism included based on the Implementation plan design
    const updated = await prisma.fine.update({
      where: { id },
      data: {
        paid_date: paid ? new Date() : null,
      },
    });

    return res.status(200).json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to update fine" });
  }
}
