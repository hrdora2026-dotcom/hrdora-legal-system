import * as XLSX from "xlsx";

export type ExportCol<T> = { header: string; value: (row: T) => string | number | null | undefined; total?: boolean };

export function buildSheet<T>(rows: T[], cols: ExportCol<T>[]) {
  const data: (string | number)[][] = [cols.map((c) => c.header)];
  for (const r of rows) data.push(cols.map((c) => c.value(r) ?? ""));
  if (cols.some((c) => c.total)) {
    data.push(
      cols.map((c, i) =>
        c.total ? Math.round(rows.reduce((s, r) => s + Number(c.value(r) || 0), 0) * 100) / 100 : i === 0 ? "TOTAL" : "",
      ),
    );
  }
  return data;
}

export function exportRows<T>(rows: T[], cols: ExportCol<T>[], filename: string, format: "xlsx" | "csv", title?: string) {
  const data = buildSheet(rows, cols);
  if (title) data.unshift([title], []);
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = cols.map((c) => ({ wch: Math.max(12, c.header.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.${format}`, { bookType: format });
}
