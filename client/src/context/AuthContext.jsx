import React, { createContext, useContext, useEffect, useState } from "react";
import { me as fetchMe, logoutSession } from "../api/auth";

const AuthContext = createContext(null);
export function useAuth(){ return useContext(AuthContext); }

export function AuthProvider({ children }){
  const [user, setUser] = useState(()=> {
    try{ const s=localStorage.getItem("user"); return s?JSON.parse(s):null }catch{ return null }
  });
  const [token, setTokenState] = useState(()=> localStorage.getItem("token"));
  const setAuth = (token, user)=>{
    if(token){ localStorage.setItem("token", token); setTokenState(token); }
    if(user){ localStorage.setItem("user", JSON.stringify(user)); setUser(user); }
  };
  const updateUser = (user)=>{
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
  };
  const logout = async ()=>{
    try{ if(token) await logoutSession().catch(()=>{}); }catch{}
    localStorage.removeItem("token"); localStorage.removeItem("user"); setUser(null); setTokenState(null);
  };
  useEffect(()=>{
    if(token && !user){
      fetchMe().then(r=> setUser(r.data)).catch(()=> { localStorage.removeItem("token"); localStorage.removeItem("user"); setUser(null); setTokenState(null); });
    }
  },[]);
  return <AuthContext.Provider value={{ user, token, setAuth, updateUser, logout, isAuthenticated: !!token }}>{children}</AuthContext.Provider>
}
