import { OperationalShift } from '../types.ts';

export const getCurrentShift = (shifts: OperationalShift[], referenceTime?: Date): OperationalShift | null => {
  if (!shifts || shifts.length === 0) return null;
  const now = referenceTime || new Date();
  
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const shift of shifts) {
    if (!shift.horarioInicio || !shift.horarioFim) continue;
    
    // Parse hh:mm
    const startParts = shift.horarioInicio.split(':');
    const endParts = shift.horarioFim.split(':');
    
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

    if (startMinutes <= endMinutes) {
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return shift;
      }
    } else {
      // Crosses midnight
      if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
        return shift;
      }
    }
  }

  return shifts[0] || null; // fallback
};

export const getOperationalDate = (shifts: OperationalShift[], referenceTime?: Date): string => {
  const now = referenceTime || new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const startShift = shifts.find(s => s.defineInicioDoDiaOperacional);
  
  let startOfOperationalDayMinutes = 0;
  if (startShift && startShift.horarioInicio) {
    const startParts = startShift.horarioInicio.split(':');
    startOfOperationalDayMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
  }

  const resultDate = new Date(now);

  if (currentMinutes < startOfOperationalDayMinutes) {
    resultDate.setDate(resultDate.getDate() - 1);
  }

  return resultDate.toISOString().split('T')[0];
};
