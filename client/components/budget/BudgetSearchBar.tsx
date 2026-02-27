import React from "react";
import SearchBar from "@/components/global/SearchBar";

type Props = {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
};

/**
 * Thin wrapper so existing imports (`BudgetSearchBar`) keep working.
 * All logic lives in the shared `SearchBar` component.
 */
export default function BudgetSearchBar({
  searchQuery,
  setSearchQuery,
}: Props) {
  return (
    <SearchBar
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      placeholder="Search budgets..."
    />
  );
}
