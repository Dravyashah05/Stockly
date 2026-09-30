import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

const SearchContext = createContext(null);
export function useSearch(){ return useContext(SearchContext); }

export function SearchProvider({ children }){
  const [search, setSearch] = useState("");
  const location = useLocation();
  const pathname = location.pathname;

  // clear search only when switching main sections, not on child routes like /products/:id
  const mainSegment = "/" + (pathname.split("/")[1] || "");
  useEffect(()=>{
    setSearch("");
  }, [mainSegment]);

  // Stable context value so consumers don't re-render on unrelated
  // provider re-renders (e.g. every route change).
  const value = useMemo(() => ({ search, setSearch }), [search]);

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  )
}
