export type ActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialActionState: ActionState = {
  status: "idle",
};

export function actionError(
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}
