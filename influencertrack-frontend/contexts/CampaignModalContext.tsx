'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CampaignModalContextType {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const CampaignModalContext = createContext<CampaignModalContextType | undefined>(undefined);

export function CampaignModalProvider({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <CampaignModalContext.Provider value={{ isModalOpen, openModal, closeModal }}>
      {children}
    </CampaignModalContext.Provider>
  );
}

export function useCampaignModal() {
  const context = useContext(CampaignModalContext);
  if (context === undefined) {
    throw new Error('useCampaignModal must be used within a CampaignModalProvider');
  }
  return context;
}
