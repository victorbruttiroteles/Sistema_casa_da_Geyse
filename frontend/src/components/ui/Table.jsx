export default function Table({ columns, data, onRowClick, emptyMessage = 'Nenhum registro encontrado.' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-pink-900/30">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-dark-800 border-b border-pink-900/30">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-pink-900/20">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">{emptyMessage}</td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRowClick?.(row)}
                className={`bg-dark-900/50 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-pink-900/10' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-200 whitespace-nowrap">
                    {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
