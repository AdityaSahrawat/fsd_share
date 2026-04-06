import type { Request, Response } from "express";

import prisma from "../prisma";

type CreateStudentBody = {
  roll_no?: string;
  name?: string;
  std_phone_no?: string;
  student_phone_no?: string; // alias
  father_name?: string;
  father_phone_no?: string;
  branch?: "CSE" | "DSAI" | "ECE";
  state?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  room_no?: string | null; // references Room.id in your schema
};

function isLikelyUuid(value: string) {
  // Enough for routing logic; not meant as full validation.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toRoomNumberString(roomNo: number) {
  return String(roomNo).padStart(3, "0");
}

function validateRollNoAndBranch(rollNo: string, branch: string): string | null {
  const normBranch = branch.toUpperCase();
  if (!["CSE", "DSAI", "ECE"].includes(normBranch)) {
    return "Branch can only be CSE, DSAI, or ECE";
  }

  const match = rollNo.match(/^\d+(bcs|bds|bec|cse)\d+$/i);
  if (!match) {
    return "Roll number must be in format: <number><bcs|bds|bec><number>";
  }

  const code = match[1].toLowerCase();
  if (normBranch === "CSE" && code !== "bcs" && code !== "cse") {
    return "If branch is CSE, roll number must contain 'bcs'";
  }
  if (normBranch === "DSAI" && code !== "bds") {
    return "If branch is DSAI, roll number must contain 'bds'";
  }
  if (normBranch === "ECE" && code !== "bec") {
    return "If branch is ECE, roll number must contain 'bec'";
  }

  return null;
}

function roomCapacity(roomNo: number, floor: number) {
  // Ground floor rooms 001–020 are 4-sharing, everything else is 5-sharing.
  if (floor === 0 && roomNo >= 1 && roomNo <= 20) return 4;
  return 5;
}

async function assertRoomHasSpace(roomId: string, incoming: number, tx: any = prisma) {
  const room = await tx.room.findUnique({
    where: { id: roomId },
    select: { id: true, room_no: true, floor: true, _count: { select: { students: true } } },
  });
  if (!room) throw new Error("Room not found");

  const cap = roomCapacity(room.room_no, room.floor);
  const current = room._count.students;
  if (current + incoming > cap) {
    throw new Error(`Room ${toRoomNumberString(room.room_no)} (floor ${room.floor}) is full (${current}/${cap}).`);
  }
}

export async function resolveRoomId(input: string, tx: { room: any } = prisma as any) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("room_no is required");

  // Back-compat: allow providing Room.id directly.
  if (isLikelyUuid(trimmed)) return trimmed;

  // Preferred: accept human room number like "201", "020", "1".
  if (!/^\d{1,3}$/.test(trimmed)) {
    throw new Error("room_no must be a Room id (uuid) or a 1-3 digit room number");
  }

  const roomNo = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(roomNo) || roomNo <= 0) {
    throw new Error("room_no must be a positive room number");
  }

  const floor = Math.floor(roomNo / 100);

  const room = await tx.room.upsert({
    where: { room_no: roomNo },
    create: { room_no: roomNo, floor },
    update: { floor },
    select: { id: true },
  });

  return room.id;
}

function serializeStudentForApi(student: {
  id: string;
  roll_no: string;
  name?: string | null;
  std_phone_no?: string | null;
  father_name?: string | null;
  father_phone_no?: string | null;
  branch: string;
  state: string;
  gender: string;
  Room?: { room_no: number } | null;
  room_no: string | null;
}) {
  return {
    id: student.id,
    roll_no: student.roll_no,
    name: student.name ?? null,
    std_phone_no: student.std_phone_no ?? null,
    father_name: student.father_name ?? null,
    father_phone_no: student.father_phone_no ?? null,
    branch: student.branch,
    state: student.state,
    gender: student.gender,
    room_no: student.Room?.room_no != null ? toRoomNumberString(student.Room.room_no) : student.room_no,
  };
}

export async function createStudent(req: Request, res: Response) {
  const body = req.body as CreateStudentBody;

  const gender = body.gender ?? "MALE";

  if (!body.roll_no || !body.branch || !body.state) {
    return res.status(400).json({ error: "roll_no, branch, state are required" });
  }

  const validationError = validateRollNoAndBranch(body.roll_no, body.branch);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const roomId = body.room_no ? await resolveRoomId(body.room_no) : null;

  if (roomId) {
    try {
      await assertRoomHasSpace(roomId, 1);
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : "Room is full" });
    }
  }

  const student = await prisma.student.create({
    data: {
      roll_no: body.roll_no,
      name: body.name?.trim() ? body.name.trim() : undefined,
      std_phone_no: body.std_phone_no?.trim()
        ? body.std_phone_no.trim()
        : body.student_phone_no?.trim()
          ? body.student_phone_no.trim()
          : undefined,
      father_name: body.father_name?.trim() ? body.father_name.trim() : undefined,
      father_phone_no: body.father_phone_no?.trim() ? body.father_phone_no.trim() : undefined,
      branch: body.branch as "CSE" | "DSAI" | "ECE",
      state: body.state,
      gender,
      room_no: roomId,
    },
    include: { Room: { select: { room_no: true } } },
  });

  return res.status(201).json(serializeStudentForApi(student));
}

export async function bulkCreateStudents(req: Request, res: Response) {
  const { students } = req.body as { students?: CreateStudentBody[] };

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: "students[] is required" });
  }

  const invalidIndex = students.findIndex((s) => !s.roll_no || !s.branch || !s.state);
  if (invalidIndex !== -1) {
    return res.status(400).json({ error: `students[${invalidIndex}] is missing required fields` });
  }

  const formatInvalidIndex = students.findIndex((s) => validateRollNoAndBranch(s.roll_no!, s.branch!));
  if (formatInvalidIndex !== -1) {
    const err = validateRollNoAndBranch(students[formatInvalidIndex]!.roll_no!, students[formatInvalidIndex]!.branch!);
    return res.status(400).json({ error: `students[${formatInvalidIndex}]: ${err}` });
  }

  // Resolve/upsert rooms (only for numeric room inputs) so Student.room_no FK points to Room.id.
  // Do this OUTSIDE an interactive transaction to avoid P2028 timeouts on larger imports.
  const uniqueRoomInputs = Array.from(
    new Set(students.map((s) => String(s.room_no || "").trim()).filter((r) => r && !isLikelyUuid(r))),
  );

  const roomIdByInput = new Map<string, string>();
  const BATCH_SIZE = 10;
  for (let i = 0; i < uniqueRoomInputs.length; i += BATCH_SIZE) {
    const batch = uniqueRoomInputs.slice(i, i + BATCH_SIZE);
    const resolved = await Promise.all(batch.map((roomInput) => resolveRoomId(roomInput, prisma)));
    for (let j = 0; j < batch.length; j++) {
      roomIdByInput.set(batch[j]!, resolved[j]!);
    }
  }

  const data = students.map((s) => {
      const roomInput = String(s.room_no || "").trim();
      const resolvedRoomId = roomInput ? (isLikelyUuid(roomInput) ? roomInput : (roomIdByInput.get(roomInput) ?? roomInput)) : null;

      const name = s.name?.trim() ? s.name.trim() : undefined;
      const stdPhone = s.std_phone_no?.trim()
        ? s.std_phone_no.trim()
        : s.student_phone_no?.trim()
          ? s.student_phone_no.trim()
          : undefined;
      const fatherName = s.father_name?.trim() ? s.father_name.trim() : undefined;
      const fatherPhone = s.father_phone_no?.trim() ? s.father_phone_no.trim() : undefined;

      return {
        roll_no: s.roll_no!,
        name,
        std_phone_no: stdPhone,
        father_name: fatherName,
        father_phone_no: fatherPhone,
        branch: s.branch! as "CSE" | "DSAI" | "ECE",
        state: s.state!,
        gender: (s.gender ?? "MALE")!,
        room_no: resolvedRoomId,
      };
    });

  const incomingByRoomId = new Map<string, number>();
  for (const row of data) {
    if (!row.room_no) continue;
    incomingByRoomId.set(row.room_no, (incomingByRoomId.get(row.room_no) ?? 0) + 1);
  }

  if (incomingByRoomId.size > 0) {
    const roomIds = Array.from(incomingByRoomId.keys());
    const rooms = await prisma.room.findMany({
      where: { id: { in: roomIds } },
      select: { id: true, room_no: true, floor: true, _count: { select: { students: true } } },
    });

    const roomById = new Map(rooms.map((r) => [r.id, r] as const));
    const missingRoomIds = roomIds.filter((id) => !roomById.has(id));
    if (missingRoomIds.length > 0) {
      return res.status(400).json({ error: "One or more rooms do not exist", missing_room_ids: missingRoomIds });
    }

    const violations: Array<{ room_no: string; floor: number; current: number; incoming: number; capacity: number }> = [];
    for (const r of rooms) {
      const incoming = incomingByRoomId.get(r.id) ?? 0;
      const cap = roomCapacity(r.room_no, r.floor);
      const current = r._count.students;
      if (current + incoming > cap) {
        violations.push({
          room_no: toRoomNumberString(r.room_no),
          floor: r.floor,
          current,
          incoming,
          capacity: cap,
        });
      }
    }

    if (violations.length > 0) {
      return res.status(400).json({ error: "Room capacity exceeded", violations });
    }
  }

  const result = await prisma.student.createMany({
    data,
    skipDuplicates: true,
  });

  return res.status(201).json({ count: result.count });
}

export async function listStudents(_req: Request, res: Response) {
  const students = await prisma.student.findMany({
    orderBy: { roll_no: "asc" },
    include: { Room: { select: { room_no: true } } },
  });
  return res.status(200).json(students.map(serializeStudentForApi));
}

export async function getStudentDetails(req: Request, res: Response) {
  const { id } = req.params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      Room: {
        select: {
          id: true,
          room_no: true,
          floor: true,
          students: {
            select: {
              id: true,
              roll_no: true,
              name: true,
            },
            orderBy: { roll_no: "asc" },
          },
        },
      },
    },
  });

  if (!student) return res.status(404).json({ error: "Not Found" });

  const roommates = (student.Room?.students ?? []).filter((s) => s.id !== student.id);

  const [outpasses, messConcessions, fines] = await Promise.all([
    prisma.outPass.findMany({ where: { student_id: student.id }, orderBy: { start_date: "desc" } }),
    prisma.messConcession.findMany({ where: { student_id: student.id }, orderBy: { start_date: "desc" } }),
    prisma.fine.findMany({ where: { student_id: student.id }, orderBy: { fine_date: "desc" } }),
  ]);

  return res.status(200).json({
    student: serializeStudentForApi({
      id: student.id,
      roll_no: student.roll_no,
      name: student.name,
      std_phone_no: student.std_phone_no,
      father_name: student.father_name,
      father_phone_no: student.father_phone_no,
      branch: student.branch,
      state: student.state,
      gender: student.gender,
      room_no: student.room_no,
      Room: student.Room ? { room_no: student.Room.room_no } : null,
    }),
    roommates,
    room: student.Room
      ? {
          id: student.Room.id,
          room_no: toRoomNumberString(student.Room.room_no),
          floor: student.Room.floor,
        }
      : null,
    outpasses,
    mess_concessions: messConcessions,
    fines,
  });
}

export async function deleteStudent(req: Request, res: Response) {
  const { id } = req.params;

  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Not Found" });

  await prisma.student.delete({ where: { id } });
  return res.status(204).send();
}

export async function bulkDeleteStudents(req: Request, res: Response) {
  const { ids } = req.body as { ids?: string[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids[] is required" });
  }

  const result = await prisma.student.deleteMany({
    where: { id: { in: ids } },
  });

  return res.status(200).json({ count: result.count });
}

type AssignRoomsBody = {
  groups?: string[][];
  floorA?: number;
  floorB?: number;
};

function isValidFloor(floor: unknown): floor is number {
  return typeof floor === "number" && Number.isInteger(floor) && floor >= 0 && floor <= 4;
}

function buildRoomNumbersForFloor(floor: number) {
  const max = floor === 0 ? 20 : 48;
  const roomNos: number[] = [];
  for (let i = 1; i <= max; i++) {
    roomNos.push(floor * 100 + i);
  }
  return roomNos;
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j]!;
    arr[j] = tmp!;
  }
  return arr;
}

export async function assignRooms(req: Request, res: Response) {
  const body = req.body as AssignRoomsBody;
  
  console.log(`[AssignRooms] Incoming req: floorA=${body.floorA}, floorB=${body.floorB}, groups count=${body.groups?.length}`);

  if (!Array.isArray(body.groups) || body.groups.length === 0) {
    console.log("[AssignRooms] Error: groups array is empty or not an array");
    return res.status(400).json({ error: "groups[][] is required" });
  }

  const floorA = body.floorA ?? 0;
  const floorB = body.floorB ?? floorA;

  if (!isValidFloor(floorA) || !isValidFloor(floorB)) {
    return res.status(400).json({ error: "floorA and floorB must be integers between 0 and 4" });
  }

  const normalizedGroups = body.groups.map((g) =>
    (Array.isArray(g) ? g : [])
      .map((r) => String(r).trim())
      .filter((r) => r.length > 0),
  );

  const badGroupIndex = normalizedGroups.findIndex((g) => g.length !== 4 && g.length !== 5);
  if (badGroupIndex !== -1) {
    return res.status(400).json({ error: `groups[${badGroupIndex}] must have 4 or 5 students` });
  }

  for (let i = 0; i < normalizedGroups.length; i++) {
    const unique = new Set(normalizedGroups[i]);
    if (unique.size !== normalizedGroups[i]!.length) {
      return res.status(400).json({ error: `groups[${i}] contains duplicate roll numbers` });
    }
  }

  const allRollNos = normalizedGroups.flat();
  const allRollNosSet = new Set(allRollNos);
  if (allRollNosSet.size !== allRollNos.length) {
    return res.status(400).json({ error: "Duplicate roll numbers across groups" });
  }

  // Validate that all roll numbers exist.
  const existingStudents = await prisma.student.findMany({
    where: { roll_no: { in: allRollNos } },
    select: { roll_no: true },
  });
  const existingSet = new Set(existingStudents.map((s) => s.roll_no));
  const missing = allRollNos.filter((r) => !existingSet.has(r));
  if (missing.length > 0) {
    console.log(`[AssignRooms] Error: ${missing.length} students missing from DB (e.g. ${missing[0]})`);
    return res.status(400).json({ error: "Some students were not found in DB", missing_roll_nos: missing });
  }
  console.log(`[AssignRooms] DB completely verified. All ${allRollNos.length} students exist.`);

  // Compute available rooms per floor. Prefer empty rooms; also allow rooms that will be fully vacated
  // by this operation (all occupants are in the provided roll_no list).

  async function computeAvailableRoomsForFloor(floor: number) {
    const candidateRoomNos = buildRoomNumbersForFloor(floor);
    const rooms = await prisma.room.findMany({
      where: { room_no: { in: candidateRoomNos } },
      select: {
        room_no: true,
        students: { select: { roll_no: true } },
      },
    });
    const roomByNo = new Map<number, { room_no: number; students: { roll_no: string }[] }>();
    for (const r of rooms) roomByNo.set(r.room_no, r);

    const available: number[] = [];
    for (const roomNo of candidateRoomNos) {
      const existing = roomByNo.get(roomNo);
      if (!existing) {
        available.push(roomNo);
        continue;
      }

      if (existing.students.length === 0) {
        available.push(roomNo);
        continue;
      }

      const willVacate = existing.students.every((s) => allRollNosSet.has(s.roll_no));
      if (willVacate) available.push(roomNo);
    }

    return shuffleInPlace(available);
  }

  // Fill floorA as much as possible (up to its available room capacity). Remaining groups go to floorB.
  const poolA = await computeAvailableRoomsForFloor(floorA);
  const poolB = floorB === floorA ? poolA : await computeAvailableRoomsForFloor(floorB);

  const maxOnA = floorB === floorA ? normalizedGroups.length : Math.min(normalizedGroups.length, poolA.length);
  
  console.log(`[AssignRooms] pool A limit: ${poolA.length}, pool B limit: ${poolB.length}`);
  console.log(`[AssignRooms] Allocating ${maxOnA} groups to floor ${floorA}`);
  
  const groupsWithFloor: { students: string[]; floor: number }[] = normalizedGroups.map((students, idx) => ({
    students,
    floor: idx < maxOnA ? floorA : floorB,
  }));

  // Enforce per-room capacity: floor 0 (001–020) only supports 4 students.
  const invalidOnGroundIndex = groupsWithFloor.findIndex((g) => g.floor === 0 && g.students.length > 4);
  if (invalidOnGroundIndex !== -1) {
    return res.status(400).json({
      error: `groups[${invalidOnGroundIndex}] has ${groupsWithFloor[invalidOnGroundIndex]!.students.length} students but floor 0 rooms support max 4`,
    });
  }

  const assignments: { floor: number; roomNo: number; students: string[] }[] = [];
  for (const group of groupsWithFloor) {
    const pool = group.floor === floorA ? poolA : poolB;
    const roomNo = pool.pop();
    if (roomNo == null) {
      console.log(`[AssignRooms] Error: Pool ran out on floor ${group.floor}!`);
      return res.status(400).json({ error: `Not enough available rooms on floor ${group.floor}` });
    }
    assignments.push({ floor: group.floor, roomNo, students: group.students });
  }

  await prisma.$transaction(async (tx) => {
    const roomIdByRoomNo = new Map<number, string>();

    // Resolve/upsert rooms.
    for (const a of assignments) {
      if (roomIdByRoomNo.has(a.roomNo)) continue;
      const roomId = await resolveRoomId(String(a.roomNo), tx as any);
      roomIdByRoomNo.set(a.roomNo, roomId);
    }

    // Update students.
    for (const a of assignments) {
      const roomId = roomIdByRoomNo.get(a.roomNo)!;
      await tx.student.updateMany({
        where: { roll_no: { in: a.students } },
        data: { room_no: roomId },
      });
    }
  }, {
    maxWait: 10000,
    timeout: 30000,
  });

  return res.status(200).json({
    groups_assigned: assignments.length,
    assignments: assignments.map((a) => ({
      floor: a.floor,
      room_no: toRoomNumberString(a.roomNo),
      students: a.students,
    })),
  });
}

export async function moveStudentRoom(req: Request, res: Response) {
  const { id } = req.params;
  const { room_no } = req.body;
  if (!room_no) return res.status(400).json({ error: "room_no is required" });

  try {
    await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({ where: { id }, select: { id: true, room_no: true } });
      if (!student) {
        const err = new Error("Student not found");
        (err as any).statusCode = 404;
        throw err;
      }

      const roomId = await resolveRoomId(String(room_no), tx as any);
      if (student.room_no && student.room_no === roomId) return;

      await assertRoomHasSpace(roomId, 1, tx);
      await tx.student.update({ where: { id }, data: { room_no: roomId } });
    });
  } catch (e) {
    const statusCode = typeof e === "object" && e && "statusCode" in e ? Number((e as any).statusCode) : 400;
    return res.status(Number.isFinite(statusCode) ? statusCode : 400).json({ error: e instanceof Error ? e.message : "Move failed" });
  }

  return res.json({ success: true });
}

export async function removeStudentRoom(req: Request, res: Response) {
  const { id } = req.params;
  
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return res.status(404).json({ error: "Student not found" });

  await prisma.student.update({ where: { id }, data: { room_no: null } });
  return res.json({ success: true });
}
