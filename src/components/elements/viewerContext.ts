// Which list the viewer was opened from (its userInteractionSource), for the events its parts send
import { createContext, useContext } from 'react';

export const ViewerSourceContext = createContext('Unspecified');
export const useTrackElementViewSource = () => useContext(ViewerSourceContext);
