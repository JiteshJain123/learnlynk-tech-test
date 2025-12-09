// frontend/pages/dashboard/today.tsx

import { NextPage } from "next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useMemo } from "react";

type Task = {
  id: string;
  type: string;
  application_id: string;
  due_at: string;
  status: string;
};

const fetchTasksDueToday = async (): Promise<Task[]> => {
  const now = new Date();

  // Start of today (00:00)
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );

  // Start of tomorrow
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );

  const { data, error } = await supabase
    .from("tasks")
    .select("id, type, application_id, due_at, status")
    .gte("due_at", start.toISOString())
    .lt("due_at", end.toISOString())
    .neq("status", "completed");

  if (error) {
    throw error;
  }

  return data as Task[];
};

const TodayDashboardPage: NextPage = () => {
  const queryClient = useQueryClient();

  const {
    data: tasks,
    isLoading,
    isError,
    error,
  } = useQuery<Task[], Error>({
    queryKey: ["tasks", "today"],
    queryFn: fetchTasksDueToday,
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", taskId);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      // Refetch tasks after mutation
      queryClient.invalidateQueries({ queryKey: ["tasks", "today"] });
    },
  });

  const handleMarkComplete = (taskId: string) => {
    markCompleteMutation.mutate(taskId);
  };

  const hasTasks = useMemo(() => tasks && tasks.length > 0, [tasks]);

  return (
    <main style={{ padding: "1.5rem", fontFamily: "sans-serif" }}>
      <h1>Tasks Due Today</h1>

      {isLoading && <p>Loading tasks...</p>}
      {isError && (
        <p style={{ color: "red" }}>
          Error loading tasks: {error?.message ?? "Unknown error"}
        </p>
      )}

      {!isLoading && !isError && !hasTasks && <p>No tasks due today 🎉</p>}

      {hasTasks && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "1rem",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  borderBottom: "1px solid #ccc",
                  textAlign: "left",
                  padding: "0.5rem",
                }}
              >
                Type
              </th>
              <th
                style={{
                  borderBottom: "1px solid #ccc",
                  textAlign: "left",
                  padding: "0.5rem",
                }}
              >
                Application ID
              </th>
              <th
                style={{
                  borderBottom: "1px solid #ccc",
                  textAlign: "left",
                  padding: "0.5rem",
                }}
              >
                Due At
              </th>
              <th
                style={{
                  borderBottom: "1px solid #ccc",
                  textAlign: "left",
                  padding: "0.5rem",
                }}
              >
                Status
              </th>
              <th
                style={{
                  borderBottom: "1px solid #ccc",
                  textAlign: "left",
                  padding: "0.5rem",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks!.map((task) => (
              <tr key={task.id}>
                <td style={{ padding: "0.5rem" }}>{task.type}</td>
                <td style={{ padding: "0.5rem" }}>{task.application_id}</td>
                <td style={{ padding: "0.5rem" }}>
                  {new Date(task.due_at).toLocaleString()}
                </td>
                <td style={{ padding: "0.5rem" }}>{task.status}</td>
                <td style={{ padding: "0.5rem" }}>
                  <button
                    onClick={() => handleMarkComplete(task.id)}
                    disabled={markCompleteMutation.isPending}
                  >
                    {markCompleteMutation.isPending
                      ? "Updating..."
                      : "Mark Complete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
};

export default TodayDashboardPage;
