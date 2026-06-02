"use client";

import { useEffect } from "react";
import { connect } from "@/lib/ws";

/** Abre a conexão WebSocket quando o app monta no browser. */
export function WsBootstrap() {
  useEffect(() => {
    connect();
  }, []);
  return null;
}
