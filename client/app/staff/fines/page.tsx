"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/providers";
import { apiGet, apiPost, apiPatch } from "@/lib/api";

type Branch = "CSE" | "DSAI" | "ECE";
type Gender = "MALE" | "FEMALE" | "OTHER";

type Student = {
  id: string;
  roll_no: string;
  branch: Branch;
  state: string;
  gender: Gender;
  room_no: string;
};

type Fine = {
  id: string;
  amount: number;
  fine_date: string;
  paid_date: string | null;
  student_id: string;
  student?: Student; // Returned directly by new GET /fines handler
};

export default function FinesPage() {
  const { auth } = useAuth();
  const [items, setItems] = useState<Fine[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const [form, setForm] = useState({
    student_id: "",
    amount: "",
    fine_date: new Date().toISOString().split("T")[0],
  });
  const [submitting, setSubmitting] = useState(false);

  const rollNoByStudentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) map.set(s.id, s.roll_no);
    return map;
  }, [students]);

  async function loadFines() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const finesData = await apiGet<Fine[]>("/fines", auth.token);
      setItems(finesData);
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String((e as any).message) : "Failed to load fines";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadStudents() {
    if (!auth) return;
    setStudentsLoading(true);
    setStudentsError(null);
    try {
      const studentsData = await apiGet<Student[]>("/students", auth.token);
      setStudents(studentsData);
    } catch (e) {
      const message = typeof e === "object" && e && "message" in e ? String((e as any).message) : "Failed to load students";
      setStudentsError(message);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }

  useEffect(() => {
    void loadFines();
    void loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!auth) return;
    setSubmitting(true);
    setError(null);
    try {
      const amountNum = Number(form.amount);
      if (!form.student_id || !form.fine_date || !Number.isFinite(amountNum) || amountNum <= 0) {
        throw new Error("Student, valid positive amount, and fine date are required");
      }

      await apiPost(
        "/fines",
        {
          student_id: form.student_id,
          fine_date: form.fine_date,
          amount: amountNum,
        },
        auth.token
      );

      setForm((prev) => ({ ...prev, amount: "", student_id: "" }));
      await loadFines();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create fine";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePaidStatus(fineId: string, currentStatus: boolean) {
    if (!auth) return;
    try {
      await apiPatch(`/fines/${fineId}/pay`, { paid: !currentStatus }, auth.token);
      await loadFines();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update fine state");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Fines Ledger</h1>
          <p className="text-sm opacity-80 mt-1">Create and manage student fines.</p>
        </div>
        <button
          className="text-sm rounded-md px-3 py-2 border border-foreground/15 hover:border-foreground/30 bg-foreground/5"
          onClick={() => {
            void loadFines();
            void loadStudents();
          }}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? <div className="text-sm p-3 rounded-lg bg-red-500/10 text-red-600">{error}</div> : null}

      <section className="border border-foreground/10 rounded-xl p-5">
        <h2 className="font-semibold">Log a New Fine</h2>
        <form className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={onCreate}>
          <div className="space-y-1 md:col-span-1">
            <label className="text-sm">Student</label>
            <select
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
              value={form.student_id}
              onChange={(e) => setForm((p) => ({ ...p, student_id: e.target.value }))}
              disabled={studentsLoading || !!studentsError}
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.roll_no} • {s.branch}
                </option>
              ))}
            </select>
            {studentsLoading ? <div className="text-xs opacity-70">Loading students…</div> : null}
            {studentsError ? <div className="text-xs text-red-600">{studentsError}</div> : null}
          </div>
          <div className="space-y-1">
            <label className="text-sm">Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Fine Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-foreground/30"
              value={form.fine_date}
              onChange={(e) => setForm((p) => ({ ...p, fine_date: e.target.value }))}
            />
          </div>

          <div className="md:col-span-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="text-sm rounded-lg px-3 py-2 border border-foreground/30 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Register Fine"}
            </button>
          </div>
        </form>
      </section>

      <section className="border border-foreground/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-foreground/10 flex items-center justify-between">
          <div className="font-semibold">All Recorded Fines</div>
          <div className="text-sm opacity-70">{items.length} records</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-foreground/10 bg-foreground/5">
              <tr>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Date Issued</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => {
                const rollNo = m.student?.roll_no ?? rollNoByStudentId.get(m.student_id) ?? m.student_id;
                const isPaid = m.paid_date !== null;
                
                return (
                  <tr key={m.id} className="border-b border-foreground/5">
                    <td className="px-5 py-3 font-mono text-xs">{rollNo}</td>
                    <td className="px-5 py-3 font-semibold">₹{m.amount}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {new Date(m.fine_date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      {isPaid ? (
                         <span className="inline-flex text-xs px-2 py-0.5 rounded font-medium bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20">
                           Paid on {new Date(m.paid_date!).toLocaleDateString()}
                         </span>
                      ) : (
                         <span className="inline-flex text-xs px-2 py-0.5 rounded font-medium bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
                           Unpaid
                         </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className="text-xs rounded border border-foreground/20 px-3 py-1.5 hover:bg-foreground/5 opacity-80"
                        onClick={() => void togglePaidStatus(m.id, isPaid)}
                      >
                        {isPaid ? "Mark as Unpaid" : "Mark as Paid"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && !loading ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-center opacity-70" colSpan={5}>
                    No fines recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
