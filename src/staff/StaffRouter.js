// ============================================================
// StaffRouter.js
//
// Replace <CRM /> with <StaffRouter /> at your app entry point.
// Passes all the same props through — nothing else changes.
//
//   role === "staff"    →  StaffUI (staff portal)
//   role === "factory"  →  StaffUI (factory worker portal)
//   role === "admin"    →  CRM     (untouched)
//   role === "agent"    →  CRM     (untouched)
// ============================================================

import React from "react";
import { CRM } from "./CRM";
import { StaffUI } from "./staff/StaffUI.js";

const STAFF_PORTAL_ROLES = ["staff"];

export default function StaffRouter(props) {
  const { sess } = props;
  if (!sess) return null;

  if (STAFF_PORTAL_ROLES.includes(sess.role)) {
    return <StaffUI {...props} />;
  }

  return <CRM {...props} />;
}
