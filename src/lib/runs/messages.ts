// Тексти екранів зрізу в одному місці. Повідомлення й статуси — дослівно з AC і глосарію PM
// (робоче рішення до відповіді на solomchaak/property-workflows-spec#13: інтерфейс англійською).
export const MESSAGES = {
  caseNameRequired: "Enter a case name",
  caseNameTooLong: "Case name must be at most 100 characters",
  markNotAllowed: "Only the task's assignee, the run manager, or an administrator can mark a task as done",
  launchNotAllowed: "Only a manager or an administrator can launch a template",
  templateNotFound: "Choose a template",
  invalidAssignee: "An assignee must be a manager or an administrator",
  runNotFound: "Run not found",
  unexpected: "Something went wrong. Try again.",
} as const;

export const RUN_STATUS_LABELS = {
  in_progress: "in progress",
  completed: "completed",
} as const;

export const TASK_STATUS_LABELS = {
  to_do: "to do",
  done: "done",
} as const;

export const REQUIRED_LABELS = {
  required: "required",
  optional: "optional",
} as const;
