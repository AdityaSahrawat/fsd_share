-- CreateTable
CREATE TABLE "Fine" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fine_date" TIMESTAMP(3) NOT NULL,
    "paid_date" TIMESTAMP(3),
    "student_id" TEXT NOT NULL,

    CONSTRAINT "Fine_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
