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
      return;
    }

    Clarity.init(projectId);
  }, []);

  return null;
}