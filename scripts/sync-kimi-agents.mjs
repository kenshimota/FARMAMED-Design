import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, ".opencode", "agents");
const outputDir = path.join(root, ".kimi-code", "agents");

const profiles = {
  builder: {
    whenToUse:
      "Implementar o modificar pantallas, componentes, estilos, rutas o escenas de FARMAMED-Design.",
    tools: [
      "Read",
      "Write",
      "Edit",
      "Grep",
      "Glob",
      "Bash",
      "TodoList",
      "Agent",
      "Skill",
      "AskUserQuestion",
      "FetchURL",
      "WebSearch",
      "ReadMediaFile",
    ],
    subagents: ["reviewer", "qa"],
  },
  reviewer: {
    whenToUse:
      "Revisar código, diseño, accesibilidad, responsive o contenido antes de entregar.",
    tools: ["Read", "Grep", "Glob", "Bash"],
    disallowedTools: ["Write", "Edit"],
  },
  qa: {
    whenToUse:
      "Verificar lint, build, arranque y respuestas HTTP de un cambio antes de entregar.",
    tools: ["Read", "Grep", "Glob", "Bash"],
    disallowedTools: ["Write", "Edit"],
  },
  "design-issue-writer": {
    whenToUse:
      "Crear, revisar o publicar issues de diseño derivados de las HU del API.",
    tools: [
      "Read",
      "Grep",
      "Glob",
      "Bash",
      "FetchURL",
      "WebSearch",
      "AskUserQuestion",
      "Skill",
      "TodoList",
    ],
    disallowedTools: ["Write", "Edit"],
  },
};

const frontmatterPattern = /^---\n([\s\S]*?)\n---\n?/;

const linesForList = (key, values) => {
  if (!values?.length) return [];
  return [`${key}:`, ...values.map((value) => `  - ${value}`)];
};

await mkdir(outputDir, { recursive: true });

for (const [name, profile] of Object.entries(profiles)) {
  const source = await readFile(path.join(sourceDir, `${name}.md`), "utf8");
  const match = source.match(frontmatterPattern);

  if (!match) {
    throw new Error(`No se encontró frontmatter en ${name}.md`);
  }

  const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();

  if (!description) {
    throw new Error(`No se encontró description en ${name}.md`);
  }

  const body = source.slice(match[0].length);
  const frontmatter = [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(description)}`,
    `whenToUse: ${JSON.stringify(profile.whenToUse)}`,
    ...linesForList("tools", profile.tools),
    ...linesForList("disallowedTools", profile.disallowedTools),
    ...linesForList("subagents", profile.subagents),
    "---",
    "",
  ].join("\n");

  await writeFile(path.join(outputDir, `${name}.md`), `${frontmatter}${body}`);
  console.log(`Generado .kimi-code/agents/${name}.md`);
}
