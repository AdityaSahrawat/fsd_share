-- CreateEnum
CREATE TYPE "Branch" AS ENUM ('CSE', 'DSAI', 'ECE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('WARDEN', 'STAFF');

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "roll_no" TEXT NOT NULL,
    "branch" "Branch" NOT NULL,
    "state" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "room_no" TEXT NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "room_no" INTEGER NOT NULL,
    "floor" INTEGER NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessConcession" (
    "id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "End_date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "student_id" TEXT NOT NULL,

    CONSTRAINT "MessConcession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutPass" (
    "id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "student_id" TEXT NOT NULL,

    CONSTRAINT "OutPass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_roll_no_key" ON "Student"("roll_no");

-- CreateIndex
CREATE UNIQUE INDEX "Room_room_no_key" ON "Room"("room_no");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_username_key" ON "Staff"("username");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_room_no_fkey" FOREIGN KEY ("room_no") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessConcession" ADD CONSTRAINT "MessConcession_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutPass" ADD CONSTRAINT "OutPass_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
