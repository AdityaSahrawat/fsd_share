"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiGet, apiPost } from "@/lib/api";

type Branch = "CSE" | "DSAI" | "ECE";
type Gender = "MALE" | "FEMALE" | "OTHER";

type Student = {
  id: string;
  roll_no: string;
  name: string | null;
  std_phone_no: string | null;
  father_name: string | null;
  father_phone_no: string | null;
  branch: Branch;
  state: string;
  gender: Gender;
  room_no: string;
};

type StudentCreate = {
  roll_no: string;
  name?: string;
  std_phone_no?: string;
  father_name?: string;
  father_phone_no?: string;
  branch: Branch;
  state: string;
  gender: Gender;
  room_no: string;
};

type StudentDetails = {
  student: Student;
  room: { id: string; room_no: string; floor: number } | null;
  roommates: Array<{ id: string; roll_no: string; name: string | null }>;
  outpasses: Array<{ id: string; start_date: string; end_date: string; days: number; image_url: string | null }>;
  mess_concessions: Array<{ id: string; start_date: string; End_date: string; days: number; image_url: string | null }>;
  fines: Array<{ id: string; amount: number; fine_date: string; paid_date: string | null }>;
};

function parseBulkStudents(input: string, mode: "csv" | "json"): StudentCreate[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  if (mode === "json") {
    const parsed = JSON.parse(trimmed) as any;
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.students) ? parsed.students : null;
    if (!Array.isArray(arr)) throw new Error("JSON must be an array or { students: [...] }");

    return arr.map((s, i) => {
      const roll_no = String(s.roll_no ?? s.rollNo ?? s.rollno ?? "").trim();
      const branch = String(s.branch ?? "").trim() as Branch;
      const state = String(s.state ?? "").trim();
      const genderRaw = String(s.gender ?? "").trim();
      const gender = (genderRaw || "MALE") as Gender;
      const room_no = String(s.room_no ?? s.roomNo ?? s.roomno ?? "").trim();

      if (!roll_no || !branch || !state || !gender || !room_no) {
        throw new Error(`Missing fields in row ${i + 1}`);
      }

      const name = String(s.name ?? "").trim() || undefined;
      const std_phone_no = String(s.std_phone_no ?? s.student_phone_no ?? "").trim() || undefined;
      const father_name = String(s.father_name ?? "").trim() || undefined;
      const father_phone_no = String(s.father_phone_no ?? "").trim() || undefined;

      return { roll_no, name, std_phone_no, father_name, father_phone_no, branch, state, gender, room_no };
    });
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const maybeHeader = lines[0].toLowerCase();
  const startIndex = maybeHeader.includes("roll") && maybeHeader.includes("branch") ? 1 : 0;

  const rows = lines.slice(startIndex);
  return rows.map((line, idx) => {
    const parts = line.split(",").map((p) => p.trim());

    // Support both formats:
    // - 5 cols: roll_no, branch, state, gender, room_no
    // - 4 cols: roll_no, branch, state, room_no (gender defaults)
    if (parts.length < 4) throw new Error(`CSV row ${idx + 1} must have 4 or 5 columns`);

    const [roll_no, branchRaw, state, maybeGender, maybeRoom] = parts;
    const hasGender = parts.length >= 5;
    const genderRaw = hasGender ? maybeGender : "MALE";
    const room_no = hasGender ? (maybeRoom ?? "") : (maybeGender ?? "");
    const branch = branchRaw as Branch;
    const gender = genderRaw as Gender;

    if (!roll_no || !branch || !state || !gender || !room_no) {
      throw new Error(`Missing fields in CSV row ${idx + 1}`);
    }

    return { roll_no, branch, state, gender, room_no };
  });
}

export default function StudentsPage() {
  const { auth } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [details, setDetails] = useState<StudentDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const [single, setSingle] = useState<StudentCreate>({
    roll_no: "",
    name: "",
    std_phone_no: "",
    father_name: "",
    father_phone_no: "",
    branch: "CSE",
    state: "",
    gender: "MALE",
    room_no: "",
  });

  const [bulkMode, setBulkMode] = useState<"csv" | "json">("csv");
  const [bulkText, setBulkText] = useState("");
  const [bulkPreviewError, setBulkPreviewError] = useState<string | null>(null);
  const [bulkPreviewCount, setBulkPreviewCount] = useState(0);

  const selectedCount = selectedIds.size;

  useEffect(() => {
    try {
      const parsed = parseBulkStudents(bulkText, bulkMode);
      setBulkPreviewCount(parsed.length);
      setBulkPreviewError(null);
    } catch (e) {
      setBulkPreviewCount(0);
      setBulkPreviewError(e instanceof Error ? e.message : "Invalid input");
    }
  }, [bulkText, bulkMode]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      return (
        s.roll_no.toLowerCase().includes(q) ||
        s.room_no.toLowerCase().includes(q) ||
        s.branch.toLowerCase().includes(q) ||
        s.state.toLowerCase().includes(q) ||
        s.gender.toLowerCase().includes(q)
      );
    });
  }, [students, search]);

  const filteredIds = useMemo(() => filteredStudents.map((s) => s.id), [filteredStudents]);
  const filteredSelectedCount = useMemo(() => {
    let count = 0;
    for (const id of filteredIds) if (selectedIds.has(id)) count++;
    return count;
  }, [filteredIds, selectedIds]);
  const allFilteredSelected = filteredIds.length > 0 && filteredSelectedCount === filteredIds.length;
  const someFilteredSelected = filteredSelectedCount > 0 && !allFilteredSelected;

  function toggleSelectAllFiltered() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      // Replace selection with exactly the currently filtered set.
      setSelectedIds(new Set(filteredIds));
    }
    setLastClickedIndex(null);
  }

  async function onBulkFile(file: File) {
    const text = await file.text();
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".json")) setBulkMode("json");
    if (lower.endsWith(".csv")) setBulkMode("csv");
    setBulkText(text);
  }

  async function load() {
    if (!auth) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<Student[]>("/students", auth.token);
      setStudents(data);
      setSelectedIds(new Set());
      setLastClickedIndex(null);
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String((e as any).message) : "Failed to load";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token]);

  useEffect(() => {
    if (!auth) return;
    if (!activeStudentId) {
      setDetails(null);
      setDetailsError(null);
      setDetailsLoading(false);
      return;
    }

    let cancelled = false;
    setDetailsLoading(true);
    setDetailsError(null);
    setDetails(null);

    apiGet<StudentDetails>(`/students/${activeStudentId}/details`, auth.token)
      .then((data) => {
        if (cancelled) return;
        setDetails(data);
      })
      .catch((e) => {
        if (cancelled) return;
        const message = typeof e === "object" && e && "message" in e ? String((e as any).message) : "Failed to load details";
        setDetails(null);
        setDetailsError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeStudentId, auth]);

  function exportAsJSON() {
    const data = filteredStudents.map((s) => ({
      roll_no: s.roll_no,
      name: s.name,
      branch: s.branch,
      state: s.state,
      gender: s.gender,
      room_no: s.room_no,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportAsCSV() {
    const lines = ["Roll_No,Name,Branch,State,Gender,Room_No"];
    for (const s of filteredStudents) {
      const name = s.name ? `"${s.name.replace(/"/g, '""')}"` : "";
      lines.push(`${s.roll_no},${name},${s.branch},${s.state},${s.gender},${s.room_no || ""}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toggleOne(index: number, shiftKey: boolean) {
    const student = filteredStudents[index];
    if (!student) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (shiftKey && lastClickedIndex !== null) {
        const a = Math.min(lastClickedIndex, index);
        const b = Math.max(lastClickedIndex, index);
        for (let i = a; i <= b; i++) {
          const id = filteredStudents[i]?.id;
          if (id) next.add(id);
        }
      } else {
        if (next.has(student.id)) next.delete(student.id);
        else next.add(student.id);
      }

      return next;
    });

    setLastClickedIndex(index);
  }

  function toggleDetails(studentId: string) {
    setActiveStudentId((prev) => (prev === studentId ? null : studentId));
  }

  async function onCreateSingle(e: React.FormEvent) {
    e.preventDefault();
    if (!auth) return;

    setError(null);
    try {
      await apiPost("/students", single, auth.token);
      setSingle({
        roll_no: "",
        name: "",
        std_phone_no: "",
        father_name: "",
        father_phone_no: "",
        branch: "CSE",
        state: "",
        gender: "MALE",
        room_no: "",
      });
      await load();
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String((e as any).message) : "Failed to create";
      setError(message);
    }
  }

  async function onCreateBulk() {
    if (!auth) return;

    setError(null);
    try {
      const parsed = parseBulkStudents(bulkText, bulkMode);
      if (parsed.length === 0) throw new Error("No students found in input");

      await apiPost("/students/bulk", { students: parsed }, auth.token);
      setBulkText("");
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Bulk add failed";
      setError(message);
    }
  }

  async function onDeleteSelected() {
    if (!auth) return;
    if (selectedIds.size === 0) return;

    const q = search.trim();
    const suffix = q ? ` (current search: "${q}")` : "";

    const countToDelete = q ? filteredSelectedCount : selectedIds.size;
    const ok = window.confirm(`Delete ${countToDelete} selected students${suffix}? This cannot be undone.`);
    if (!ok) return;

    setError(null);
    try {
      await apiPost("/students/bulk-delete", { ids: Array.from(selectedIds) }, auth.token);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Bulk delete failed";
      setError(message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Students</h1>
          <p className="text-sm opacity-80 mt-1">Tip: shift-click to select a range for bulk delete.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="text-sm rounded-md px-3 py-2 border border-foreground/15 hover:border-foreground/30 bg-foreground/5"
            onClick={() => load()}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="border border-foreground/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="text-sm font-medium">Search</div>
        <input
          className="flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Roll no / Room / Branch / State"
        />
        <div className="text-xs opacity-70">Showing {filteredStudents.length} / {students.length}</div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-foreground/10 rounded-xl p-5">
          <h2 className="font-semibold">Add a student</h2>
          <form className="mt-4 space-y-3" onSubmit={onCreateSingle}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm">Roll no</label>
                <input
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                  value={single.roll_no}
                  onChange={(e) => setSingle((p) => ({ ...p, roll_no: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm">Room</label>
                <input
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                  value={single.room_no}
                  onChange={(e) => setSingle((p) => ({ ...p, room_no: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm">Name</label>
                <input
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                  value={single.name ?? ""}
                  onChange={(e) => setSingle((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm">Student phone no</label>
                <input
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                  value={single.std_phone_no ?? ""}
                  onChange={(e) => setSingle((p) => ({ ...p, std_phone_no: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm">Father name</label>
                <input
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                  value={single.father_name ?? ""}
                  onChange={(e) => setSingle((p) => ({ ...p, father_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm">Father phone no</label>
                <input
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                  value={single.father_phone_no ?? ""}
                  onChange={(e) => setSingle((p) => ({ ...p, father_phone_no: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm">Branch</label>
                <select
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                  value={single.branch}
                  onChange={(e) => setSingle((p) => ({ ...p, branch: e.target.value as Branch }))}
                >
                  <option value="CSE">CSE</option>
                  <option value="DSAI">DSAI</option>
                  <option value="ECE">ECE</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm">Gender</label>
                <select
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                  value={single.gender}
                  onChange={(e) => setSingle((p) => ({ ...p, gender: e.target.value as Gender }))}
                >
                  <option value="MALE">MALE</option>
                  <option value="FEMALE">FEMALE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm">State</label>
              <input
                className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
                value={single.state}
                onChange={(e) => setSingle((p) => ({ ...p, state: e.target.value }))}
              />
            </div>

            <button
              className="text-sm rounded-lg px-3 py-2 border border-foreground/30 bg-foreground text-background hover:bg-foreground/90"
              type="submit"
            >
              Add student
            </button>
          </form>
        </div>

        <div className="border border-foreground/10 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Bulk add</h2>
            <select
              className="text-sm rounded-lg border border-foreground/15 bg-background px-2 py-1 outline-none focus:border-foreground/30"
              value={bulkMode}
              onChange={(e) => setBulkMode(e.target.value as any)}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <p className="text-xs opacity-70 mt-2">
            CSV format: <span className="font-mono">roll_no,branch,state,gender,room_no</span> (header optional)
          </p>

          <textarea
            className="mt-3 w-full h-40 rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30 font-mono text-xs"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={bulkMode === "csv" ? "22CSE001,CSE,Delhi,MALE,R101\n22CSE002,CSE,UP,FEMALE,R101" : "[{\"roll_no\":\"22CSE001\",\"branch\":\"CSE\",\"state\":\"Delhi\",\"gender\":\"MALE\",\"room_no\":\"R101\"}]"}
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <label className="text-xs opacity-70">
              <span className="mr-2">Upload file</span>
              <input
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onBulkFile(f);
                }}
              />
            </label>
            <div className="text-xs opacity-70">
              {bulkPreviewError ? <span className="text-red-600">{bulkPreviewError}</span> : <span>{bulkPreviewCount} students parsed</span>}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-xs opacity-70" />
            <button
              className="text-sm rounded-lg px-3 py-2 border border-foreground/30 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-60"
              onClick={() => void onCreateBulk()}
              disabled={!bulkText.trim() || Boolean(bulkPreviewError)}
            >
              Add bulk
            </button>
          </div>
        </div>
      </section>

      <section className="border border-foreground/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-foreground/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold">All students</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs rounded border border-foreground/30 px-2 py-1 hover:bg-foreground/5 disabled:opacity-50"
                onClick={exportAsCSV}
                disabled={filteredStudents.length === 0}
              >
                CSV
              </button>
              <button
                type="button"
                className="text-xs rounded border border-foreground/30 px-2 py-1 hover:bg-foreground/5 disabled:opacity-50"
                onClick={exportAsJSON}
                disabled={filteredStudents.length === 0}
              >
                JSON
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm select-none">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someFilteredSelected;
                }}
                onChange={() => toggleSelectAllFiltered()}
                disabled={filteredIds.length === 0}
              />
              <span className="opacity-80">Select all (filtered)</span>
            </label>
            <button
              className="text-sm rounded-md px-3 py-2 border border-foreground/15 hover:border-foreground/30"
              onClick={() => {
                setSelectedIds(new Set());
                setLastClickedIndex(null);
              }}
              disabled={selectedCount === 0}
            >
              Clear
            </button>
            <button
              className="text-sm rounded-md px-3 py-2 border border-foreground/30 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-60"
              onClick={onDeleteSelected}
              disabled={selectedCount === 0}
            >
              Delete ({search.trim() ? filteredSelectedCount : selectedCount})
            </button>
            <div className="text-sm opacity-70">{students.length} total</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-foreground/10">
              <tr>
                <th className="px-5 py-3 w-10">Sel</th>
                <th className="px-5 py-3">Roll</th>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3">State</th>
                <th className="px-5 py-3">Gender</th>
                <th className="px-5 py-3">Room</th>
                <th className="px-5 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s, index) => {
                const checked = selectedIds.has(s.id);
                const active = activeStudentId === s.id;
                return (
                  <Fragment key={s.id}>
                    <tr
                      className={
                        "border-b border-foreground/5 cursor-pointer hover:bg-foreground/5 " +
                        (active ? "bg-foreground/10" : checked ? "bg-foreground/5" : "")
                      }
                      onClick={(e) => toggleOne(index, e.shiftKey)}
                    >
                      <td className="px-5 py-3">
                        <input type="checkbox" checked={checked} readOnly />
                      </td>
                      <td className="px-5 py-3 font-mono text-xs">{s.roll_no}</td>
                      <td className="px-5 py-3">{s.branch}</td>
                      <td className="px-5 py-3">{s.state}</td>
                      <td className="px-5 py-3">{s.gender}</td>
                      <td className="px-5 py-3">{s.room_no}</td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          className="text-xs rounded border border-foreground/30 px-2 py-1 hover:bg-foreground/5"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDetails(s.id);
                          }}
                        >
                          {active ? "Hide details" : "View details"}
                        </button>
                      </td>
                    </tr>

                    {active ? (
                      <tr className="border-b border-foreground/10">
                        <td colSpan={7} className="px-5 py-4 bg-foreground/5">
                          {detailsLoading ? <div className="text-sm opacity-70">Loading details…</div> : null}
                          {detailsError ? <div className="text-sm text-red-600">{detailsError}</div> : null}

                          {!detailsLoading && details ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="text-sm font-medium">Profile</div>
                                <div className="text-sm space-y-1">
                                  <div>
                                    <span className="opacity-70">Roll:</span> <span className="font-mono">{details.student.roll_no}</span>
                                  </div>
                                  <div>
                                    <span className="opacity-70">Name:</span> {details.student.name || "—"}
                                  </div>
                                  <div>
                                    <span className="opacity-70">Student phone:</span> {details.student.std_phone_no || "—"}
                                  </div>
                                  <div>
                                    <span className="opacity-70">Father name:</span> {details.student.father_name || "—"}
                                  </div>
                                  <div>
                                    <span className="opacity-70">Father phone:</span> {details.student.father_phone_no || "—"}
                                  </div>
                                  <div>
                                    <span className="opacity-70">Branch:</span> {details.student.branch}
                                  </div>
                                  <div>
                                    <span className="opacity-70">State:</span> {details.student.state}
                                  </div>
                                  <div>
                                    <span className="opacity-70">Gender:</span> {details.student.gender}
                                  </div>
                                  <div>
                                    <span className="opacity-70">Room:</span> {details.room?.room_no ?? details.student.room_no}
                                    {details.room ? <span className="opacity-70"> (floor {details.room.floor})</span> : null}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="text-sm font-medium">Roommates</div>
                                {details.roommates.length === 0 ? (
                                  <div className="text-sm opacity-70">No roommates found.</div>
                                ) : (
                                  <div className="space-y-1">
                                    {details.roommates.map((rm) => (
                                      <div key={rm.id} className="text-sm">
                                        <span className="font-mono text-xs">{rm.roll_no}</span>
                                        {rm.name ? <span className="opacity-80"> • {rm.name}</span> : null}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                <div className="text-sm font-medium">Outpasses</div>
                                {details.outpasses.length === 0 ? (
                                  <div className="text-sm opacity-70">No outpasses.</div>
                                ) : (
                                  <div className="overflow-auto border border-foreground/10 rounded-lg">
                                    <table className="w-full text-sm">
                                      <thead className="bg-background/50">
                                        <tr>
                                          <th className="text-left p-2 border-b border-foreground/10">Start</th>
                                          <th className="text-left p-2 border-b border-foreground/10">End</th>
                                          <th className="text-left p-2 border-b border-foreground/10">Days</th>
                                          <th className="text-left p-2 border-b border-foreground/10">Image</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {details.outpasses.map((op) => (
                                          <tr key={op.id} className="border-b border-foreground/10 last:border-b-0">
                                            <td className="p-2 font-mono text-xs">{String(op.start_date).slice(0, 10)}</td>
                                            <td className="p-2 font-mono text-xs">{String(op.end_date).slice(0, 10)}</td>
                                            <td className="p-2">{op.days}</td>
                                            <td className="p-2">{op.image_url ? "Yes" : "—"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                <div className="text-sm font-medium">Mess concessions</div>
                                {details.mess_concessions.length === 0 ? (
                                  <div className="text-sm opacity-70">No mess concessions.</div>
                                ) : (
                                  <div className="overflow-auto border border-foreground/10 rounded-lg">
                                    <table className="w-full text-sm">
                                      <thead className="bg-background/50">
                                        <tr>
                                          <th className="text-left p-2 border-b border-foreground/10">Start</th>
                                          <th className="text-left p-2 border-b border-foreground/10">End</th>
                                          <th className="text-left p-2 border-b border-foreground/10">Days</th>
                                          <th className="text-left p-2 border-b border-foreground/10">Image</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {details.mess_concessions.map((mc) => (
                                          <tr key={mc.id} className="border-b border-foreground/10 last:border-b-0">
                                            <td className="p-2 font-mono text-xs">{String(mc.start_date).slice(0, 10)}</td>
                                            <td className="p-2 font-mono text-xs">{String(mc.End_date).slice(0, 10)}</td>
                                            <td className="p-2">{mc.days}</td>
                                            <td className="p-2">{mc.image_url ? "Yes" : "—"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2 md:col-span-2">
                                <div className="text-sm font-medium border-t border-foreground/10 pt-4 mt-2">Fines Ledger</div>
                                {details.fines.length === 0 ? (
                                  <div className="text-sm opacity-70">No fines recorded.</div>
                                ) : (
                                  <div className="overflow-auto border border-foreground/10 rounded-lg">
                                    <table className="w-full text-sm">
                                      <thead className="bg-background/50">
                                        <tr>
                                          <th className="text-left p-2 border-b border-foreground/10">Date Issued</th>
                                          <th className="text-left p-2 border-b border-foreground/10">Amount</th>
                                          <th className="text-left p-2 border-b border-foreground/10">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {details.fines.map((f) => {
                                          const isPaid = f.paid_date !== null;
                                          return (
                                            <tr key={f.id} className="border-b border-foreground/10 last:border-b-0">
                                              <td className="p-2 font-mono text-xs">{new Date(f.fine_date).toLocaleDateString()}</td>
                                              <td className="p-2 font-semibold">₹{f.amount}</td>
                                              <td className="p-2">
                                                {isPaid ? (
                                                  <span className="inline-flex text-xs px-2 py-0.5 rounded font-medium bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20">
                                                    Paid on {new Date(f.paid_date!).toLocaleDateString()}
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex text-xs px-2 py-0.5 rounded font-medium bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
                                                    Unpaid
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}

              {filteredStudents.length === 0 && !isLoading ? (
                <tr>
                  <td className="px-5 py-6 text-sm opacity-70" colSpan={7}>
                    No students found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-xs opacity-70">
        Optional: you can also delete a single student via <span className="font-mono">DELETE /students/:id</span>.
      </div>
    </div>
  );
}
