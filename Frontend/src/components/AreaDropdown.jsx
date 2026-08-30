import React from 'react';
import { CityDropdown } from './CityDropdown';

/**
 * AreaDropdown - Kept for backwards compatibility, delegates to CityDropdown
 */
export const AreaDropdown = (props) => {
  return <CityDropdown {...props} />;
};

export default AreaDropdown;
