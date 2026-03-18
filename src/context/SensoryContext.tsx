import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getSetting, setSetting } from "../db/sessions";

type SensoryContextValue = {
  lowSensory: boolean;
  toggleLowSensory: () => void;
};

const SensoryContext = createContext<SensoryContextValue>({
  lowSensory: false,
  toggleLowSensory: () => {},
});

export function SensoryProvider({ children }: { children: React.ReactNode }) {
  const [lowSensory, setLowSensory] = useState(false);

  useEffect(() => {
    const v = getSetting("lowSensory");
    if (v === "1") setLowSensory(true);
  }, []);

  const toggleLowSensory = useCallback(() => {
    setLowSensory((prev) => {
      const next = !prev;
      setSetting("lowSensory", next ? "1" : "0");
      return next;
    });
  }, []);

  return (
    <SensoryContext.Provider value={{ lowSensory, toggleLowSensory }}>
      {children}
    </SensoryContext.Provider>
  );
}

export function useSensory() {
  return useContext(SensoryContext);
}
