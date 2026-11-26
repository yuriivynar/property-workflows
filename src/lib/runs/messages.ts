// Тексти екранів зрізу в одному місці. Повідомлення й статуси — дослівно з AC і глосарію PM
// (робоче рішення до відповіді на solomchaak/property-workflows-spec#13: інтерфейс англійською).
export const MESSAGES = {
  caseNameRequired: "Enter a case name",
  caseNameTooLong: "Case name must be at most 100 characters",
  markNotAllowed: "Only the task's assignee, the run manager, or an administrator can mark a task as done",
  launchNotAllowed: "Only a manager or an administrator can launch a template",
  templateNotFound: "Choose a template",
  invalidAssignee: "An assignee must be a manager, an administrator or a vendor",
  runNotFound: "Run not found",
  noVendorTasks: "No tasks assigned to you yet.", // AC-VENDOR-10, дослівно
  confirmationRequired: "This is the last required task: confirm to mark it as done. This cannot be undone.",
  unexpected: "Something went wrong. Try again.",
  // Робоче рішення (рев'ю PR #17): версію шаблону змінили, поки заповнювали форму запуску.
  templateVersionChanged: "The template has a new version. Review the tasks and launch again.",
  templateNotLoaded: "The template could not be loaded. Try again.",
  answerNotAllowed: "Only the run manager or an administrator can change the answers", // AC-LOGIC-05, дослівно
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

/** Інші написи екранів зрізу (/runs, /runs/new, /runs/[id]) — теж тут, щоб мову змінювати в одному файлі. */
export const LABELS = {
  runsTitle: "Runs",
  // Вкладки й фільтр списку (рішення власника 2026-11-26, тексти — з полотна UI v3).
  tabAll: "All",
  tabInProgress: "In progress",
  tabCompleted: "Completed",
  filterByStatus: "Filter by run status",
  filterByCaseName: "Filter by case name",
  applyFilter: "Filter",
  noRunsMatch: (query: string) => `No runs match "${query}"`,
  tryAnotherCaseName: "Try another case name or show all runs.",
  launchTemplate: "Launch a template",
  noRuns: "No runs yet. Launch a template to start one.", // AC-DSYS-04, дослівно
  backToProfile: "Back to profile",
  backToRuns: "Back to runs",
  columnCase: "Case",
  columnTemplate: "Template",
  columnStatus: "Status",
  columnProgress: "Progress",
  columnYourTasks: "Your tasks",
  template: "Template",
  chooseTemplate: "Choose a template",
  choose: "Choose",
  caseName: "Case name",
  caseNamePlaceholder: "Apartment 12, move-in",
  meAsRunManager: "Me (run manager)",
  assigneeOf: (taskName: string) => `Assignee of ${taskName}`,
  launch: "Launch",
  launching: "Launching…",
  runManager: "Run manager",
  runDetails: "Run details",
  noAnswer: "No answer",
  noExtraTasks: "No extra tasks",
  addsTaskTo: (taskName: string, sectionName: string) => `Adds "${taskName}" to ${sectionName}`,
  becauseAnswer: (fieldName: string, answer: string) => `because ${fieldName} is ${answer}`,
  appearsOnlyWhen: (fieldName: string, answer: string) =>
    `Appears only when ${fieldName} is ${answer} · not counted in progress`,
  status: "Status",
  progress: "Progress",
  markAsDone: "Mark as done",
  confirmMarkAsDone: (taskName: string) => `Mark «${taskName}» as done? This cannot be undone.`,
  confirmGroup: "Confirm mark as done",
  confirm: "Confirm",
  saving: "Saving…",
  cancel: "Cancel",
} as const;
