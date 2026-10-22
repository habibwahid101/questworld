"use client";

import { useState } from "react";
import { adminTableLabels, filterAdminRows, type AdminTableColumn, type AdminTableRow } from "@/lib/admin/table";

export function AdminRecordTable({
  columns,
  rows,
  empty,
  loading,
  actions,
}: {
  columns: readonly AdminTableColumn[];
  rows: readonly AdminTableRow[];
  empty: string;
  loading?: boolean;
  actions?: (row: AdminTableRow) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const visible = filterAdminRows(rows, query);
  const columnCount = columns.length + (actions ? 1 : 0);

  return (
    <div className="stack">
      <label htmlFor="admin-record-search">
        Search
        <input
          id="admin-record-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ display: "block", width: "100%", marginTop: 8 }}
        />
      </label>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{adminTableLabels[column]}</th>
                ))}
                {actions ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={columnCount}>{empty}</td>
                </tr>
              ) : (
                visible.map((row) => (
                  <tr key={row.id}>
                    {columns.map((column) => (
                      <td key={column}>{column === "who" ? <WhoCell row={row} /> : row[column]}</td>
                    ))}
                    {actions ? <td>{actions(row)}</td> : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WhoCell({ row }: { row: AdminTableRow }) {
  if (row.whoName && row.whoEmail) {
    return (
      <>
        <span>{row.whoName}</span>
        <br />
        <span>{row.whoEmail}</span>
      </>
    );
  }
  return <>{row.ownerSub}</>;
}
