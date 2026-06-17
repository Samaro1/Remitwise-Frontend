"use client";

import React, { createContext, useContext, useCallback, useState, useEffect } from "react";

export type ContractOperationStatus = "pending" | "building" | "signing" | "submitting" | "confirming" | "complete" | "failed";

export interface ContractOperation {
  id: string;
  type: "emergency_transfer" | "regular_transfer" | "bill_payment" | "savings_goal" | "insurance_payment";
  title: string;
  status: ContractOperationStatus;
  detail: string;
  duration: string;
  timestamp: number;
  transactionHash?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ContractOperationStage {
  label: string;
  duration: string;
  detail: string;
  placement: string;
  status: "pending" | "active" | "complete";
}

interface ContractOperationsContextValue {
  operations: ContractOperation[];
  stages: ContractOperationStage[];
  addOperation: (operation: Omit<ContractOperation, "id" | "timestamp">) => string;
  updateOperation: (id: string, updates: Partial<ContractOperation>) => void;
  removeOperation: (id: string) => void;
  getActiveOperation: () => ContractOperation | undefined;
  getOperationsByType: (type: ContractOperation["type"]) => ContractOperation[];
  clearCompletedOperations: () => void;
}

const ContractOperationsContext = createContext<ContractOperationsContextValue | undefined>(undefined);

export function ContractOperationsProvider({ children }: { children: React.ReactNode }) {
  const [operations, setOperations] = useState<ContractOperation[]>([]);
  const [stages, setStages] = useState<ContractOperationStage[]>([
    {
      label: "Review transfer inputs",
      duration: "0-2 sec",
      detail: "Surface fees, speed, and recipient details in the same view before an emergency contract request is built.",
      placement: "Inline in the modal body",
      status: "pending",
    },
    {
      label: "Build emergency payload",
      duration: "2-5 sec",
      detail: "Show the contract-build state close to the confirm action so the user knows the request is still being prepared.",
      placement: "Above the modal footer",
      status: "pending",
    },
    {
      label: "Collect wallet signature",
      duration: "15-45 sec",
      detail: "Escalate only when the payload is ready and keep the amount summary visible while the wallet prompt is open.",
      placement: "Wallet sheet or modal",
      status: "pending",
    },
    {
      label: "Submit and confirm",
      duration: "5-30 sec",
      detail: "Once the modal closes, confirmation should move into the global stack so the user can continue sending flows without losing context.",
      placement: "Top-right desktop, inline mobile",
      status: "pending",
    },
  ]);

  const addOperation = useCallback((operation: Omit<ContractOperation, "id" | "timestamp">) => {
    const id = `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newOperation: ContractOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
    };
    setOperations((prev) => [...prev, newOperation]);
    return id;
  }, []);

  const updateOperation = useCallback((id: string, updates: Partial<ContractOperation>) => {
    setOperations((prev) =>
      prev.map((op) => (op.id === id ? { ...op, ...updates } : op))
    );
  }, []);

  const removeOperation = useCallback((id: string) => {
    setOperations((prev) => prev.filter((op) => op.id !== id));
  }, []);

  const getActiveOperation = useCallback(() => {
    return operations.find((op) => op.status === "submitting" || op.status === "confirming");
  }, [operations]);

  const getOperationsByType = useCallback((type: ContractOperation["type"]) => {
    return operations.filter((op) => op.type === type);
  }, [operations]);

  const clearCompletedOperations = useCallback(() => {
    setOperations((prev) => prev.filter((op) => op.status !== "complete" && op.status !== "failed"));
  }, []);

  // Auto-update stages based on active operation status
  useEffect(() => {
    const activeOp = getActiveOperation();
    if (activeOp) {
      setStages((prev) => {
        const updated = [...prev];
        if (activeOp.status === "building") {
          updated[0].status = "complete";
          updated[1].status = "active";
        } else if (activeOp.status === "signing") {
          updated[0].status = "complete";
          updated[1].status = "complete";
          updated[2].status = "active";
        } else if (activeOp.status === "submitting" || activeOp.status === "confirming") {
          updated[0].status = "complete";
          updated[1].status = "complete";
          updated[2].status = "complete";
          updated[3].status = "active";
        } else if (activeOp.status === "complete") {
          updated.forEach((stage) => (stage.status = "complete"));
        }
        return updated;
      });
    } else {
      setStages((prev) => prev.map((stage) => ({ ...stage, status: "pending" as const })));
    }
  }, [getActiveOperation]);

  // Auto-remove completed operations after 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setOperations((prev) =>
        prev.filter((op) => {
          if (op.status === "complete" || op.status === "failed") {
            return now - op.timestamp < 5 * 60 * 1000; // 5 minutes
          }
          return true;
        })
      );
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <ContractOperationsContext.Provider
      value={{
        operations,
        stages,
        addOperation,
        updateOperation,
        removeOperation,
        getActiveOperation,
        getOperationsByType,
        clearCompletedOperations,
      }}
    >
      {children}
    </ContractOperationsContext.Provider>
  );
}

export function useContractOperations(): ContractOperationsContextValue {
  const ctx = useContext(ContractOperationsContext);
  if (!ctx) throw new Error("useContractOperations must be used within a ContractOperationsProvider");
  return ctx;
}
