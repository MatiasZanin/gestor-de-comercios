"use client";

import Clarity from "@microsoft/clarity";
import { useEffect } from "react";

export function MicrosoftClarity() {
  useEffect(() => {
    const projectId =
      process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

    if (
      process.env.NODE_ENV !== "production" ||
      !projectId
    ) {
        console.warn("Microsoft Clarity is not initialized.", process.env.NODE_ENV !== "production" ? "Not in production environment." : "Missing project ID.");
      return;
    }

    Clarity.init(projectId);
    console.log("Microsoft Clarity initialized");
  }, []);

  return null;
}