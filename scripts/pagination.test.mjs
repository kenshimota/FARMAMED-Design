import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/pagination.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const paginationModule = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const {
  buildListQuery,
  isPageOutOfRange,
  normalizePage,
  normalizePageSize,
  normalizeSortField,
  pageRange,
  parsePaginated,
  readListQuery,
  readPaginationMeta,
} = paginationModule;

function params(query) {
  return new URLSearchParams(query);
}

test("normaliza página y tamaño dentro del contrato", () => {
  assert.equal(normalizePage("2"), 2);
  assert.equal(normalizePage("0"), 1);
  assert.equal(normalizePage("abc"), 1);
  assert.equal(normalizePageSize("50"), 50);
  assert.equal(normalizePageSize("0"), 20);
  assert.equal(normalizePageSize("101"), 20);
  assert.equal(normalizePageSize("10", 12), 10);
});

test("normaliza el campo de orden", () => {
  assert.equal(normalizeSortField("name"), "name");
  assert.equal(normalizeSortField("category_id"), "category_id");
  assert.equal(normalizeSortField("name desc"), "");
  assert.equal(normalizeSortField(undefined), "");
});

test("construye la query de servidor y omite valores vacíos", () => {
  const query = buildListQuery({
    page: 2,
    pageSize: 20,
    sort: "name",
    order: "desc",
    q: "  ibuprofeno ",
    filters: { category_id: "3", empty: "", ignored: null },
  });

  assert.equal(
    query,
    "?page=2&page_size=20&sort=name&order=desc&q=ibuprofeno&category_id=3",
  );
});

test("lee page, page_size, orden y filtros desde searchParams", () => {
  const request = readListQuery(
    params("?page=3&page_size=50&sort=name&order=desc&q=analg&category_id=4"),
    { filterKeys: ["category_id", "tax_id"] },
  );

  assert.deepEqual(request, {
    page: 3,
    pageSize: 50,
    sort: "name",
    order: "desc",
    q: "analg",
    filters: { category_id: "4", tax_id: "" },
  });
});

test("aplica el orden por defecto y normaliza page en URL", () => {
  const request = readListQuery(params("?page=0&page_size=101"), {
    defaultSort: "createdAt",
    defaultOrder: "desc",
  });

  assert.equal(request.page, 1);
  assert.equal(request.pageSize, 20);
  assert.equal(request.sort, "createdAt");
  assert.equal(request.order, "desc");
});

test("lee el sobre paginado con meta del API", () => {
  const meta = readPaginationMeta({
    data: [],
    meta: {
      page: 2,
      page_size: 20,
      total: 45,
      total_pages: 3,
      has_next: true,
      has_prev: true,
    },
  });

  assert.deepEqual(meta, {
    page: 2,
    page_size: 20,
    total: 45,
    total_pages: 3,
    has_next: true,
    has_prev: true,
  });
});

test("parsea el sobre paginado y conserva solo filas válidas", () => {
  const parsed = parsePaginated(
    {
      data: [
        { id: 1, name: "Uno" },
        { id: null, name: "Inválida" },
        { id: 2, name: "Dos" },
      ],
      meta: {
        page: 1,
        page_size: 20,
        total: 2,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    },
    (source) =>
      typeof source === "object" &&
      source !== null &&
      typeof source.id === "number" &&
      typeof source.name === "string"
        ? { id: source.id, name: source.name }
        : null,
  );

  assert.deepEqual(parsed.data, [
    { id: 1, name: "Uno" },
    { id: 2, name: "Dos" },
  ]);
  assert.equal(parsed.meta.total, 2);
  assert.equal(parsed.meta.total_pages, 1);
});

test("tolera respuestas planas mientras el API no devuelve meta", () => {
  const parsed = parsePaginated(
    [{ id: 1 }, { id: 2 }],
    (source) =>
      typeof source === "object" &&
      source !== null &&
      typeof source.id === "number"
        ? { id: source.id }
        : null,
    { page: 1, pageSize: 20 },
  );

  assert.equal(parsed.data.length, 2);
  assert.deepEqual(parsed.meta, {
    page: 1,
    page_size: 20,
    total: 2,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  });
});

test("calcula el rango visible y detecta páginas fuera de rango", () => {
  const meta = {
    page: 2,
    page_size: 20,
    total: 45,
    total_pages: 3,
    has_next: true,
    has_prev: true,
  };
  assert.deepEqual(pageRange(meta), { from: 21, to: 40 });
  assert.equal(isPageOutOfRange(meta), false);

  const outOfRange = { ...meta, page: 5, has_next: false };
  assert.deepEqual(pageRange(outOfRange), { from: 0, to: 0 });
  assert.equal(isPageOutOfRange(outOfRange), true);
});
