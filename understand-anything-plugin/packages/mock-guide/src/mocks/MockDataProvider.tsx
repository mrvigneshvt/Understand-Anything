"use client";

import React, { createContext, useContext, useMemo } from "react";

export interface MockDataContextValue {
  seedData: Record<string, unknown>;
  pageId: string;
}

const MockDataContext = createContext<MockDataContextValue | null>(null);

interface MockDataProviderProps {
  pageId: string;
  seedData: Record<string, unknown>;
  children: React.ReactNode;
}

export function MockDataProvider({ pageId, seedData, children }: MockDataProviderProps) {
  const value = useMemo(() => ({ seedData, pageId }), [seedData, pageId]);
  return (
    <MockDataContext.Provider value={value}>
      {children}
    </MockDataContext.Provider>
  );
}

export function useMockData(): MockDataContextValue {
  const ctx = useContext(MockDataContext);
  if (!ctx) throw new Error("useMockData must be used within a MockDataProvider");
  return ctx;
}

export function useSeed<T>(key: string): T | undefined {
  const { seedData } = useMockData();
  return seedData[key] as T | undefined;
}
