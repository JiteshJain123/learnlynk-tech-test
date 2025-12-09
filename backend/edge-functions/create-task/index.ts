// @ts-nocheck

// backend/edge-functions/create-task/index.ts

// Supabase Edge Functions run on Deno.
// TODO: In a real system, derive tenant_id from the application and set a title
// when inserting into `tasks`. For this assessment, we focus on type/due_at/status.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type CreateTaskPayload = {
  application_id?: string;
  task_type?: string;
  due_at?: string;
};

const ALLOWED_TASK_TYPES = ["call", "email", "review"] as const;

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const body: CreateTaskPayload = await req.json();

    const { application_id, task_type, due_at } = body;

    // Basic input validation
    if (!application_id || !task_type || !due_at) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!ALLOWED_TASK_TYPES.includes(task_type as any)) {
      return new Response(
        JSON.stringify({ error: "Invalid task_type" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const due = new Date(due_at);
    const now = new Date();

    if (isNaN(due.getTime())) {
      return new Response(
        JSON.stringify({ error: "Invalid due_at timestamp" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (due <= now) {
      return new Response(
        JSON.stringify({ error: "due_at must be in the future" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Insert into tasks table
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        application_id,
        type: task_type,
        due_at: due.toISOString(),
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create task" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const taskId = data.id;

  
    try {
      const channel = supabase.channel("tasks");
      await channel.send({
        type: "broadcast",
        event: "task.created",
        payload: {
          task_id: taskId,
          application_id,
          task_type,
          due_at: due.toISOString(),
        },
      });
    } catch (e) {
      console.warn("Realtime event failed (non-fatal):", e);
    }

    return new Response(
      JSON.stringify({ success: true, task_id: taskId }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
