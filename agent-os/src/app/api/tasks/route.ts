import { NextRequest, NextResponse } from "next/server";
import { CreateTaskSchema } from "@/domain/types";
import { taskRepository } from "@/infra/store/task-repository";

export async function GET() {
  try {
    const tasks = await taskRepository.findOpen();
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid task input", details: parsed.error.format() },
        { status: 400 },
      );
    }
    const task = await taskRepository.create(parsed.data);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
