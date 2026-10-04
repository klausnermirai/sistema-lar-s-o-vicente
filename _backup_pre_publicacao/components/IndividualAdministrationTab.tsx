import React from 'react';
import { Resident } from '../types';
import { OperationalAdministrationTab } from './OperationalAdministrationTab';

export const IndividualAdministrationTab: React.FC<{ residents: Resident[], session: any }> = ({ residents, session }) => {
  return <OperationalAdministrationTab residents={residents} session={session} />;
};
