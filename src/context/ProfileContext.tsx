import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getSetting, setSetting } from "../db/sessions";

export type ProfileId = "A" | "B";

type ProfileContextValue = {
  activeProfile: ProfileId;
  setActiveProfile: (p: ProfileId) => void;
};

const ProfileContext = createContext<ProfileContextValue>({
  activeProfile: "A",
  setActiveProfile: () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [activeProfile, setActiveProfileState] = useState<ProfileId>("A");

  useEffect(() => {
    const v = getSetting("activeProfile");
    if (v === "B") setActiveProfileState("B");
  }, []);

  const setActiveProfile = useCallback((p: ProfileId) => {
    setSetting("activeProfile", p);
    setActiveProfileState(p);
  }, []);

  return (
    <ProfileContext.Provider value={{ activeProfile, setActiveProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
