import React, { useState } from 'react';
import { Resident } from '../types';
import { Cake, Calendar, ChevronLeft, ChevronRight, User } from 'lucide-react';

interface BirthdaySectionProps {
  residents: Resident[];
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const BirthdaySection: React.FC<BirthdaySectionProps> = ({ residents }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const getBirthdays = () => {
    return residents.filter(r => {
      if (!r.birthDate) return false;
      const birthDate = new Date(r.birthDate + 'T12:00:00');
      if (isNaN(birthDate.getTime())) return false;
      return birthDate.getMonth() === selectedMonth;
    }).sort((a, b) => {
      const dayA = new Date(a.birthDate + 'T12:00:00').getDate();
      const dayB = new Date(b.birthDate + 'T12:00:00').getDate();
      return dayA - dayB;
    });
  };

  const birthdays = getBirthdays();

  const handlePrevMonth = () => {
    setSelectedMonth(prev => (prev === 0 ? 11 : prev - 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => (prev === 11 ? 0 : prev + 1));
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in duration-500 max-h-[600px] lg:max-h-[800px]">
      <div className="p-4 sm:p-6 border-b bg-gray-50/50 flex flex-col xl:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <div className="p-2.5 bg-pink-50 text-pink-500 rounded-xl shrink-0">
            <Cake size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest leading-tight">Aniversariantes</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Comemore com nossos residentes</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-100 w-full xl:w-auto justify-between xl:justify-start">
          <button 
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 transition-colors shrink-0"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="relative flex-1 xl:flex-none flex justify-center">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="text-xs font-black uppercase text-gray-600 bg-transparent border-none focus:ring-0 cursor-pointer outline-none text-center appearance-none px-6 w-full max-w-[140px]"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
               <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

          <button 
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 transition-colors shrink-0"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {birthdays.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-40 py-10">
            <Calendar size={40} className="text-gray-300" />
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
              Nenhum aniversariante em {MONTHS[selectedMonth]}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {birthdays.map((resident) => {
              const day = new Date(resident.birthDate + 'T12:00:00').getDate();
              const isToday = new Date().getMonth() === selectedMonth && new Date().getDate() === day;
              
              return (
                <div 
                  key={resident.id}
                  className={`group p-4 rounded-2xl border transition-all flex items-center gap-4 ${
                    isToday 
                      ? 'bg-pink-50 border-pink-100 ring-2 ring-pink-50' 
                      : 'bg-white border-gray-100 hover:border-pink-200 hover:shadow-md'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 ${
                    isToday ? 'bg-pink-200 text-pink-600' : 'bg-gray-50 text-gray-400'
                  }`}>
                    {resident.photo ? (
                      <img src={resident.photo} alt={resident.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-black text-gray-800 uppercase tracking-tight leading-tight break-words">
                      {resident.name}
                    </h4>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                      Dia {day} de {MONTHS[selectedMonth]}
                    </p>
                  </div>

                  {isToday && (
                    <div className="bg-pink-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter animate-bounce flex items-center gap-1 shadow-sm">
                      <Cake size={10} /> Hoje!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div className="p-4 bg-gray-50 border-t flex justify-center">
         <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
           Total: {birthdays.length} {birthdays.length === 1 ? 'aniversariante' : 'aniversariantes'}
         </p>
      </div>
    </div>
  );
};

export default BirthdaySection;
