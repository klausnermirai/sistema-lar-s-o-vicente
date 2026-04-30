
import React from 'react';
import { X, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MuralModule from './MuralModule';

interface MuralChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  institutionId: string;
  cnpj?: string;
  username: string;
  accessLevel?: string;
}

export const MuralChatPanel: React.FC<MuralChatPanelProps> = ({ isOpen, onClose, institutionId, cnpj, username, accessLevel }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-end p-6 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px] pointer-events-auto"
          />
          
          <motion.div 
            initial={{ x: 500, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 500, opacity: 0 }}
            className="relative w-full max-w-2xl h-full bg-white shadow-2xl rounded-[32px] overflow-hidden flex flex-col pointer-events-auto border border-gray-100"
          >
            {/* Header */}
            <div className="bg-[#004c99] p-6 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-inner">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Mural Institucional</h3>
                  <p className="text-[10px] text-blue-100 font-bold uppercase">Comunicação da Equipe</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content - Reuse MuralModule */}
            <div className="flex-1 overflow-hidden">
               <MuralModule institutionId={institutionId} cnpj={cnpj} username={username} hideHeader={true} accessLevel={accessLevel} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
