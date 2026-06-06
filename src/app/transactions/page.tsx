// src/app/transactions/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TxFilterBar } from "@/components/transactions/TxFilterBar";
import { TxTable } from "@/components/transactions/TxTable";
import { TxDrawer } from "@/components/transactions/TxDrawer";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Transaction } from "@/lib/types";

const LIMIT = 50;

interface ApiResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  cards: { code: number; label: string }[];
  categories: string[];
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [card, setCard] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    const params = new URLSearchParams({ card, category, status, page: String(p) });
    if (search.trim()) params.set("search", search.trim());
    if (highlightId) params.set("highlight", String(highlightId));
    const res = await fetch(`/api/transactions?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
    if (highlightId && json.transactions) {
      const target = json.transactions.find((t: Transaction) => t.id === highlightId);
      if (target) {
        setSelected(target);
        setTimeout(() => highlightRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
      }
    }
  }, [card, category, status, search, page, highlightId]);

  useEffect(() => { load(page); }, [card, category, status, page]);
  useEffect(() => { setPage(1); }, [card, category, status, search]);

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TxFilterBar
          search={search} card={card} category={category} status={status}
          total={data?.total ?? 0} loading={loading}
          cards={data?.cards ?? []} categories={data?.categories ?? []}
          onSearch={setSearch}
          onSubmitSearch={(e) => { e.preventDefault(); setPage(1); load(1); }}
          onCard={setCard} onCategory={setCategory} onStatus={setStatus}
        />

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? <LoadingSpinner /> : (
            <TxTable
              transactions={data?.transactions ?? []}
              selected={selected}
              highlightId={highlightId}
              highlightRowRef={highlightRowRef}
              onSelect={setSelected}
            />
          )}
        </div>

        {!loading && (
          <Pagination
            page={page} totalPages={totalPages}
            total={data?.total ?? 0} perPage={LIMIT}
            onChange={setPage}
          />
        )}
      </div>

      {selected && <TxDrawer t={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TransactionsContent />
    </Suspense>
  );
}
