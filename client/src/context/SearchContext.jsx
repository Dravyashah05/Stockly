import React, { createContext, useContext, useState, useEffect } from "react";
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

  return (
    <SearchContext.Provider value={{ search, setSearch }}>
      {children}
    </SearchContext.Provider>
  )
}
