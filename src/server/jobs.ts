import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { openLogin } from "../browser/login.ts";
import { config } from "../config.ts";
import { root } from "../paths.ts";
import { record } from "../recorder/record.ts";
import { saveRecording } from "../script/save-recording.ts";
import { HttpError } from "./http.ts";

// One thing runs at a time: a login, a recording or a video being made.

export type Job = {
  kind: "login" | "record" | "play";
  /** Session name for a login, tour name otherwise. */
  name: string;
  status: "running" | "done" | "error" | "canceled";
  progress: number;
  message: string;
  /** Things that worked but deserve a look, like a fragile target. */
  warnings: string[];
  startedAt: number;
  /** Ends a login or recording normally, saving what was done. */
  stop?: () => Promise<void>;
  /** Abandons the job without saving. */
  cancel?: () => Promise<void>;
};

let current: Job | null = null;

export const currentJob = () => current;

function begin(
  job: Omit<Job, "status" | "progress" | "warnings" | "startedAt">,
) {
  if (current?.status === "running")
    throw new HttpError(409, "Espere a tarefa atual terminar ou cancele-a.");
  current = {
    ...job,
    status: "running",
    progress: 0,
    warnings: [],
    startedAt: Date.now(),
  };
  return current;
}

const finish = (job: Job, message: string, warnings: string[] = []) =>
  Object.assign(job, { status: "done", progress: 1, message, warnings });

const fail = (job: Job, message: string) =>
  Object.assign(job, { status: "error", message });

/** Ends a login or recording by button or by the user closing the window. */
function endWith(
  job: Job,
  closed: Promise<void>,
  save: () => Promise<{ message: string; warnings?: string[] }>,
) {
  let saving: Promise<void> | null = null;

  job.stop = () =>
    (saving ??= save().then(
      ({ message, warnings }) => void finish(job, message, warnings),
      (error: Error) => void fail(job, error.message),
    ));

  // Closing the window saves too, unless the job was canceled (which closes it).
  void closed.then(() => (job.status === "running" ? job.stop!() : undefined));
}

export async function startLogin(session: string, url: string) {
  const job = begin({
    kind: "login",
    name: session,
    message:
      "Faça login na janela do Chrome e depois clique em “Concluir login”.",
  });

  try {
    const login = await openLogin(session, url);

    job.cancel = login.cancel;

    endWith(job, login.closed, async () => {
      await login.finish();
      return { message: `Login “${session}” salvo.` };
    });
  } catch (error) {
    fail(job, (error as Error).message);
  }
}

export async function startRecording(options: {
  name: string;
  url: string;
  session?: string;
  goal?: string;
  width: number;
}) {
  const job = begin({
    kind: "record",
    name: options.name,
    message:
      "Gravando: faça o passo a passo na janela do Chrome e depois clique em “Parar gravação”.",
  });

  try {
    const recording = await record(options);

    job.cancel = async () => void (await recording.stop());

    endWith(job, recording.closed, async () => {
      const saved = saveRecording(options.name, await recording.stop(), {
        session: options.session,
        locale: config.locale,
        goal: options.goal,
      });

      return {
        message: `Gravação salva com ${saved.script.steps.length} passos.`,
        warnings: saved.warnings,
      };
    });
  } catch (error) {
    fail(job, (error as Error).message);
  }
}

/**
 * Makes the video in a child process (`pnpm play`), reading its progress lines.
 * Canceling kills it along with the Chrome it opened.
 */
export function startPlay(name: string) {
  const job = begin({ kind: "play", name, message: "Abrindo o navegador" });
  const child = spawn(
    process.execPath,
    [path.join(root, "src", "cli", "play.ts"), name],
    { cwd: root },
  );

  job.cancel = async () => {
    // Kill the whole tree, or the Chrome it launched keeps running on Windows.
    if (process.platform === "win32")
      try {
        execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      } catch {}
    else child.kill();
  };

  let errors = "";
  child.stdout.on("data", (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      const progress = /^\[(\d+)%\] (.+)$/.exec(line);
      if (progress && job.status === "running")
        Object.assign(job, {
          progress: Number(progress[1]) / 100,
          message: progress[2],
        });
      if (line.startsWith("Atenção: "))
        job.warnings.push(line.slice("Atenção: ".length));
    }
  });

  child.stderr.on("data", (chunk) => (errors += chunk));
  child.on("close", (code) => {
    if (job.status !== "running") return;
    if (code === 0) return finish(job, "Vídeo pronto.", job.warnings);
    const reason =
      /^Error: (.+)$/m.exec(errors)?.[1] ?? errors.trim().split("\n").at(-1);
    fail(job, reason || `A geração parou (código ${code}).`);
  });
}

export async function stopJob() {
  if (current?.status !== "running" || !current.stop)
    throw new HttpError(409, "Nenhum login ou gravação em andamento.");
  await current.stop();
}

/** Abandons whatever is running, without saving it. */
export async function cancelJob() {
  const job = current;

  if (job?.status !== "running") return;

  job.status = "canceled";
  job.message = "Cancelado.";

  await job.cancel?.().catch(() => {});
}
