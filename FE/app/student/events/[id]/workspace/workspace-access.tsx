"use client";

import { createContext, useContext, type ReactNode } from "react";

type WorkspaceAccessContextValue = {
  eventStatus: string | null;
  isReadOnly: boolean;
};

const WorkspaceAccessContext = createContext<WorkspaceAccessContextValue>({
  eventStatus: null,
  isReadOnly: true,
});

export function WorkspaceAccessProvider({
  children,
  eventStatus,
  isReadOnly,
}: WorkspaceAccessContextValue & { children: ReactNode }) {
  return (
    <WorkspaceAccessContext.Provider value={{ eventStatus, isReadOnly }}>
      {children}
    </WorkspaceAccessContext.Provider>
  );
}

export function useWorkspaceAccess() {
  return useContext(WorkspaceAccessContext);
}
