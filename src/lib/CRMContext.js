/* eslint-disable */
import React, { createContext, useContext } from "react";

// CRMContext holds all shared state/handlers from the CRM shell.
// Every tab reads from this instead of receiving 50+ props individually.
export const CRMContext = createContext(null);

export function useCRM() {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error("useCRM must be used inside CRMContext.Provider");
  return ctx;
}
