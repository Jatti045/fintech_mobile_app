import SearchBar from "@/components/global/SearchBar";

/**
 * Thin wrapper so existing imports (`TxSearchBar`) keep working.
 * All logic lives in the shared `SearchBar` component.
 */
function SearchTransaction({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
}) {
  return (
    <SearchBar
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      placeholder="Search transactions..."
    />
  );
}

export default SearchTransaction;
